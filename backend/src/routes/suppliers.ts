import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Generate next supplier code
async function generateSupplierCode(): Promise<string> {
  try {
    // Get the last supplier ordered by code
    const lastSupplier = await prisma.supplier.findFirst({
      where: {
        code: {
          startsWith: 'SUP-',
        },
      },
      orderBy: {
        code: 'desc',
      },
    });

    if (!lastSupplier) {
      return 'SUP-001';
    }

    // Extract number from last code (e.g., "SUP-001" -> 1)
    const match = lastSupplier.code.match(/SUP-(\d+)/);
    if (match) {
      const lastNum = parseInt(match[1], 10);
      const nextNum = lastNum + 1;
      return `SUP-${String(nextNum).padStart(3, '0')}`;
    }

    // If format doesn't match, start from 001
    return 'SUP-001';
  } catch (error) {
    console.error('Error generating supplier code:', error);
    // Fallback: generate based on count
    const count = await prisma.supplier.count();
    return `SUP-${String(count + 1).padStart(3, '0')}`;
  }
}

// GET /api/suppliers - Get all suppliers with filters and pagination
router.get('/', async (req, res) => {
  try {
    const {
      search,
      fieldFilter,
      status,
      page = '1',
      limit = '10',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    // Status filter
    if (status && status !== 'all') {
      where.status = status;
    }

    // Search filter
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      if (fieldFilter && fieldFilter !== 'all') {
        switch (fieldFilter) {
          case 'name':
            where.OR = [
              { name: { contains: searchTerm } },
              { companyName: { contains: searchTerm } },
            ];
            break;
          case 'email':
            where.email = { contains: searchTerm };
            break;
          case 'phone':
            where.phone = { contains: search as string };
            break;
        }
      } else {
        where.OR = [
          { companyName: { contains: searchTerm } },
          { email: { contains: searchTerm } },
          { code: { contains: searchTerm } },
          { phone: { contains: search as string } },
        ];
      }
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    res.json({
      data: suppliers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/suppliers/:id - Get single supplier
router.get('/:id', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ data: supplier });
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', async (req, res) => {
  try {
    const {
      code,
      name,
      companyName,
      address,
      city,
      state,
      country,
      zipCode,
      email,
      phone,
      cnic,
      contactPerson,
      taxId,
      paymentTerms,
      openingBalance,
      date,
      status,
      notes,
    } = req.body;

    if (!companyName || companyName.trim() === '') {
      return res.status(400).json({ error: 'Company Name is required' });
    }

    // Parse openingBalance to ensure it's a number (not a string)
    const parsedOpeningBalance = openingBalance ? parseFloat(openingBalance) : 0;

    // Auto-generate supplier code if not provided or empty
    const supplierCode = (code && code.trim() !== '') ? code.trim() : await generateSupplierCode();

    const supplier = await prisma.supplier.create({
      data: {
        code: supplierCode,
        name: name || null,
        companyName,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        zipCode: zipCode || null,
        email: email || null,
        phone: phone || null,
        cnic: cnic || null,
        contactPerson: contactPerson || null,
        taxId: taxId || null,
        paymentTerms: paymentTerms || null,
        openingBalance: parsedOpeningBalance,
        date: date ? new Date(date) : null,
        status: status || 'active',
        notes: notes || null,
      },
    });

    // ALWAYS create supplier account under Current Liabilities (subgroup 301)
    // This ensures all suppliers appear in Current Liabilities
    try {
      // Find Purchase Orders Payables subgroup (301) - Current Liabilities
      const payablesSubgroup = await prisma.subgroup.findFirst({
        where: { code: '301' },
      });

      if (payablesSubgroup) {
        // Generate account code: 301XXX where XXX is sequential
        const existingAccounts = await prisma.account.findMany({
          where: {
            code: {
              startsWith: '301',
            },
          },
          orderBy: {
            code: 'desc',
          },
        });

        let accountCode = '301001';
        if (existingAccounts.length > 0) {
          const lastCode = existingAccounts[0].code;
          const match = lastCode.match(/^301(\d+)$/);
          if (match) {
            const lastNum = parseInt(match[1], 10);
            const nextNum = lastNum + 1;
            accountCode = `301${String(nextNum).padStart(3, '0')}`;
          }
        }

        // Check if account already exists for this supplier
        const existingAccount = await prisma.account.findFirst({
          where: {
            name: name || companyName,
            subgroupId: payablesSubgroup.id,
          },
        });

        if (!existingAccount) {
          // Create supplier account
          const supplierAccount = await prisma.account.create({
            data: {
              subgroupId: payablesSubgroup.id,
              code: accountCode,
              name: `${name || companyName}`,
              description: `Supplier Account: ${companyName}`,
              openingBalance: 0,
              currentBalance: parsedOpeningBalance, // Set initial balance if opening balance exists
              status: 'Active',
              canDelete: false,
            },
          });

          // Create journal entry and update balances ONLY if opening balance > 0
          console.log(`🔍 DEBUG: parsedOpeningBalance = ${parsedOpeningBalance}, condition = ${parsedOpeningBalance > 0}`);
          if (parsedOpeningBalance > 0) {
            console.log('✅ Opening balance > 0, creating voucher...');
            // Find or create Owner Capital account (501003)
            let ownerCapitalAccount = await prisma.account.findFirst({
              where: { code: '501003' },
            });

            if (!ownerCapitalAccount) {
              // Find Capital subgroup (501)
              const capitalSubgroup = await prisma.subgroup.findFirst({
                where: { code: '501' },
              });

              if (!capitalSubgroup) {
                console.error('❌ Capital subgroup (501) not found. Cannot create Owner Capital account.');
                throw new Error('Capital subgroup (501) not found. Please create accounting structure first.');
              }

              // Create Owner Capital account
              ownerCapitalAccount = await prisma.account.create({
                data: {
                  subgroupId: capitalSubgroup.id,
                  code: '501003',
                  name: 'OWNER CAPITAL',
                  description: 'Owner Capital account for supplier opening balances',
                  openingBalance: 0,
                  currentBalance: 0,
                  status: 'Active',
                  canDelete: false,
                },
              });
              console.log(`✅ Created Owner Capital account (501003)`);
            }

            // Generate voucher number
            const voucherCount = await prisma.voucher.count();
            const voucherNumber = `JV-${String(voucherCount + 1).padStart(4, '0')}`;

            // Create JV voucher for opening balance
            const voucher = await prisma.voucher.create({
              data: {
                voucherNumber,
                type: 'journal',
                date: date ? new Date(date) : new Date(),
                narration: `Supplier Opening Balance: ${name || companyName} (SUP-${supplierCode})`,
                totalDebit: parsedOpeningBalance,
                totalCredit: parsedOpeningBalance,
                status: 'posted',
                createdBy: 'System',
                approvedBy: 'System',
                approvedAt: new Date(),
                entries: {
                  create: [
                    {
                      accountId: ownerCapitalAccount.id,
                      accountName: `${ownerCapitalAccount.code}-${ownerCapitalAccount.name}`,
                      description: `Supplier Opening Balance: ${name || companyName} - ${parsedOpeningBalance}`,
                      debit: parsedOpeningBalance,
                      credit: 0,
                      sortOrder: 0,
                    },
                    {
                      accountId: supplierAccount.id,
                      accountName: `${supplierAccount.code}-${supplierAccount.name}`,
                      description: `Supplier Opening Balance: ${name || companyName} - ${parsedOpeningBalance}`,
                      debit: 0,
                      credit: parsedOpeningBalance,
                      sortOrder: 1,
                    },
                  ],
                },
              },
              include: {
                entries: true,
              },
            });
            
            console.log(`✅ Created voucher ${voucherNumber}:`, {
              id: voucher.id,
              status: voucher.status,
              date: voucher.date,
              totalDebit: voucher.totalDebit,
              totalCredit: voucher.totalCredit,
              entries: voucher.entries.map(e => ({
                accountId: e.accountId,
                accountName: e.accountName,
                debit: e.debit,
                credit: e.credit
              }))
            });

            // Update account balances
            await prisma.account.update({
              where: { id: ownerCapitalAccount.id },
              data: {
                currentBalance: {
                  increment: -parsedOpeningBalance, // Owner Capital decreases with debit
                },
              },
            });

            await prisma.account.update({
              where: { id: supplierAccount.id },
              data: {
                currentBalance: {
                  increment: parsedOpeningBalance, // Liability increases with credit
                },
              },
            });

            console.log(`✅ Created supplier account ${accountCode} and JV voucher ${voucherNumber} for opening balance`);
          } else {
            // No opening balance, just create the account
            console.log(`✅ Created supplier account ${accountCode} (no opening balance)`);
          }
        } else {
          console.log(`ℹ️  Supplier account already exists: ${existingAccount.code} - ${existingAccount.name}`);
        }
      } else {
        console.error('❌ Purchase Orders Payables subgroup (301) not found. Cannot create supplier account.');
      }
    } catch (accountError: any) {
      console.error('Error creating supplier account/journal entry:', accountError);
      // Don't fail supplier creation if account creation fails
    }

    res.status(201).json({ data: supplier });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Supplier code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', async (req, res) => {
  try {
    const {
      code,
      name,
      companyName,
      address,
      city,
      state,
      country,
      zipCode,
      email,
      phone,
      cnic,
      contactPerson,
      taxId,
      paymentTerms,
      openingBalance,
      date,
      status,
      notes,
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'Company Name is required' });
    }

    const updateData: any = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name || null;
    if (companyName !== undefined) updateData.companyName = companyName;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (country !== undefined) updateData.country = country || null;
    if (zipCode !== undefined) updateData.zipCode = zipCode || null;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (cnic !== undefined) updateData.cnic = cnic || null;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson || null;
    if (taxId !== undefined) updateData.taxId = taxId || null;
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms || null;
    if (openingBalance !== undefined) updateData.openingBalance = openingBalance || 0;
    if (date !== undefined) updateData.date = date ? new Date(date) : null;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ data: supplier });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Supplier code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', async (req, res) => {
  try {
    await prisma.supplier.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;

