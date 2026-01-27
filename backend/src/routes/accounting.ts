import express, { Request, Response } from 'express';
import prisma from '../config/database';

const router = express.Router();

// ========== Helper Functions for Accounting Calculations ==========

/**
 * Determines if an account type has a normal DEBIT balance
 * Assets and Expenses have normal DEBIT balances
 */
function isDebitNormal(accountType: string): boolean {
  const type = accountType.toLowerCase();
  return type === 'asset' || type === 'expense' || type === 'cost';
}

/**
 * Calculates account balance based on account type and transactions
 * For DEBIT normal accounts: balance = openingBalance + debits - credits
 * For CREDIT normal accounts: balance = openingBalance + credits - debits
 */
function calculateAccountBalance(
  openingBalance: number,
  totalDebit: number,
  totalCredit: number,
  accountType: string
): number {
  if (isDebitNormal(accountType)) {
    // Assets and Expenses: increase with debit, decrease with credit
    return openingBalance + totalDebit - totalCredit;
  } else {
    // Liabilities, Equity, Revenue: increase with credit, decrease with debit
    return openingBalance + totalCredit - totalDebit;
  }
}

/**
 * Calculates the balance change for posting journal entries
 * For DEBIT normal: balanceChange = debit - credit
 * For CREDIT normal: balanceChange = credit - debit
 */
function calculateBalanceChange(
  debit: number,
  credit: number,
  accountType: string
): number {
  if (isDebitNormal(accountType)) {
    return debit - credit;
  } else {
    return credit - debit;
  }
}

/**
 * Gets trial balance amounts (debit and credit columns)
 * For DEBIT normal accounts: positive balance = debit, negative = credit
 * For CREDIT normal accounts: positive balance = credit, negative = debit
 */
function getTrialBalanceAmounts(
  balance: number,
  accountType: string
): { debit: number; credit: number } {
  if (isDebitNormal(accountType)) {
    return {
      debit: balance > 0 ? balance : 0,
      credit: balance < 0 ? Math.abs(balance) : 0,
    };
  } else {
    return {
      debit: balance < 0 ? Math.abs(balance) : 0,
      credit: balance > 0 ? balance : 0,
    };
  }
}

