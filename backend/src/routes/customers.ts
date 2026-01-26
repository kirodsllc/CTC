import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/customers - Get all customers with filters and pagination
router.get('/', async (req, res) => {
  try {
    const {
      search,
      searchBy,
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
    if (search && searchBy) {
      const searchTerm = (search as string).toLowerCase();
      switch (searchBy) {
        case 'name':
          where.name = { contains: searchTerm };
          break;
        case 'email':
          where.email = { contains: searchTerm };
          break;
        case 'cnic':
          where.cnic = { contains: search as string };
          break;
        case 'contact':
          where.contactNo = { contains: search as string };
          break;
        default:
          where.OR = [
            { name: { contains: searchTerm } },
            { email: { contains: searchTerm } },
          ];
      }
    }

    // Fetch all customers (we'll filter out "Demo" customers in memory since SQLite doesn't support case-insensitive mode)
    const [allCustomers, totalBeforeFilter] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    // Filter out "Demo" customers (case-insensitive) - SQLite doesn't support mode: 'insensitive'
    const filteredCustomers = allCustomers.filter(
      (customer) => !customer.name.toLowerCase().includes('demo')
    );

    // Apply pagination after filtering
    const total = filteredCustomers.length;
    const paginatedCustomers = filteredCustomers.slice(skip, skip + limitNum);

    res.json({
      data: paginatedCustomers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customers/:id - Get single customer
router.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ data: customer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customers - Create new customer
router.post('/', async (req, res) => {
  try {
    const {
      name,
      address,
      email,
      cnic,
      contactNo,
      openingBalance,
      date,
      creditLimit,
      status,
      priceType,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        address: address || null,
        email: email || null,
        cnic: cnic || null,
        contactNo: contactNo || null,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        date: date ? new Date(date) : null,
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        status: status || 'active',
        priceType: priceType || null,
      },
    });

    // ALWAYS create customer account under Current Assets (subgroup 103)
    // This ensures all customers appear in Current Assets as Accounts Receivable
    try {
      // Find Accounts Receivable subgroup (103) - Current Assets
      const receivablesSubgroup = await prisma.subgroup.findFirst({
        where: { code: '103' },
      });

      if (receivablesSubgroup) {
        // Generate account code: 103XXX where XXX is sequential
        const existingAccounts = await prisma.account.findMany({
          where: {
            code: {
              startsWith: '103',
            },
          },
          orderBy: {
            code: 'desc',
          },
        });

        let accountCode = '103001';
        if (existingAccounts.length > 0) {
          const lastCode = existingAccounts[0].code;
          const match = lastCode.match(/^103(\d+)$/);
          if (match) {
            const lastNum = parseInt(match[1], 10);
            const nextNum = lastNum + 1;
            accountCode = `103${String(nextNum).padStart(3, '0')}`;
          }
        }

        // Check if account already exists for this customer
        const existingAccount = await prisma.account.findFirst({
          where: {
            name: name,
            subgroupId: receivablesSubgroup.id,
          },
        });

        if (!existingAccount) {
          // Create customer account
          const customerAccount = await prisma.account.create({
            data: {
              subgroupId: receivablesSubgroup.id,
              code: accountCode,
              name: name,
              description: `Customer Account: ${name}`,
              openingBalance: 0,
              currentBalance: openingBalance || 0, // Set initial balance if opening balance exists
              status: 'Active',
              canDelete: false,
            },
          });

          // Create journal entry and update balances ONLY if opening balance > 0
          if (openingBalance && openingBalance > 0) {
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
                throw new Error('Capital subgroup (501) not found. Please create accounting structure first.');
              }

              // Create Owner Capital account
              ownerCapitalAccount = await prisma.account.create({
                data: {
                  subgroupId: capitalSubgroup.id,
                  code: '501003',
                  name: 'OWNER CAPITAL',
                  description: 'Owner Capital account for customer opening balances',
                  openingBalance: 0,
                  currentBalance: 0,
                  status: 'Active',
                  canDelete: false,
                },
              });
            }

            // Generate voucher number
            const voucherCount = await prisma.voucher.count();
            const voucherNumber = `JV-${String(voucherCount + 1).padStart(4, '0')}`;

            // Create JV voucher for opening balance
            // For Assets: Debit increases, Credit decreases
            // Customer owes us (Accounts Receivable) = Asset = Debit
            const voucher = await prisma.voucher.create({
              data: {
                voucherNumber,
                type: 'journal',
                date: date ? new Date(date) : new Date(),
                narration: `Customer Opening Balance: ${name} (CUST-${customer.id})`,
                totalDebit: openingBalance,
                totalCredit: openingBalance,
                status: 'posted',
                createdBy: 'System',
                approvedBy: 'System',
                approvedAt: new Date(),
                entries: {
                  create: [
                    {
                      accountId: customerAccount.id,
                      accountName: `${customerAccount.code}-${customerAccount.name}`,
                      description: `Customer Opening Balance: ${name} - ${openingBalance}`,
                      debit: openingBalance, // Asset increases with debit
                      credit: 0,
                      sortOrder: 0,
                    },
                    {
                      accountId: ownerCapitalAccount.id,
                      accountName: `${ownerCapitalAccount.code}-${ownerCapitalAccount.name}`,
                      description: `Customer Opening Balance: ${name} - ${openingBalance}`,
                      debit: 0,
                      credit: openingBalance, // Capital increases with credit
                      sortOrder: 1,
                    },
                  ],
                },
              },
            });

            // Update account balances
            await prisma.account.update({
              where: { id: ownerCapitalAccount.id },
              data: {
                currentBalance: {
                  increment: openingBalance, // Owner Capital increases with credit
                },
              },
            });

            await prisma.account.update({
              where: { id: customerAccount.id },
              data: {
                currentBalance: {
                  increment: openingBalance, // Asset increases with debit
                },
              },
            });

          } else {
            // No opening balance, just create the account
          }
        } else {
        }
      } else {
      }
    } catch (accountError: any) {
      // Don't fail customer creation if account creation fails
    }

    res.status(201).json({ data: customer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      address,
      email,
      cnic,
      contactNo,
      openingBalance,
      date,
      creditLimit,
      status,
      priceType,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        name,
        address: address !== undefined ? address : null,
        email: email !== undefined ? email : null,
        cnic: cnic !== undefined ? cnic : null,
        contactNo: contactNo !== undefined ? contactNo : null,
        openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : undefined,
        date: date !== undefined ? (date ? new Date(date) : null) : undefined,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
        status: status !== undefined ? status : undefined,
        priceType: priceType !== undefined ? priceType : undefined,
      },
    });

    res.json({ data: customer });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', async (req, res) => {
  try {
    await prisma.customer.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Customer deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;

