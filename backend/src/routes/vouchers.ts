import express, { Request, Response } from 'express';
import prisma from '../config/database';

const router = express.Router();

function normalizeVoucherTypeFilter(typeParam: unknown): string | undefined {
  if (typeParam === undefined || typeParam === null) return undefined;
  const raw = String(typeParam).trim();
  if (!raw || raw.toLowerCase() === 'all') return undefined;

  // Compatibility mapping: frontend may send numeric voucher type ids.
  // DB stores voucher.type as strings ("payment" | "receipt" | "journal" | ...).
  const numericMap: Record<string, string> = {
    '1': 'payment',
    '2': 'receipt',
    '3': 'journal',
  };
  if (Object.prototype.hasOwnProperty.call(numericMap, raw)) {
    return numericMap[raw];
  }

  // String types (e.g. "payment", "receipt", "journal", "contra", ...)
  return raw;
}

// Get all vouchers
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status, from_date, to_date, search, page = '1', limit = '100' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    const normalizedType = normalizeVoucherTypeFilter(type);
    if (normalizedType) {
      where.type = normalizedType;
    }

    if (status && status !== 'all') {
      where.status = status as string;
    }

    if (from_date || to_date) {
      where.date = {};
      if (from_date) where.date.gte = new Date(from_date as string);
      if (to_date) where.date.lte = new Date(to_date as string);
    }

    if (search) {
      // SQLite doesn't support case-insensitive mode, so we use contains directly
      where.OR = [
        { voucherNumber: { contains: search as string } },
        { narration: { contains: search as string } },
      ];
    }

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: {
          entries: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.voucher.count({ where }),
    ]);

    // Transform vouchers to match frontend format
    const transformedVouchers = vouchers.map((voucher) => ({
      id: voucher.id,
      voucherNumber: voucher.voucherNumber,
      type: voucher.type,
      date: voucher.date.toISOString().split('T')[0],
      narration: voucher.narration || '',
      cashBankAccount: voucher.cashBankAccount || '',
      chequeNumber: voucher.chequeNumber || undefined,
      chequeDate: voucher.chequeDate ? voucher.chequeDate.toISOString().split('T')[0] : undefined,
      entries: voucher.entries.map((entry) => ({
        id: entry.id,
        account: entry.accountName,
        description: entry.description || '',
        debit: entry.debit,
        credit: entry.credit,
      })),
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
      status: voucher.status,
      createdAt: voucher.createdAt.toISOString(),
    }));

    res.json({
      data: transformedVouchers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single voucher by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    res.json({
      data: {
        id: voucher.id,
        voucherNumber: voucher.voucherNumber,
        type: voucher.type,
        date: voucher.date.toISOString().split('T')[0],
        narration: voucher.narration || '',
        cashBankAccount: voucher.cashBankAccount || '',
        chequeNumber: voucher.chequeNumber || undefined,
        chequeDate: voucher.chequeDate ? voucher.chequeDate.toISOString().split('T')[0] : undefined,
        entries: voucher.entries.map((entry) => ({
          id: entry.id,
          account: entry.accountName,
          description: entry.description || '',
          debit: entry.debit,
          credit: entry.credit,
        })),
        totalDebit: voucher.totalDebit,
        totalCredit: voucher.totalCredit,
        status: voucher.status,
        createdAt: voucher.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching voucher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new voucher
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      voucherNumber,
      type,
      date,
      narration,
      cashBankAccount,
      chequeNumber,
      chequeDate,
      entries,
      totalDebit,
      totalCredit,
      status = 'draft',
      createdBy,
    } = req.body;

    if (!voucherNumber || !type || !date) {
      return res.status(400).json({ error: 'Voucher number, type, and date are required' });
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'At least one entry is required' });
    }

    // Validate debit equals credit
    const calculatedDebit = entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
    const calculatedCredit = entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

    if (Math.abs(calculatedDebit - calculatedCredit) > 0.01) {
      return res.status(400).json({ error: 'Total debit must equal total credit' });
    }

    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        type,
        date: new Date(date),
        narration: narration || null,
        cashBankAccount: cashBankAccount || null,
        chequeNumber: chequeNumber || null,
        chequeDate: chequeDate ? new Date(chequeDate) : null,
        totalDebit: calculatedDebit,
        totalCredit: calculatedCredit,
        status,
        createdBy: createdBy || null,
        entries: {
          create: entries.map((entry: any, index: number) => ({
            accountId: entry.accountId || null,
            accountName: entry.account || entry.accountName || 'Account',
            description: entry.description || null,
            debit: entry.debit || 0,
            credit: entry.credit || 0,
            sortOrder: entry.sortOrder !== undefined ? entry.sortOrder : index,
          })),
        },
      },
      include: {
        entries: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.status(201).json({
      data: {
        id: voucher.id,
        voucherNumber: voucher.voucherNumber,
        type: voucher.type,
        date: voucher.date.toISOString().split('T')[0],
        narration: voucher.narration || '',
        cashBankAccount: voucher.cashBankAccount || '',
        entries: voucher.entries.map((entry) => ({
          id: entry.id,
          account: entry.accountName,
          description: entry.description || '',
          debit: entry.debit,
          credit: entry.credit,
        })),
        totalDebit: voucher.totalDebit,
        totalCredit: voucher.totalCredit,
        status: voucher.status,
        createdAt: voucher.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error creating voucher:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Voucher number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a voucher
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      type,
      date,
      narration,
      cashBankAccount,
      chequeNumber,
      chequeDate,
      entries,
      status,
      approvedBy,
    } = req.body;

    // Check if voucher exists
    const existingVoucher = await prisma.voucher.findUnique({
      where: { id },
    });

    if (!existingVoucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    // If entries are provided, validate and update
    if (entries && Array.isArray(entries)) {
      const calculatedDebit = entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
      const calculatedCredit = entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

      if (Math.abs(calculatedDebit - calculatedCredit) > 0.01) {
        return res.status(400).json({ error: 'Total debit must equal total credit' });
      }

      // Delete existing entries and create new ones
      await prisma.voucherEntry.deleteMany({
        where: { voucherId: id },
      });

      await prisma.voucher.update({
        where: { id },
        data: {
          ...(type && { type }),
          ...(date && { date: new Date(date) }),
          ...(narration !== undefined && { narration: narration || null }),
          ...(cashBankAccount !== undefined && { cashBankAccount: cashBankAccount || null }),
          ...(chequeNumber !== undefined && { chequeNumber: chequeNumber || null }),
          ...(chequeDate !== undefined && { chequeDate: chequeDate ? new Date(chequeDate) : null }),
          totalDebit: calculatedDebit,
          totalCredit: calculatedCredit,
          ...(status && { status }),
          ...(status === 'posted' && approvedBy && {
            approvedBy,
            approvedAt: new Date(),
          }),
          entries: {
            create: entries.map((entry: any, index: number) => ({
              accountId: entry.accountId || null,
              accountName: entry.account || entry.accountName || 'Account',
              description: entry.description || null,
              debit: entry.debit || 0,
              credit: entry.credit || 0,
              sortOrder: entry.sortOrder !== undefined ? entry.sortOrder : index,
            })),
          },
        },
      });
    } else {
      // Update voucher fields only
      await prisma.voucher.update({
        where: { id },
        data: {
          ...(type && { type }),
          ...(date && { date: new Date(date) }),
          ...(narration !== undefined && { narration: narration || null }),
          ...(cashBankAccount !== undefined && { cashBankAccount: cashBankAccount || null }),
          ...(chequeNumber !== undefined && { chequeNumber: chequeNumber || null }),
          ...(chequeDate !== undefined && { chequeDate: chequeDate ? new Date(chequeDate) : null }),
          ...(status && { status }),
          ...(status === 'posted' && approvedBy && {
            approvedBy,
            approvedAt: new Date(),
          }),
        },
      });
    }

    const updatedVoucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json({
      data: {
        id: updatedVoucher!.id,
        voucherNumber: updatedVoucher!.voucherNumber,
        type: updatedVoucher!.type,
        date: updatedVoucher!.date.toISOString().split('T')[0],
        narration: updatedVoucher!.narration || '',
        cashBankAccount: updatedVoucher!.cashBankAccount || '',
        entries: updatedVoucher!.entries.map((entry) => ({
          id: entry.id,
          account: entry.accountName,
          description: entry.description || '',
          debit: entry.debit,
          credit: entry.credit,
        })),
        totalDebit: updatedVoucher!.totalDebit,
        totalCredit: updatedVoucher!.totalCredit,
        status: updatedVoucher!.status,
        createdAt: updatedVoucher!.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error updating voucher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a voucher and reverse account balances
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            account: {
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    // If voucher is posted, reverse account balances before deletion
    if (voucher.status === 'posted' && voucher.entries.length > 0) {
      console.log(`🔄 Reversing account balances for voucher ${voucher.voucherNumber}...`);
      
      for (const entry of voucher.entries) {
        if (!entry.accountId || !entry.account) {
          continue;
        }

        const accountType = entry.account.subgroup.mainGroup.type.toLowerCase();
        let balanceReversal: number;

        // Calculate reversal based on account type
        // Assets/Expenses: Original change = debit - credit, Reverse = credit - debit
        // Liabilities/Equity/Revenue: Original change = credit - debit, Reverse = debit - credit
        if (accountType === 'asset' || accountType === 'expense' || accountType === 'cost') {
          balanceReversal = entry.credit - entry.debit;
        } else {
          balanceReversal = entry.debit - entry.credit;
        }

        // Reverse the balance change
        if (balanceReversal !== 0) {
          await prisma.account.update({
            where: { id: entry.accountId },
            data: {
              currentBalance: {
                decrement: balanceReversal, // Decrement the reversal amount (which reverses the original change)
              },
            },
          });

          console.log(`   ✓ Reversed account ${entry.account.code}-${entry.account.name}: ${balanceReversal > 0 ? '+' : ''}${balanceReversal.toFixed(2)}`);
        }
      }
      
      console.log(`✅ Account balances reversed for voucher ${voucher.voucherNumber}`);
    }

    // Delete related journal entries if they reference this voucher
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          { entryNo: voucher.voucherNumber },
          { description: { contains: voucher.voucherNumber } },
        ],
      },
    });

    if (journalEntries.length > 0) {
      console.log(`🗑️  Deleting ${journalEntries.length} related journal entry(ies)...`);
      
      for (const journalEntry of journalEntries) {
        // Reverse journal entry account balances if posted
        if (journalEntry.status === 'posted') {
          const journalLines = await prisma.journalLine.findMany({
            where: { journalEntryId: journalEntry.id },
            include: {
              account: {
                include: {
                  subgroup: {
                    include: {
                      mainGroup: true,
                    },
                  },
                },
              },
            },
          });

          for (const line of journalLines) {
            const accountType = line.account.subgroup.mainGroup.type.toLowerCase();
            const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
              ? (line.debit - line.credit)
              : (line.credit - line.debit);

            // Reverse the balance change
            await prisma.account.update({
              where: { id: line.accountId },
              data: {
                currentBalance: {
                  decrement: balanceChange,
                },
              },
            });
          }
        }
        
        // Delete journal entry (lines cascade)
        await prisma.journalEntry.delete({
          where: { id: journalEntry.id },
        });
      }
      
      console.log(`✅ Deleted ${journalEntries.length} related journal entry(ies)`);
    }

    // Delete voucher entries (will cascade, but explicit for clarity)
    await prisma.voucherEntry.deleteMany({
      where: { voucherId: id },
    });

    // Delete the voucher
    await prisma.voucher.delete({
      where: { id },
    });

    console.log(`✅ Successfully deleted voucher ${voucher.voucherNumber} and reversed all account balances`);

    res.json({ 
      message: 'Voucher deleted successfully',
      reversedAccounts: voucher.status === 'posted' ? voucher.entries.length : 0,
      deletedJournalEntries: journalEntries.length,
    });
  } catch (error: any) {
    console.error('Error deleting voucher:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