// ========== Main Groups ==========
router.get('/main-groups', async (req: Request, res: Response) => {
  try {
    const groups = await prisma.mainGroup.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    res.json(groups);
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/main-groups', async (req: Request, res: Response) => {
  try {
    const { code, name, type, displayOrder } = req.body;
    const group = await prisma.mainGroup.create({
      data: { code, name, type, displayOrder },
    });
    res.json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/main-groups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if this is a fixed main group (codes 1-9 are fixed)
    const existing = await prisma.mainGroup.findUnique({ where: { id } });
    if (existing && ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(existing.code)) {
      return res.status(403).json({ error: 'This main group is fixed and cannot be modified' });
    }

    const { code, name, type, displayOrder } = req.body;
    const group = await prisma.mainGroup.update({
      where: { id },
      data: { code, name, type, displayOrder },
    });
    res.json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/main-groups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if this is a fixed main group (codes 1-9 are fixed)
    const existing = await prisma.mainGroup.findUnique({ where: { id } });
    if (existing && ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(existing.code)) {
      return res.status(403).json({ error: 'This main group is fixed and cannot be deleted' });
    }

    await prisma.mainGroup.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Subgroups ==========
router.get('/subgroups', async (req: Request, res: Response) => {
  try {
    const { mainGroupId, isActive } = req.query;
    const where: any = {};
    if (mainGroupId) where.mainGroupId = mainGroupId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const subgroups = await prisma.subgroup.findMany({
      where,
      include: { mainGroup: true },
      orderBy: { code: 'asc' },
    });
    res.json(subgroups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/subgroups', async (req: Request, res: Response) => {
  try {
    const { mainGroupId, code, name, isActive, canDelete } = req.body;
    const subgroup = await prisma.subgroup.create({
      data: {
        mainGroupId,
        code,
        name,
        isActive: isActive !== undefined ? isActive : true,
        canDelete: canDelete !== undefined ? canDelete : true,
      },
      include: { mainGroup: true },
    });
    res.json(subgroup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/subgroups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { mainGroupId, name, isActive } = req.body;

    // Prevent editing fixed subgroups (codes 101, 102, 103, 104, 301, 302, 304, 501, 701, 801, 901)
    const existingSubgroup = await prisma.subgroup.findUnique({ where: { id } });
    if (existingSubgroup && ['101', '102', '103', '104', '301', '302', '304', '501', '701', '801', '901'].includes(existingSubgroup.code)) {
      return res.status(403).json({ error: 'This subgroup is fixed and cannot be edited' });
    }

    const subgroup = await prisma.subgroup.update({
      where: { id },
      data: { mainGroupId, name, isActive },
      include: { mainGroup: true },
    });
    res.json(subgroup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/subgroups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting fixed subgroups (codes 101, 102, 103, 104, 301, 302, 304, 501, 701, 801, 901)
    const existingSubgroup = await prisma.subgroup.findUnique({ where: { id } });
    if (existingSubgroup && ['101', '102', '103', '104', '301', '302', '304', '501', '701', '801', '901'].includes(existingSubgroup.code)) {
      return res.status(403).json({ error: 'This subgroup is fixed and cannot be deleted' });
    }

    await prisma.subgroup.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Accounts ==========
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const { subgroupId, status, mainGroupId } = req.query;
    const where: any = {};

    // If subgroupId is provided, use it directly (takes precedence)
    // Otherwise, if mainGroupId is provided, filter by mainGroup through subgroup relation
    if (subgroupId) {
      where.subgroupId = subgroupId;
    } else if (mainGroupId) {
      where.subgroup = { mainGroupId };
    }

    if (status) where.status = status;

    const accounts = await prisma.account.findMany({
      where,
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
      },
      orderBy: { code: 'asc' },
    });
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/accounts', async (req: Request, res: Response) => {
  try {
    const { subgroupId, code, name, description, accountType, openingBalance, status } = req.body;

    // Validate account code is provided
    if (!code || String(code).trim() === '') {
      return res.status(400).json({ error: 'Account code is required' });
    }

    // Fetch subgroup to validate code matches
    const subgroup = await prisma.subgroup.findUnique({
      where: { id: subgroupId },
    });

    if (!subgroup) {
      return res.status(400).json({ error: 'Subgroup not found' });
    }

    // Validate that account code starts with subgroup code
    const subgroupCode = String(subgroup.code || '').trim();
    const accountCodeStr = String(code).trim();

    if (!subgroupCode) {
      return res.status(400).json({ error: 'Subgroup does not have a code. Please add a code to the subgroup first.' });
    }

    if (!accountCodeStr.startsWith(subgroupCode)) {
      return res.status(400).json({
        error: `Account code must start with subgroup code "${subgroupCode}". Provided code "${accountCodeStr}" does not match.`
      });
    }

    const account = await prisma.account.create({
      data: {
        subgroupId,
        code,
        name,
        description,
        accountType: accountType || 'regular',
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
        status: status || 'Active',
      },
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
      },
    });
    res.json(account);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Account code already exists. Please use a unique code.' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subgroupId, name, description, status } = req.body;
    const account = await prisma.account.update({
      where: { id },
      data: { subgroupId, name, description, status },
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
      },
    });
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.account.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Journal Entries ==========
router.get('/journal-entries', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { entryNo: { contains: search as string, mode: 'insensitive' } },
        { reference: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: {
              include: {
                subgroup: {
                  include: { mainGroup: true },
                },
              },
            },
          },
          orderBy: { lineOrder: 'asc' },
        },
      },
      orderBy: { entryDate: 'desc' },
    });
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/journal-entries', async (req: Request, res: Response) => {
  try {
    const { entryDate, reference, description, lines, createdBy } = req.body;

    const totalDebit = lines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);

    if (totalDebit !== totalCredit) {
      return res.status(400).json({ error: 'Total debits must equal total credits' });
    }

    // Generate entry number
    const count = await prisma.journalEntry.count();
    const entryNo = `JV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const entry = await prisma.journalEntry.create({
      data: {
        entryNo,
        entryDate: new Date(entryDate),
        reference,
        description,
        totalDebit,
        totalCredit,
        createdBy,
        lines: {
          create: lines.map((line: any, index: number) => ({
            accountId: line.accountId,
            description: line.description,
            debit: line.debit || 0,
            credit: line.credit || 0,
            lineOrder: index,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: {
              include: {
                subgroup: {
                  include: { mainGroup: true },
                },
              },
            },
          },
        },
      },
    });

    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/journal-entries/:id/post', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { postedBy } = req.body;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
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

    if (!entry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    if (entry.status === 'posted') {
      return res.status(400).json({ error: 'Entry already posted' });
    }

    // Update entry status
    const updatedEntry = await prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'posted',
        postedBy,
        postedAt: new Date(),
      },
      include: {
        lines: {
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

    // Update account balances using proper accounting logic
    for (const line of entry.lines) {
      const accountType = line.account.subgroup.mainGroup.type;
      const balanceChange = calculateBalanceChange(
        line.debit,
        line.credit,
        accountType
      );

      await prisma.account.update({
        where: { id: line.accountId },
        data: {
          currentBalance: {
            increment: balanceChange,
          },
        },
      });
    }

    res.json(updatedEntry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== General Journal ==========
router.get('/general-journal', async (req: Request, res: Response) => {
  try {
    const { search_by, search, from_date, to_date, page = '1', limit = '10' } = req.query;

    // Build where clause for journal entries
    const journalWhere: any = {
      status: 'posted', // Only show posted entries
    };

    // Build where clause for vouchers
    const voucherWhere: any = {
      status: 'posted', // Only show posted vouchers
    };

    // Date range filter for both
    if (from_date || to_date) {
      journalWhere.entryDate = {};
      voucherWhere.date = {};
      if (from_date) {
        journalWhere.entryDate.gte = new Date(from_date as string);
        voucherWhere.date.gte = new Date(from_date as string);
      }
      if (to_date) {
        journalWhere.entryDate.lte = new Date(to_date as string);
        voucherWhere.date.lte = new Date(to_date as string);
      }
    }

    // Search filter (SQLite doesn't support case-insensitive mode, so we'll filter in memory)
    let searchFilter: any = null;
    if (search) {
      const searchStr = (search as string).toLowerCase();
      searchFilter = { searchStr, search_by };
    }

    // Get all journal entries with lines
    const entries = await prisma.journalEntry.findMany({
      where: journalWhere,
      include: {
        lines: {
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
          orderBy: { lineOrder: 'asc' },
        },
      },
      orderBy: [
        { entryDate: 'desc' },
        { entryNo: 'desc' },
      ],
    });

    // Get all vouchers with entries
    const vouchers = await prisma.voucher.findMany({
      where: voucherWhere,
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
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [
        { date: 'desc' },
        { voucherNumber: 'desc' },
      ],
    });

    // Flatten entries into individual lines for general journal view
    let journalLines: any[] = [];
    let tId = 1;

    // Process JournalEntry records
    entries.forEach((entry) => {
      entry.lines.forEach((line) => {
        const accountName = line.account ? `${line.account.code}-${line.account.name}` : 'Unknown';
        const description = line.description || entry.description || '';

        // Apply search filter if provided
        if (searchFilter) {
          const { searchStr, search_by } = searchFilter;
          if (search_by === 'voucher') {
            if (!entry.entryNo.toLowerCase().includes(searchStr)) return;
          } else if (search_by === 'account') {
            if (line.account && !line.account.code.toLowerCase().includes(searchStr) &&
              !line.account.name.toLowerCase().includes(searchStr)) return;
          } else if (search_by === 'description') {
            if (!description.toLowerCase().includes(searchStr) &&
              !entry.description?.toLowerCase().includes(searchStr)) return;
          } else {
            // General search
            if (!entry.entryNo.toLowerCase().includes(searchStr) &&
              !(entry.reference?.toLowerCase().includes(searchStr)) &&
              !description.toLowerCase().includes(searchStr) &&
              !accountName.toLowerCase().includes(searchStr)) return;
          }
        }

        journalLines.push({
          id: `je-${entry.id}-${line.id}`,
          tId: tId++,
          voucherNo: entry.entryNo,
          date: entry.entryDate.toISOString().split('T')[0],
          account: accountName,
          description: description,
          debit: line.debit,
          credit: line.credit,
          entryId: entry.id,
          lineId: line.id,
        });
      });
    });

    // Process Voucher records
    vouchers.forEach((voucher) => {
      voucher.entries.forEach((entry) => {
        // Ensure consistent account format: code-name
        let accountName = entry.accountName || 'Unknown';
        if (entry.account) {
          accountName = `${entry.account.code}-${entry.account.name}`;
        } else if (entry.accountName && !entry.accountName.includes('-')) {
          // If accountName doesn't have code prefix, try to find the account
          accountName = entry.accountName;
        }
        const description = entry.description || voucher.narration || '';

        // Apply search filter if provided
        if (searchFilter) {
          const { searchStr, search_by } = searchFilter;
          if (search_by === 'voucher') {
            if (!voucher.voucherNumber.toLowerCase().includes(searchStr)) return;
          } else if (search_by === 'account') {
            if (entry.account && !entry.account.code.toLowerCase().includes(searchStr) &&
              !entry.account.name.toLowerCase().includes(searchStr)) return;
          } else if (search_by === 'description') {
            if (!description.toLowerCase().includes(searchStr) &&
              !voucher.narration?.toLowerCase().includes(searchStr)) return;
          } else {
            // General search
            if (!voucher.voucherNumber.toLowerCase().includes(searchStr) &&
              !description.toLowerCase().includes(searchStr) &&
              !accountName.toLowerCase().includes(searchStr)) return;
          }
        }

        journalLines.push({
          id: `v-${voucher.id}-${entry.id}`,
          tId: tId++,
          voucherNo: voucher.voucherNumber,
          date: voucher.date.toISOString().split('T')[0],
          account: accountName,
          description: description,
          debit: entry.debit,
          credit: entry.credit,
          voucherId: voucher.id,
          entryId: entry.id,
        });
      });
    });

    // Sort combined results by date descending
    journalLines.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.voucherNo.localeCompare(a.voucherNo);
    });

    // Reassign tId after sorting
    journalLines.forEach((line, index) => {
      line.tId = index + 1;
    });

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedLines = journalLines.slice(startIndex, endIndex);

    res.json({
      data: paginatedLines,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: journalLines.length,
        totalPages: Math.ceil(journalLines.length / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== General Ledger ==========
router.get('/general-ledger', async (req: Request, res: Response) => {
  try {
    const { accountCode, type, dateFrom, dateTo } = req.query;

    // Normalize type filter to handle both lowercase and capitalized values
    const typeFilter = type ? (type as string).toLowerCase() : null;
    const typeVariants = typeFilter
      ? [typeFilter, typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)]
      : [];

    const accounts = await prisma.account.findMany({
      where: {
        ...(accountCode && {
          code: { contains: accountCode as string },
        }),
        ...(typeFilter && {
          subgroup: {
            mainGroup: {
              type: { in: typeVariants }, // Match both lowercase and capitalized
            },
          },
        }),
      },
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              ...(dateFrom && { entryDate: { gte: new Date(dateFrom as string) } }),
              ...(dateTo && { entryDate: { lte: new Date(dateTo as string) } }),
            },
          },
          include: {
            journalEntry: true,
          },
          orderBy: {
            journalEntry: { entryDate: 'asc' },
          },
        },
        voucherEntries: {
          where: {
            voucher: {
              status: 'posted',
              ...(dateFrom && { date: { gte: new Date(dateFrom as string) } }),
              ...(dateTo && { date: { lte: new Date(dateTo as string) } }),
            },
          },
          include: {
            voucher: true,
          },
          orderBy: {
            voucher: { date: 'asc' },
          },
        },
      },
    });

    // Calculate running balances using proper accounting logic
    const ledgerAccounts = accounts.map((account) => {
      const accountType = account.subgroup?.mainGroup?.type || '';
      // Normalize account type to lowercase for frontend compatibility
      const normalizedType = accountType.toLowerCase();
      let runningBalance = account.openingBalance;

      // Combine JournalLines and VoucherEntries
      const allTransactions: any[] = [];

      // Add JournalEntry transactions
      (account.journalLines || []).forEach((line: any) => {
        allTransactions.push({
          id: `jl-${line.id}`,
          date: line.journalEntry.entryDate,
          dateStr: line.journalEntry.entryDate.toISOString().split('T')[0],
          journalNo: line.journalEntry.entryNo,
          reference: line.journalEntry.reference || '',
          description: line.description || line.journalEntry.description || '',
          debit: line.debit,
          credit: line.credit,
        });
      });

      // Add Voucher transactions
      (account.voucherEntries || []).forEach((entry: any) => {
        allTransactions.push({
          id: `ve-${entry.id}`,
          date: entry.voucher.date,
          dateStr: entry.voucher.date.toISOString().split('T')[0],
          journalNo: entry.voucher.voucherNumber,
          reference: entry.voucher.narration || '',
          description: entry.description || entry.voucher.narration || '',
          debit: entry.debit,
          credit: entry.credit,
        });
      });

      // Sort combined transactions by date
      allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate running balance
      const transactions = allTransactions.map((txn: any) => {
        const balanceChange = calculateBalanceChange(
          txn.debit,
          txn.credit,
          accountType
        );
        runningBalance += balanceChange;

        return {
          id: txn.id,
          date: txn.dateStr,
          journalNo: txn.journalNo,
          reference: txn.reference,
          description: txn.description,
          debit: txn.debit,
          credit: txn.credit,
          balance: runningBalance,
        };
      });

      return {
        code: account.code,
        name: account.name,
        type: normalizedType, // Use normalized lowercase type for frontend filter compatibility
        openingBalance: account.openingBalance,
        currentBalance: runningBalance,
        transactions,
      };
    });

    res.json(ledgerAccounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Trial Balance ==========
router.get('/trial-balance', async (req: Request, res: Response) => {
  try {
    const { period, type, from_date, to_date } = req.query;

    // Build date filter if provided
    let dateFilter: any = {};
    if (from_date || to_date) {
      dateFilter.entryDate = {};
      if (from_date) {
        dateFilter.entryDate.gte = new Date(from_date as string);
      }
      if (to_date) {
        dateFilter.entryDate.lte = new Date(to_date as string);
      }
    }

    // Build date filter for vouchers
    let voucherDateFilter: any = {};
    if (from_date || to_date) {
      voucherDateFilter.date = {};
      if (from_date) {
        voucherDateFilter.date.gte = new Date(from_date as string);
      }
      if (to_date) {
        voucherDateFilter.date.lte = new Date(to_date as string);
      }
    }


    const accounts = await prisma.account.findMany({
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              ...dateFilter,
            },
          },
        },
        voucherEntries: {
          where: {
            voucher: {
              status: 'posted',
              ...voucherDateFilter,
            },
          },
        },
      },
      orderBy: [
        {
          subgroup: {
            mainGroup: {
              displayOrder: 'asc',
            },
          },
        },
        {
          code: 'asc',
        },
      ],
    });


    // Group accounts by main group and subgroup
    const groupedData: any[] = [];
    let currentMainGroup: any = null;
    let currentSubgroup: any = null;

    accounts.forEach((account) => {
      const accountType = account.subgroup.mainGroup.type;
      // Combine debits/credits from both JournalLines and VoucherEntries
      const journalDebit = account.journalLines.reduce((sum, line) => sum + line.debit, 0);
      const journalCredit = account.journalLines.reduce((sum, line) => sum + line.credit, 0);
      const voucherDebit = account.voucherEntries?.reduce((sum, entry) => sum + entry.debit, 0) || 0;
      const voucherCredit = account.voucherEntries?.reduce((sum, entry) => sum + entry.credit, 0) || 0;

      // Debug logging for accounts with voucher entries
      if (account.voucherEntries && account.voucherEntries.length > 0) {
      }

      const totalDebit = journalDebit + voucherDebit;
      const totalCredit = journalCredit + voucherCredit;

      // Calculate balance using proper accounting logic
      const balance = calculateAccountBalance(
        account.openingBalance,
        totalDebit,
        totalCredit,
        accountType
      );

      // Get trial balance amounts (debit/credit columns)
      const { debit, credit } = getTrialBalanceAmounts(balance, accountType);

      // Filter by type if specified
      if (type && type !== 'all') {
        if (accountType.toLowerCase() !== (type as string).toLowerCase()) {
          return;
        }
      }

      const mainGroupCode = account.subgroup.mainGroup.code;
      const mainGroupName = account.subgroup.mainGroup.name;
      const subgroupCode = account.subgroup.code;
      const subgroupName = account.subgroup.name;

      // Add main group header if changed
      if (!currentMainGroup || currentMainGroup.code !== mainGroupCode) {
        currentMainGroup = { code: mainGroupCode, name: mainGroupName };
        groupedData.push({
          type: 'mainGroup',
          code: mainGroupCode,
          name: `${mainGroupCode}-${mainGroupName}`,
          debit: 0,
          credit: 0,
        });
      }

      // Add subgroup header if changed
      if (!currentSubgroup || currentSubgroup.code !== subgroupCode) {
        currentSubgroup = { code: subgroupCode, name: subgroupName };
        groupedData.push({
          type: 'subgroup',
          code: subgroupCode,
          name: `${subgroupCode}-${subgroupName}`,
          debit: 0,
          credit: 0,
        });
      }

      // Add account (include all accounts, even with zero balances)
      groupedData.push({
        type: 'account',
        accountCode: account.code,
        accountName: `${account.code}-${account.name}`,
        accountType: accountType,
        debit,
        credit,
      });
    });

    // Calculate totals for validation
    const calculatedTotalDebit = groupedData
      .filter((item: any) => item.type === 'account')
      .reduce((sum: number, item: any) => sum + (item.debit || 0), 0);
    const calculatedTotalCredit = groupedData
      .filter((item: any) => item.type === 'account')
      .reduce((sum: number, item: any) => sum + (item.credit || 0), 0);

    // Validate that all journal entries and vouchers are balanced
    const dateFilterForValidation: any = {};
    if (to_date) {
      dateFilterForValidation.lte = new Date(to_date as string);
    }

    const allJournalEntries = await prisma.journalEntry.findMany({
      where: {
        status: 'posted',
        ...(Object.keys(dateFilterForValidation).length > 0 && { entryDate: dateFilterForValidation }),
      },
      select: {
        totalDebit: true,
        totalCredit: true,
        entryNo: true,
        entryDate: true,
      },
    });

    const unbalancedJournalEntries = allJournalEntries.filter(
      (entry) => Math.abs(entry.totalDebit - entry.totalCredit) > 0.01
    );

    const allVouchers = await prisma.voucher.findMany({
      where: {
        status: 'posted',
        ...(Object.keys(dateFilterForValidation).length > 0 && { date: dateFilterForValidation }),
      },
      select: {
        totalDebit: true,
        totalCredit: true,
        voucherNumber: true,
        date: true,
      },
    });

    const unbalancedVouchers = allVouchers.filter(
      (voucher) => Math.abs(voucher.totalDebit - voucher.totalCredit) > 0.01
    );

    // Check opening balances
    const totalOpeningDebit = accounts.reduce((sum, acc) => {
      const accountType = acc.subgroup.mainGroup.type.toLowerCase();
      if (isDebitNormal(accountType)) {
        return sum + (acc.openingBalance || 0);
      }
      return sum;
    }, 0);

    const totalOpeningCredit = accounts.reduce((sum, acc) => {
      const accountType = acc.subgroup.mainGroup.type.toLowerCase();
      if (!isDebitNormal(accountType)) {
        return sum + (acc.openingBalance || 0);
      }
      return sum;
    }, 0);

    const openingBalanceDifference = Math.abs(totalOpeningDebit - totalOpeningCredit);

    if (unbalancedJournalEntries.length > 0 || unbalancedVouchers.length > 0) {
      if (unbalancedJournalEntries.length > 0) {
      }
      if (unbalancedVouchers.length > 0) {
      }
    }


    res.json(groupedData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Financial Statements ==========
router.get('/income-statement', async (req: Request, res: Response) => {
  try {
    const { period, from_date, to_date } = req.query;

    // Build date filter if provided
    let dateFilter: any = {};
    if (from_date || to_date) {
      dateFilter.entryDate = {};
      if (from_date) {
        dateFilter.entryDate.gte = new Date(from_date as string);
      }
      if (to_date) {
        dateFilter.entryDate.lte = new Date(to_date as string);
      }
    }

    const revenueAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            type: { in: ['Revenue', 'revenue', 'REVENUE'] },
          },
        },
      },
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              ...dateFilter,
            },
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    // Separate cost accounts from expense accounts
    // NOTE: Cost main group has type "Expense" in database, so we filter by name instead
    const costAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            name: 'Cost', // Filter by main group name since type is "Expense"
          },
        },
      },
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              ...dateFilter,
            },
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    // Expense accounts: type is "Expense" but exclude "Cost" main group (it's handled separately)
    const expenseAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            type: { in: ['Expense', 'expense', 'EXPENSE'] },
            name: { not: 'Cost' }, // Exclude Cost main group
          },
        },
      },
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              ...dateFilter,
            },
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    // Group by subgroup
    const revenueCategories: any[] = [];
    const costCategories: any[] = [];
    const expenseCategories: any[] = [];

    // Process revenues (Revenue accounts: normal balance is CREDIT)
    // Revenue = openingBalance + credits - debits
    const revenueBySubgroup: Record<string, any[]> = {};
    revenueAccounts.forEach((account) => {
      const subGroupName = account.subgroup.name;
      if (!revenueBySubgroup[subGroupName]) {
        revenueBySubgroup[subGroupName] = [];
      }
      const totalDebit = account.journalLines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.journalLines.reduce((sum, line) => sum + line.credit, 0);

      // Revenue balance: openingBalance + credits - debits
      const revenueAmount = calculateAccountBalance(
        account.openingBalance,
        totalDebit,
        totalCredit,
        'revenue'
      );

      revenueBySubgroup[subGroupName].push({
        name: `${account.code}-${account.name}`,
        amount: revenueAmount > 0 ? revenueAmount : 0,
      });
    });

    Object.entries(revenueBySubgroup).forEach(([name, items]) => {
      revenueCategories.push({ name, items });
    });

    // Process costs (Cost accounts: normal balance is DEBIT)
    // Cost = openingBalance + debits - credits
    const costBySubgroup: Record<string, any[]> = {};
    costAccounts.forEach((account) => {
      const subGroupName = account.subgroup.name;
      if (!costBySubgroup[subGroupName]) {
        costBySubgroup[subGroupName] = [];
      }
      const totalDebit = account.journalLines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.journalLines.reduce((sum, line) => sum + line.credit, 0);

      // Cost balance: openingBalance + debits - credits
      const costAmount = calculateAccountBalance(
        account.openingBalance,
        totalDebit,
        totalCredit,
        'cost'
      );

      costBySubgroup[subGroupName].push({
        name: `${account.code}-${account.name}`,
        amount: costAmount > 0 ? costAmount : 0,
      });
    });

    Object.entries(costBySubgroup).forEach(([name, items]) => {
      costCategories.push({ name, items });
    });

    // Process expenses (Expense accounts: normal balance is DEBIT)
    // Expense = openingBalance + debits - credits
    const expenseBySubgroup: Record<string, any[]> = {};
    expenseAccounts.forEach((account) => {
      const subGroupName = account.subgroup.name;
      if (!expenseBySubgroup[subGroupName]) {
        expenseBySubgroup[subGroupName] = [];
      }
      const totalDebit = account.journalLines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.journalLines.reduce((sum, line) => sum + line.credit, 0);

      // Expense balance: openingBalance + debits - credits
      const expenseAmount = calculateAccountBalance(
        account.openingBalance,
        totalDebit,
        totalCredit,
        'expense'
      );

      expenseBySubgroup[subGroupName].push({
        name: `${account.code}-${account.name}`,
        amount: expenseAmount > 0 ? expenseAmount : 0,
      });
    });

    Object.entries(expenseBySubgroup).forEach(([name, items]) => {
      expenseCategories.push({ name, items });
    });

    res.json({
      revenue: revenueCategories,
      cost: costCategories,
      expenses: expenseCategories
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Recalculate All Account Balances ==========
router.post('/recalculate-balances', async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        subgroup: {
          include: {
            mainGroup: true,
          },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
            },
          },
        },
      },
    });

    // Recalculate all account balances from scratch
    for (const account of accounts) {
      const accountType = account.subgroup.mainGroup.type;
      const totalDebit = account.journalLines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.journalLines.reduce((sum, line) => sum + line.credit, 0);

      const calculatedBalance = calculateAccountBalance(
        account.openingBalance,
        totalDebit,
        totalCredit,
        accountType
      );

      await prisma.account.update({
        where: { id: account.id },
        data: {
          currentBalance: calculatedBalance,
        },
      });
    }

    res.json({
      success: true,
      message: `Recalculated balances for ${accounts.length} accounts`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Balance Sheet
router.get('/balance-sheet', async (req: Request, res: Response) => {
  console.log('=== BALANCE SHEET ENDPOINT CALLED ===');
  console.log('Query params:', req.query);
  try {
    // Accept both 'date' and 'as_of_date' parameters for compatibility
    const dateParam = (req.query.date || req.query.as_of_date) as string;

    if (!dateParam) {
      console.log('ERROR: No date parameter');
      return res.status(400).json({ error: 'Date parameter is required (use "date" or "as_of_date")' });
    }

    // Parse date (format: DD/MM/YY or YYYY-MM-DD)
    let asOfDate: Date;
    if (typeof dateParam === 'string') {
      // Try DD/MM/YY format first (autohub format)
      if (dateParam.includes('/')) {
        const parts = dateParam.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
          const year = parseInt(parts[2], 10);
          // Handle 2-digit year
          const fullYear = year < 100 ? 2000 + year : year;
          asOfDate = new Date(Date.UTC(fullYear, month, day, 23, 59, 59, 999));
        } else {
          asOfDate = new Date(dateParam);
          asOfDate.setHours(23, 59, 59, 999);
        }
      } else {
        // YYYY-MM-DD format
        const dateParts = dateParam.split('-');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const day = parseInt(dateParts[2], 10);
          asOfDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
        } else {
          // Try parsing as-is
          asOfDate = new Date(dateParam);
          asOfDate.setHours(23, 59, 59, 999);
        }
      }
    } else {
      asOfDate = new Date();
      asOfDate.setHours(23, 59, 59, 999);
    }

    console.log('Parsed date:', dateParam, '->', asOfDate.toISOString());

    // Get Assets (MainGroup type = 'Asset')
    // First get all accounts, then fetch their transactions separately to avoid filtering issues
    const assetMainGroups = await prisma.mainGroup.findMany({
      where: { type: 'Asset' },
      include: {
        subgroups: {
          where: { isActive: true },
          include: {
            accounts: {
              include: {
                journalLines: {
                  where: {
                    journalEntry: {
                      status: 'posted',
                      entryDate: { lte: asOfDate },
                    },
                  },
                },
                voucherEntries: {
                  where: {
                    voucher: {
                      status: 'posted',
                      date: { lte: asOfDate },
                    },
                  },
                },
              },
            },
          },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    console.log('=== BALANCE SHEET DEBUG ===');
    console.log('Asset MainGroups found:', assetMainGroups.length);
    if (assetMainGroups.length > 0) {
      console.log('First MainGroup:', assetMainGroups[0].code, assetMainGroups[0].name);
      console.log('Subgroups:', assetMainGroups[0].subgroups.length);
      if (assetMainGroups[0].subgroups.length > 0) {
        console.log('First Subgroup accounts:', assetMainGroups[0].subgroups[0].accounts.length);
      }
    }

    console.log('Balance Sheet Debug - Asset MainGroups:', assetMainGroups.length);
    assetMainGroups.forEach((mg, idx) => {
      console.log(`MainGroup ${idx}:`, mg.code, mg.name, 'Subgroups:', mg.subgroups.length);
      mg.subgroups.forEach((sg, sgIdx) => {
        console.log(`  Subgroup ${sgIdx}:`, sg.code, sg.name, 'Accounts:', sg.accounts.length);
        if (sg.accounts.length > 0) {
          const acc = sg.accounts[0];
          console.log(`    First Account:`, acc.code, acc.name, 'VoucherEntries:', acc.voucherEntries?.length || 0, 'JournalLines:', acc.journalLines?.length || 0);
        }
      });
    });

    // Process Assets: Calculate balances for each account
    const assets = assetMainGroups.map(mainGroup => {
      const subgroups = mainGroup.subgroups.map(subgroup => {
        // Ensure we process all accounts, even if they have no transactions
        const accounts = (subgroup.accounts || []).map(account => {
          const accountType = mainGroup.type.toLowerCase();
          const normalizedType = accountType;

          // Calculate balance from transactions (matching autohub: SUM(debit) - SUM(credit))
          const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
          const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
          const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
          const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;

          const totalDebit = journalDebit + voucherDebit;
          const totalCredit = journalCredit + voucherCredit;

          // Calculate balance: openingBalance + (debit - credit) for assets
          // This matches autohub's balance calculation: SUM(debit) - SUM(credit)
          const balance = (account.openingBalance || 0) + totalDebit - totalCredit;

          return {
            id: account.id,
            code: account.code,
            name: account.name,
            balance: {
              balance: balance,
            },
          };
        }); // Include all accounts, even with zero balance (frontend will filter)

        return {
          id: subgroup.id,
          code: subgroup.code,
          name: subgroup.name,
          coa_accounts: accounts,
        };
      });

      // Always return mainGroup, even if empty
      return {
        id: mainGroup.id,
        code: mainGroup.code,
        name: mainGroup.name,
        non_depreciation_sub_groups: subgroups,
      };
    });

    // Get Liabilities (MainGroup type = 'Liability')
    const liabilityMainGroups = await prisma.mainGroup.findMany({
      where: { type: 'Liability' },
      include: {
        subgroups: {
          where: { isActive: true },
          include: {
            accounts: {
              include: {
                journalLines: {
                  where: {
                    journalEntry: {
                      status: 'posted',
                      entryDate: { lte: asOfDate },
                    },
                  },
                },
                voucherEntries: {
                  where: {
                    voucher: {
                      status: 'posted',
                      date: { lte: asOfDate },
                    },
                  },
                },
              },
            },
          },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Process Liabilities
    const liabilities = liabilityMainGroups.map(mainGroup => {
      const subgroups = mainGroup.subgroups.map(subgroup => {
        const accounts = subgroup.accounts.map(account => {
          const accountType = mainGroup.type.toLowerCase();
          const normalizedType = accountType;

          const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
          const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
          const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
          const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;

          const totalDebit = journalDebit + voucherDebit;
          const totalCredit = journalCredit + voucherCredit;

          // For liabilities: balance = openingBalance + (debit - credit)
          // Negative balance means credit (normal for liabilities)
          const balance = (account.openingBalance || 0) + totalDebit - totalCredit;

          return {
            id: account.id,
            code: account.code,
            name: account.name,
            balance: {
              balance: balance,
            },
          };
        }); // Include all accounts, even with zero balance

        return {
          id: subgroup.id,
          code: subgroup.code,
          name: subgroup.name,
          coa_accounts: accounts,
        };
      });

      return {
        id: mainGroup.id,
        code: mainGroup.code,
        name: mainGroup.name,
        coa_sub_groups: subgroups,
      };
    });

    // Get Capital (MainGroup type = 'Equity')
    const capitalMainGroups = await prisma.mainGroup.findMany({
      where: { type: 'Equity' },
      include: {
        subgroups: {
          where: { isActive: true },
          include: {
            accounts: {
              include: {
                journalLines: {
                  where: {
                    journalEntry: {
                      status: 'posted',
                      entryDate: { lte: asOfDate },
                    },
                  },
                },
                voucherEntries: {
                  where: {
                    voucher: {
                      status: 'posted',
                      date: { lte: asOfDate },
                    },
                  },
                },
              },
            },
          },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Process Capital
    const capital = capitalMainGroups.map(mainGroup => {
      const subgroups = mainGroup.subgroups.map(subgroup => {
        const accounts = subgroup.accounts.map(account => {
          const accountType = mainGroup.type.toLowerCase();
          const normalizedType = accountType;

          const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
          const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
          const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
          const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;

          const totalDebit = journalDebit + voucherDebit;
          const totalCredit = journalCredit + voucherCredit;

          // For liabilities: balance = openingBalance + (debit - credit)
          // Negative balance means credit (normal for liabilities)
          const balance = (account.openingBalance || 0) + totalDebit - totalCredit;

          return {
            id: account.id,
            code: account.code,
            name: account.name,
            balance: {
              balance: balance,
            },
          };
        }); // Include all accounts, even with zero balance

        return {
          id: subgroup.id,
          code: subgroup.code,
          name: subgroup.name,
          coa_accounts: accounts,
        };
      });

      return {
        id: mainGroup.id,
        code: mainGroup.code,
        name: mainGroup.name,
        coa_sub_groups: subgroups,
      };
    });

    // Calculate Net Income from Revenue, Expense, and Cost
    // Get Revenue accounts
    const revenueMainGroups = await prisma.mainGroup.findMany({
      where: { type: 'Revenue' },
      include: {
        subgroups: {
          where: { isActive: true },
          include: {
            accounts: {
              include: {
                journalLines: {
                  where: {
                    journalEntry: {
                      status: 'posted',
                      entryDate: { lte: asOfDate },
                    },
                  },
                },
                voucherEntries: {
                  where: {
                    voucher: {
                      status: 'posted',
                      date: { lte: asOfDate },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    let revenueSum = 0;
    revenueMainGroups.forEach(mainGroup => {
      mainGroup.subgroups.forEach(subgroup => {
        subgroup.accounts.forEach(account => {
          const accountType = 'revenue';
          const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
          const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
          const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
          const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;

          const totalDebit = journalDebit + voucherDebit;
          const totalCredit = journalCredit + voucherCredit;

          // Revenue balance: openingBalance + (debit - credit)
          // For revenue (credit normal), negative balance means credit (normal)
          const balance = (account.openingBalance || 0) + totalDebit - totalCredit;
          const absBalance = Math.abs(balance);

          // Check if it's a discount account
          if (account.name && account.name.includes('Discount')) {
            revenueSum -= absBalance; // Subtract discounts
          } else {
            revenueSum += absBalance; // Add revenue
          }
        });
      });
    });

    // Get Expense accounts
    const expenseMainGroups = await prisma.mainGroup.findMany({
      where: { type: 'Expense' },
      include: {
        subgroups: {
          where: { isActive: true },
          include: {
            accounts: {
              include: {
                journalLines: {
                  where: {
                    journalEntry: {
                      status: 'posted',
                      entryDate: { lte: asOfDate },
                    },
                  },
                },
                voucherEntries: {
                  where: {
                    voucher: {
                      status: 'posted',
                      date: { lte: asOfDate },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    let expenseSum = 0;
    expenseMainGroups.forEach(mainGroup => {
      mainGroup.subgroups.forEach(subgroup => {
        subgroup.accounts.forEach(account => {
          const accountType = 'expense';
          const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
          const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
          const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
          const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;

          const totalDebit = journalDebit + voucherDebit;
          const totalCredit = journalCredit + voucherCredit;

          // Expense balance: openingBalance + (debit - credit)
          const balance = (account.openingBalance || 0) + totalDebit - totalCredit;
          expenseSum += Math.abs(balance);
        });
      });
    });

    // Get Cost accounts
    const costMainGroups = await prisma.mainGroup.findMany({
      where: { type: 'Cost' },
      include: {
        subgroups: {
          where: { isActive: true },
          include: {
            accounts: {
              include: {
                journalLines: {
                  where: {
                    journalEntry: {
                      status: 'posted',
                      entryDate: { lte: asOfDate },
                    },
                  },
                },
                voucherEntries: {
                  where: {
                    voucher: {
                      status: 'posted',
                      date: { lte: asOfDate },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    let costSum = 0;
    costMainGroups.forEach(mainGroup => {
      mainGroup.subgroups.forEach(subgroup => {
        subgroup.accounts.forEach(account => {
          const accountType = 'cost';
          const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
          const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
          const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
          const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;

          const totalDebit = journalDebit + voucherDebit;
          const totalCredit = journalCredit + voucherCredit;

          const balance = calculateAccountBalance(
            account.openingBalance || 0,
            totalDebit,
            totalCredit,
            accountType
          );

          costSum += Math.abs(balance);
        });
      });
    });

    // Calculate Net Income: Revenue - Expense - Cost
    const revExp = revenueSum - expenseSum - costSum;

    console.log('Balance Sheet Response - Assets:', assets.length, 'Liabilities:', liabilities.length, 'Capital:', capital.length);
    console.log('Balance Sheet Response - revExp:', revExp, 'Revenue:', revenueSum, 'Expense:', expenseSum, 'Cost:', costSum);

    res.json({
      data: {
        assets,
        liabilities,
        capital,
        revExp,
        revenue: revenueSum,
        expense: expenseSum,
        cost: costSum,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch balance sheet',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;


