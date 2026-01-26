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

router.get('/balance-sheet', async (req: Request, res: Response) => {
  try {
    const { period, as_of_date } = req.query;
    
    // Build date filter - get all posted entries up to the as_of_date
    // Parse the date string and set to end of day in UTC to avoid timezone issues
    let asOfDate: Date;
    if (as_of_date) {
      // Parse the date string (format: YYYY-MM-DD)
      const dateParts = (as_of_date as string).split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(dateParts[2], 10);
      // Create date in UTC and set to end of day (23:59:59.999)
      asOfDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    } else {
      asOfDate = new Date();
      asOfDate.setHours(23, 59, 59, 999);
    }
    
    // Query all accounts with their journal lines filtered by date and status
    // Note: MainGroup types are capitalized: 'Asset', 'Liability', 'Equity'
    // IMPORTANT: Include ALL accounts, even inactive ones, to show complete structure
    const assetAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            type: 'Asset',
          },
        },
        // Don't filter by isActive - show all accounts
        // Include all accounts regardless of status
      },
      include: {
        subgroup: {
          include: { 
            mainGroup: true
          },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              entryDate: {
                lte: asOfDate,
              },
            },
          },
          include: {
            journalEntry: true,
          },
        },
        voucherEntries: {
          where: {
            voucher: {
              status: 'posted',
              date: {
                lte: asOfDate,
              },
            },
          },
          include: {
            voucher: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });
    
    
    // Log all asset accounts by subgroup for debugging
    const assetAccountsBySubgroup: Record<string, any[]> = {};
    assetAccounts.forEach(acc => {
      const subgroupKey = `${acc.subgroup.code}-${acc.subgroup.name}`;
      if (!assetAccountsBySubgroup[subgroupKey]) {
        assetAccountsBySubgroup[subgroupKey] = [];
      }
      assetAccountsBySubgroup[subgroupKey].push(acc);
    });
    Object.entries(assetAccountsBySubgroup).forEach(([sg, accounts]) => {
    });
    
    const liabilityAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            type: 'Liability',
          },
        },
        // Don't filter by isActive - show all accounts
      },
      include: {
        subgroup: {
          include: { 
            mainGroup: true
          },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              entryDate: {
                lte: asOfDate,
              },
            },
          },
          include: {
            journalEntry: true,
          },
        },
        voucherEntries: {
          where: {
            voucher: {
              status: 'posted',
              date: {
                lte: asOfDate,
              },
            },
          },
          include: {
            voucher: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });
    
    
    // Log accounts with voucher entries for debugging
    liabilityAccounts.forEach(acc => {
      if (acc.voucherEntries && acc.voucherEntries.length > 0) {
        acc.voucherEntries.forEach(ve => {
        });
      }
    });
    
    const equityAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            type: 'Equity',
          },
        },
        // Don't filter by isActive - show all accounts
      },
      include: {
        subgroup: {
          include: { 
            mainGroup: true
          },
        },
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              entryDate: {
                lte: asOfDate,
              },
            },
          },
          include: {
            journalEntry: true,
          },
        },
        voucherEntries: {
          where: {
            voucher: {
              status: 'posted',
              date: {
                lte: asOfDate,
              },
            },
          },
          include: {
            voucher: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });
    
    
    // Group by Main Group -> Subgroup -> Accounts
    const processAccounts = async (accounts: any[], accountType: string) => {
      // First, get ALL main groups for this account type to ensure we include empty ones
      const mainGroupType = accountType; // 'Asset', 'Liability', or 'Equity'
      const allMainGroups = await prisma.mainGroup.findMany({
        where: {
          type: mainGroupType,
        },
        orderBy: {
          code: 'asc',
        },
      });
      
      
      // Then, get all subgroups for this account type to ensure we include empty ones
      const allSubgroups = await prisma.subgroup.findMany({
        where: {
          mainGroup: {
            type: mainGroupType,
          },
          isActive: true,
        },
        include: {
          mainGroup: true,
        },
        orderBy: {
          code: 'asc',
        },
      });
      
      allSubgroups.forEach(sg => {
        const mainGroupKey = `${sg.mainGroup.code}-${sg.mainGroup.name}`;
        const subgroupKey = `${sg.code}-${sg.name}`;
        if (sg.code === '103') {
        }
      });
      
      // Structure: mainGroup -> subgroup -> accounts
      const byMainGroup: Record<string, Record<string, any[]>> = {};
      
      // Initialize all subgroups (even if they have no accounts)
      allSubgroups.forEach((subgroup) => {
        const mainGroupCode = subgroup.mainGroup.code;
        const mainGroupName = subgroup.mainGroup.name;
        const mainGroupKey = `${mainGroupCode}-${mainGroupName}`;
        const subgroupKey = `${subgroup.code}-${subgroup.name}`;
        
        if (!byMainGroup[mainGroupKey]) {
          byMainGroup[mainGroupKey] = {};
        }
        
        if (!byMainGroup[mainGroupKey][subgroupKey]) {
          byMainGroup[mainGroupKey][subgroupKey] = [];
        }
      });
      
      
      // Process accounts - include ALL accounts, even with zero balances
      accounts.forEach((account) => {
        // Verify account has subgroup and mainGroup
        if (!account.subgroup || !account.subgroup.mainGroup) {
          return;
        }
        
        const mainGroupCode = account.subgroup.mainGroup.code;
        const mainGroupName = account.subgroup.mainGroup.name;
        const mainGroupKey = `${mainGroupCode}-${mainGroupName}`;
        
        const subgroupCode = account.subgroup.code;
        const subgroupName = account.subgroup.name;
        const subgroupKey = `${subgroupCode}-${subgroupName}`;
        
        if (!byMainGroup[mainGroupKey]) {
          byMainGroup[mainGroupKey] = {};
        }
        
        if (!byMainGroup[mainGroupKey][subgroupKey]) {
          byMainGroup[mainGroupKey][subgroupKey] = [];
        }
        
        // Use currentBalance directly for balance sheet - it's already calculated and maintained
        // This is more accurate and faster than recalculating from all transactions
        let balance = account.currentBalance || 0;
        
        // Normalize accountType to lowercase for the calculation function
        const normalizedType = accountType.toLowerCase();
        
        // If currentBalance is null/undefined or 0, fall back to calculating from transactions
        if (balance === 0 && (account.journalLines?.length > 0 || account.voucherEntries?.length > 0)) {
          const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
          const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
          const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
          const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;
          
          const totalDebit = journalDebit + voucherDebit;
          const totalCredit = journalCredit + voucherCredit;
          
          // Calculate balance using proper accounting logic
          balance = calculateAccountBalance(
            account.openingBalance || 0,
            totalDebit,
            totalCredit,
            normalizedType
          );
          
          // Debug logging for accounts with voucher entries
          if (account.voucherEntries && account.voucherEntries.length > 0) {
          }
        } else {
          // Use currentBalance - log for debugging
          if (balance !== 0) {
          }
        }
        
        // For balance sheet display:
        // - Assets (debit normal): show balance as-is (positive = debit balance, negative = credit balance)
        // - Liabilities/Equity (credit normal): 
        //   * Positive balance = credit balance (normal, we owe/have equity) = show as positive
        //   * Negative balance = debit balance (unusual, we're owed) = show as negative
        let displayAmount = balance;
        if (normalizedType === 'asset') {
          // Assets: debit normal, show balance as-is
          displayAmount = balance;
        } else {
          // Liabilities/Equity: credit normal
          // For liabilities/equity, positive balance means credit (normal) - show as positive
          // Negative balance means debit (unusual) - show as negative
          displayAmount = balance; // Keep the sign as-is for liabilities/equity
        }
        
        // Format account name with code: "code-name"
        const accountDisplayName = `${account.code}-${account.name}`;
        
        // Include all accounts, even with zero balances
        // Make sure the subgroup exists in the structure
        if (!byMainGroup[mainGroupKey]) {
          byMainGroup[mainGroupKey] = {};
        }
        if (!byMainGroup[mainGroupKey][subgroupKey]) {
          byMainGroup[mainGroupKey][subgroupKey] = [];
        }
        
        // Always add account, even if balance is zero
        byMainGroup[mainGroupKey][subgroupKey].push({
          name: accountDisplayName,
          amount: displayAmount,
        });
        
      });
      
      
      // Convert to nested structure: Main Group -> Subgroups -> Accounts
      const result: any[] = [];
      
      // Create a map of all subgroups by main group for reference
      const allSubgroupsByMainGroup: Record<string, string[]> = {};
      allSubgroups.forEach(sg => {
        const mainGroupKey = `${sg.mainGroup.code}-${sg.mainGroup.name}`;
        if (!allSubgroupsByMainGroup[mainGroupKey]) {
          allSubgroupsByMainGroup[mainGroupKey] = [];
        }
        const subgroupKey = `${sg.code}-${sg.name}`;
        allSubgroupsByMainGroup[mainGroupKey].push(subgroupKey);
      });
      
      
      // CRITICAL: Initialize all main groups, even if they have no subgroups
      // This ensures main groups like "2-Long Term Assets" are included even if empty
      allMainGroups.forEach(mg => {
        const mainGroupKey = `${mg.code}-${mg.name}`;
        if (!byMainGroup[mainGroupKey]) {
          byMainGroup[mainGroupKey] = {};
        }
        // Initialize empty subgroups array for this main group if it has no subgroups
        if (!allSubgroupsByMainGroup[mainGroupKey]) {
          allSubgroupsByMainGroup[mainGroupKey] = [];
        }
      });
      
      // Log which subgroups were initialized
      Object.entries(byMainGroup).forEach(([mgKey, subgroups]) => {
        const expectedForThisMainGroup = allSubgroupsByMainGroup[mgKey] || [];
        const missing = expectedForThisMainGroup.filter(sg => !Object.keys(subgroups).includes(sg));
        if (missing.length > 0) {
        }
      });
      
      Object.entries(byMainGroup).forEach(([mainGroupKey, subgroups]) => {
        const subgroupItems: any[] = [];
        
        // Get all expected subgroups for this main group
        const expectedSubgroups = allSubgroupsByMainGroup[mainGroupKey] || [];
        const processedSubgroups = new Set<string>();
        
        if (mainGroupKey.includes('Current Assets')) {
        }
        
        // First, add all subgroups that have accounts (or were initialized)
        Object.entries(subgroups).forEach(([subgroupKey, accounts]) => {
          const subgroupTotal = accounts.length > 0 
            ? accounts.reduce((sum, acc) => sum + acc.amount, 0)
            : 0;
          // Sort accounts by code (extract code from "XXXXXX-Name" format)
          const sortedAccounts = accounts.length > 0
            ? [...accounts].sort((a, b) => {
                const codeA = a.name.split('-')[0] || '';
                const codeB = b.name.split('-')[0] || '';
                return codeA.localeCompare(codeB);
              })
            : [];
          
          // Always include subgroup, even if empty
          subgroupItems.push({
            name: subgroupKey,
            items: sortedAccounts,
            total: subgroupTotal,
          });
          
          processedSubgroups.add(subgroupKey);
          if (sortedAccounts.length > 0) {
          }
        });
        
        // Then, add any subgroups that were expected but not processed (empty subgroups)
        // CRITICAL: Always include ALL expected subgroups, even if they have no accounts
        expectedSubgroups.forEach(subgroupKey => {
          if (!processedSubgroups.has(subgroupKey)) {
            // This subgroup exists but has no accounts - add it with empty items
            subgroupItems.push({
              name: subgroupKey,
              items: [],
              total: 0,
            });
          } else {
          }
        });
        
        // Verify all expected subgroups are included
        const finalSubgroupNames = subgroupItems.map(sg => sg.name);
        const missingSubgroups = expectedSubgroups.filter(sg => !finalSubgroupNames.includes(sg));
        if (missingSubgroups.length > 0) {
          // Force add missing subgroups
          missingSubgroups.forEach(subgroupKey => {
            subgroupItems.push({
              name: subgroupKey,
              items: [],
              total: 0,
            });
          });
        }
        
        // Sort subgroups by code (extract code from "XXX-Name" format)
        subgroupItems.sort((a, b) => {
          const codeA = a.name.split('-')[0];
          const codeB = b.name.split('-')[0];
          return codeA.localeCompare(codeB);
        });
        
        // FINAL VERIFICATION: Ensure ALL expected subgroups are included
        const finalSubgroupNamesAfterSort = subgroupItems.map(sg => sg.name);
        const stillMissing = expectedSubgroups.filter(sg => !finalSubgroupNamesAfterSort.includes(sg));
        if (stillMissing.length > 0) {
          // Force add them before sorting
          stillMissing.forEach(subgroupKey => {
            subgroupItems.push({
              name: subgroupKey,
              items: [],
              total: 0,
            });
          });
          // Re-sort after adding missing subgroups
          subgroupItems.sort((a, b) => {
            const codeA = a.name.split('-')[0];
            const codeB = b.name.split('-')[0];
            return codeA.localeCompare(codeB);
          });
        }
        
        
        const mainGroupTotal = subgroupItems.reduce((sum, sg) => sum + (sg.total || 0), 0);
        
        result.push({
          name: mainGroupKey,
          items: subgroupItems,
          total: mainGroupTotal,
        });
      });
      
      // CRITICAL: Ensure ALL main groups are included, even if they have no data
      // Add any main groups that weren't processed (empty main groups with no subgroups)
      const processedMainGroupKeys = new Set(result.map(mg => mg.name));
      allMainGroups.forEach(mg => {
        const mainGroupKey = `${mg.code}-${mg.name}`;
        if (!processedMainGroupKeys.has(mainGroupKey)) {
          // This main group exists but has no subgroups - add it as empty
          result.push({
            name: mainGroupKey,
            items: [],
            total: 0,
          });
        }
      });
      
      // Sort main groups by code (extract code from "X-Name" format)
      result.sort((a, b) => {
        const codeA = a.name.split('-')[0];
        const codeB = b.name.split('-')[0];
        return codeA.localeCompare(codeB);
      });
      
      result.forEach((mg: any, idx: number) => {
        mg.items.forEach((sg: any, sgIdx: number) => {
        });
      });
      
      return result;
    };
    
    const assetsResult = await processAccounts(assetAccounts, 'Asset');
    const liabilitiesResult = await processAccounts(liabilityAccounts, 'Liability');
    const equityResult = await processAccounts(equityAccounts, 'Equity');
    
    // Calculate Net Income from Revenue and Expense accounts up to the date
    const revenueAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            type: 'Revenue',
          },
        },
      },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              entryDate: {
                lte: asOfDate,
              },
            },
          },
        },
        voucherEntries: {
          where: {
            voucher: {
              status: 'posted',
              date: {
                lte: asOfDate,
              },
            },
          },
        },
      },
    });
    
    const expenseAccounts = await prisma.account.findMany({
      where: {
        subgroup: {
          mainGroup: {
            type: { in: ['Expense', 'Cost'] },
          },
        },
      },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'posted',
              entryDate: {
                lte: asOfDate,
              },
            },
          },
        },
        voucherEntries: {
          where: {
            voucher: {
              status: 'posted',
              date: {
                lte: asOfDate,
              },
            },
          },
        },
      },
    });
    
    // Calculate total revenue (Revenue accounts: credit normal, so credits - debits)
    // Use currentBalance if available, otherwise calculate from transactions
    let totalRevenue = 0;
    revenueAccounts.forEach(account => {
      let revenue = account.currentBalance || 0;
      
      // If currentBalance is 0 but has transactions, calculate it
      if (revenue === 0 && (account.journalLines?.length > 0 || account.voucherEntries?.length > 0)) {
        const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
        const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
        const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
        const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;
        const totalDebit = journalDebit + voucherDebit;
        const totalCredit = journalCredit + voucherCredit;
        // Revenue: credits - debits (credit normal)
        revenue = (account.openingBalance || 0) + totalCredit - totalDebit;
      }
      
      totalRevenue += revenue > 0 ? revenue : 0;
    });
    
    // Calculate total expenses (Expense/Cost accounts: debit normal, so debits - credits)
    // Use currentBalance if available, otherwise calculate from transactions
    let totalExpenses = 0;
    expenseAccounts.forEach(account => {
      let expense = account.currentBalance || 0;
      
      // If currentBalance is 0 but has transactions, calculate it
      if (expense === 0 && (account.journalLines?.length > 0 || account.voucherEntries?.length > 0)) {
        const journalDebit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
        const journalCredit = account.journalLines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || 0;
        const voucherDebit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) || 0;
        const voucherCredit = account.voucherEntries?.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) || 0;
        const totalDebit = journalDebit + voucherDebit;
        const totalCredit = journalCredit + voucherCredit;
        // Expense/Cost: debits - credits (debit normal)
        expense = (account.openingBalance || 0) + totalDebit - totalCredit;
      }
      
      totalExpenses += expense > 0 ? expense : 0;
    });
    
    // Net Income = Revenues - Expenses
    const netIncome = totalRevenue - totalExpenses;
    
    // Calculate totals for response
    const totalAssets = assetsResult.reduce((sum, mg) => sum + (mg.total || 0), 0);
    const totalLiabilities = liabilitiesResult.reduce((sum, mg) => sum + (mg.total || 0), 0);
    const totalEquity = equityResult.reduce((sum, mg) => sum + (mg.total || 0), 0);
    const totalCapital = totalEquity + netIncome;
    const totalLiabilitiesAndCapital = totalLiabilities + totalCapital;
    
    
    res.json({
      assets: assetsResult,
      liabilities: liabilitiesResult,
      equity: equityResult,
      netIncome,
      totals: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalCapital,
        totalLiabilitiesAndCapital,
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


