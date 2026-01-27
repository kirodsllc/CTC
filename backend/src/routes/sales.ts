import express, { Request, Response } from 'express';
import prisma from '../config/database';

const router = express.Router();

async function getNextNumberForPrefix(args: { prefix: string; voucherType?: string }): Promise<string> {
  const { prefix, voucherType } = args;
  const re = new RegExp(`^${prefix}(\\d+)$`);

  const [lastVoucher, lastJournalEntry] = await Promise.all([
    prisma.voucher.findFirst({
      where: {
        ...(voucherType ? { type: voucherType } : {}),
        voucherNumber: { startsWith: prefix },
      },
      orderBy: { voucherNumber: 'desc' },
      select: { voucherNumber: true },
    }),
    prisma.journalEntry.findFirst({
      where: { entryNo: { startsWith: prefix } },
      orderBy: { entryNo: 'desc' },
      select: { entryNo: true },
    }),
  ]);

  let max = 0;
  for (const v of [lastVoucher?.voucherNumber, lastJournalEntry?.entryNo]) {
    if (!v) continue;
    const m = String(v).match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

// Helper function to calculate stock balance
async function getStockBalance(partId: string): Promise<number> {
  const movements = await prisma.stockMovement.findMany({
    where: { partId },
  });

  const stockIn = movements
    .filter(m => m.type === 'in')
    .reduce((sum, m) => sum + m.quantity, 0);
  const stockOut = movements
    .filter(m => m.type === 'out')
    .reduce((sum, m) => sum + m.quantity, 0);
  
  return stockIn - stockOut;
}

// Helper function to get reserved quantity
async function getReservedQuantity(partId: string): Promise<number> {
  // Check StockMovement with referenceType='stock_reservation' (new method)
  
  const stockMovementReservations = await prisma.stockMovement.findMany({
    where: {
      partId,
      referenceType: 'stock_reservation',
    },
  });
  
  const stockMovementReserved = stockMovementReservations.reduce((sum, r) => sum + r.quantity, 0);
  
  // Always log to help debug - show details of what was found
  if (stockMovementReservations.length > 0) {
    stockMovementReservations.forEach((r, idx) => {
    });
  } else {
  }
  
  // Also check StockReservation table (legacy method, if exists)
  try {
    const reservations = await prisma.stockReservation.findMany({
      where: {
        partId,
        status: 'reserved',
      },
    });
    const stockReservationReserved = reservations.reduce((sum, r) => sum + r.quantity, 0);
    const total = stockMovementReserved + stockReservationReserved;
    if (stockReservationReserved > 0) {
    }
    return total;
  } catch (error) {
    // StockReservation table might not exist, just return StockMovement reservations
    return stockMovementReserved;
  }
}

// Helper function to create journal entry
async function createJournalEntry(
  entryDate: Date,
  reference: string,
  description: string,
  lines: Array<{ accountId: string; description?: string; debit: number; credit: number }>,
  createdBy?: string
) {
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  if (totalDebit !== totalCredit) {
    throw new Error('Total debits must equal total credits');
  }

  const count = await prisma.journalEntry.count();
  const entryNo = `JV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

  const entry = await prisma.journalEntry.create({
    data: {
      entryNo,
      entryDate,
      reference,
      description,
      totalDebit,
      totalCredit,
      createdBy,
      status: 'posted', // Auto-post for sales
      postedBy: createdBy,
      postedAt: new Date(),
      lines: {
        create: lines.map((line, index) => ({
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
          account: true,
        },
      },
    },
  });

  // Update account balances
  for (const line of lines) {
    const account = await prisma.account.findUnique({
      where: { id: line.accountId },
      include: {
        subgroup: {
          include: { mainGroup: true },
        },
      },
    });

    if (account) {
      const accountType = account.subgroup?.mainGroup?.type || '';
      const isDebitNormal = accountType.toLowerCase() === 'asset' || 
                           accountType.toLowerCase() === 'expense' || 
                           accountType.toLowerCase() === 'cost';
      
      const balanceChange = isDebitNormal 
        ? (line.debit || 0) - (line.credit || 0)
        : (line.credit || 0) - (line.debit || 0);

      await prisma.account.update({
        where: { id: line.accountId },
        data: {
          currentBalance: {
            increment: balanceChange,
          },
        },
      });
    }
  }

  return entry;
}

// Helper function to create voucher for sales invoice
async function createVoucherForInvoice(
  invoiceNo: string,
  invoiceDate: Date,
  customerType: string,
  accountId: string | null | undefined,
  grandTotal: number,
  salesPerson?: string
) {
  try {
    // Generate voucher number (format: JV4707)
    const lastVoucher = await prisma.voucher.findFirst({
      where: {
        type: 'journal',
        voucherNumber: {
          startsWith: 'JV',
        },
      },
      orderBy: {
        voucherNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastVoucher) {
      const match = lastVoucher.voucherNumber.match(/^JV(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      } else {
        const voucherCount = await prisma.voucher.count({
          where: { type: 'journal' },
        });
        nextNumber = voucherCount + 1;
      }
    }
    const voucherNumber = `JV${String(nextNumber).padStart(4, '0')}`;

    // Get accounts for voucher entries
    const accountsReceivableAccount = customerType === 'registered'
      ? await prisma.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Accounts Receivable' } },
              { name: { contains: 'Receivable' } },
            ],
            status: 'Active',
          },
        })
      : null;

    const salesRevenueAccount = await prisma.account.findFirst({
      where: {
        name: { contains: 'Sales Revenue' },
        status: 'Active',
      },
    });

    if (!salesRevenueAccount) {
      throw new Error('Sales Revenue account not found');
    }

    // Create voucher entries based on customer type
    const voucherEntries = [];
    
    if (customerType === 'walking' && accountId) {
      // Cash sale - Cash/Bank account (debit) and Sales Revenue (credit)
      const cashAccount = await prisma.account.findUnique({
        where: { id: accountId },
        select: { code: true, name: true },
      });

      voucherEntries.push({
        accountId: accountId,
        accountName: cashAccount ? `${cashAccount.code}-${cashAccount.name}` : 'Cash Account',
        description: `Cash sale - Invoice ${invoiceNo}`,
        debit: grandTotal,
        credit: 0,
        sortOrder: 0,
      });

      voucherEntries.push({
        accountId: salesRevenueAccount.id,
        accountName: `${salesRevenueAccount.code}-${salesRevenueAccount.name}`,
        description: `Sales Revenue - Invoice ${invoiceNo}`,
        debit: 0,
        credit: grandTotal,
        sortOrder: 1,
      });
    } else if (customerType === 'registered' && accountsReceivableAccount) {
      // Party sale - Accounts Receivable (debit) and Sales Revenue (credit)
      voucherEntries.push({
        accountId: accountsReceivableAccount.id,
        accountName: `${accountsReceivableAccount.code}-${accountsReceivableAccount.name}`,
        description: `Receivable - Invoice ${invoiceNo}`,
        debit: grandTotal,
        credit: 0,
        sortOrder: 0,
      });

      voucherEntries.push({
        accountId: salesRevenueAccount.id,
        accountName: `${salesRevenueAccount.code}-${salesRevenueAccount.name}`,
        description: `Sales Revenue - Invoice ${invoiceNo}`,
        debit: 0,
        credit: grandTotal,
        sortOrder: 1,
      });
    } else {
      // Fallback: only sales revenue if accounts not found
      voucherEntries.push({
        accountId: salesRevenueAccount.id,
        accountName: `${salesRevenueAccount.code}-${salesRevenueAccount.name}`,
        description: `Sales Revenue - Invoice ${invoiceNo}`,
        debit: 0,
        credit: grandTotal,
        sortOrder: 0,
      });
    }

    // Extract invoice number for narration
    const invoiceNoDisplay = invoiceNo.replace(/^INV-?/i, '');

    // Create voucher
    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        type: 'journal',
        date: invoiceDate,
        narration: `Sales Invoice Number: ${invoiceNoDisplay}`,
        totalDebit: grandTotal,
        totalCredit: grandTotal,
        status: 'posted',
        createdBy: salesPerson || 'System',
        approvedBy: 'System',
        approvedAt: new Date(),
        entries: {
          create: voucherEntries,
        },
      },
    });

    return voucher;
  } catch (error: any) {
    throw error;
  }
}

// ========== Sales Inquiry Routes ==========

// Get all inquiries
router.get('/inquiries', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { inquiryNo: { contains: search as string } },
        { customerName: { contains: search as string } },
        { subject: { contains: search as string } },
      ];
    }

    const inquiries = await prisma.salesInquiry.findMany({
      where,
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
      orderBy: { inquiryDate: 'desc' },
    });

    res.json(inquiries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get inquiry by ID
router.get('/inquiries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const inquiry = await prisma.salesInquiry.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json(inquiry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create inquiry
router.post('/inquiries', async (req: Request, res: Response) => {
  try {
    const {
      inquiryDate,
      customerName,
      customerEmail,
      customerPhone,
      subject,
      description,
      status,
      items,
    } = req.body;

    // Generate inquiry number
    const count = await prisma.salesInquiry.count();
    const inquiryNo = `INQ-${String(count + 1).padStart(3, '0')}`;

    // Fetch stock and reserved quantities for each item
    const itemsWithStock = await Promise.all(
      items.map(async (item: any) => {
        const stock = await getStockBalance(item.partId);
        const reservedQty = await getReservedQuantity(item.partId);
        
        // Get part details for prices
        const part = await prisma.part.findUnique({
          where: { id: item.partId },
        });

        return {
          partId: item.partId,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice || part?.cost || 0,
          priceA: item.priceA || part?.priceA || 0,
          priceB: item.priceB || part?.priceB || 0,
          priceM: item.priceM || part?.priceM || 0,
          location: item.location || '',
          stock,
          reservedQty,
        };
      })
    );

    const inquiry = await prisma.salesInquiry.create({
      data: {
        inquiryNo,
        inquiryDate: new Date(inquiryDate),
        customerName,
        customerEmail,
        customerPhone,
        subject,
        description,
        status: status || 'New',
        items: {
          create: itemsWithStock,
        },
      },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
    });

    res.json(inquiry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update inquiry
router.put('/inquiries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      inquiryDate,
      customerName,
      customerEmail,
      customerPhone,
      subject,
      description,
      status,
      items,
    } = req.body;

    // Update inquiry
    const inquiry = await prisma.salesInquiry.update({
      where: { id },
      data: {
        inquiryDate: inquiryDate ? new Date(inquiryDate) : undefined,
        customerName,
        customerEmail,
        customerPhone,
        subject,
        description,
        status,
      },
    });

    // Update items if provided
    if (items) {
      // Delete existing items
      await prisma.salesInquiryItem.deleteMany({
        where: { inquiryId: id },
      });

      // Create new items with stock info
      const itemsWithStock = await Promise.all(
        items.map(async (item: any) => {
          const stock = await getStockBalance(item.partId);
          const reservedQty = await getReservedQuantity(item.partId);
          
          const part = await prisma.part.findUnique({
            where: { id: item.partId },
          });

          return {
            partId: item.partId,
            quantity: item.quantity,
            purchasePrice: item.purchasePrice || part?.cost || 0,
            priceA: item.priceA || part?.priceA || 0,
            priceB: item.priceB || part?.priceB || 0,
            priceM: item.priceM || part?.priceM || 0,
            location: item.location || '',
            stock,
            reservedQty,
          };
        })
      );

      await prisma.salesInquiryItem.createMany({
        data: itemsWithStock.map((item: any) => ({
          ...item,
          inquiryId: id,
        })),
      });
    }

    const updatedInquiry = await prisma.salesInquiry.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
    });

    res.json(updatedInquiry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete inquiry
router.delete('/inquiries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.salesInquiry.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Convert inquiry to quotation
router.post('/inquiries/:id/convert-to-quotation', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { validUntil, customerAddress, notes } = req.body;

    const inquiry = await prisma.salesInquiry.findUnique({
      where: { id },
      include: { items: { include: { part: true } } },
    });

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    // Generate quotation number
    const count = await prisma.salesQuotation.count();
    const quotationNo = `SQ-${String(count + 1).padStart(3, '0')}`;

    // Create quotation
    const quotation = await prisma.salesQuotation.create({
      data: {
        quotationNo,
        quotationDate: new Date(),
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        customerName: inquiry.customerName,
        customerEmail: inquiry.customerEmail,
        customerPhone: inquiry.customerPhone,
        customerAddress: customerAddress || '',
        status: 'draft',
        totalAmount: 0, // Will be calculated from items
        notes: notes || '',
        items: {
          create: inquiry.items.map((item) => ({
            partId: item.partId,
            partNo: item.part.partNo,
            description: item.part.description || '',
            quantity: item.quantity,
            unitPrice: item.priceA || item.part.priceA || 0,
            total: item.quantity * (item.priceA || item.part.priceA || 0),
          })),
        },
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    // Calculate total
    const totalAmount = quotation.items.reduce((sum, item) => sum + item.total, 0);
    const updatedQuotation = await prisma.salesQuotation.update({
      where: { id: quotation.id },
      data: { totalAmount },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    // Update inquiry status
    await prisma.salesInquiry.update({
      where: { id },
      data: { status: 'Quoted' },
    });

    res.json(updatedQuotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Sales Quotation Routes ==========

// Get all quotations
router.get('/quotations', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { quotationNo: { contains: search as string } },
        { customerName: { contains: search as string } },
      ];
    }

    const quotations = await prisma.salesQuotation.findMany({
      where,
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
      orderBy: { quotationDate: 'desc' },
    });

    res.json(quotations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get quotation by ID
router.get('/quotations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quotation = await prisma.salesQuotation.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    res.json(quotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create quotation
router.post('/quotations', async (req: Request, res: Response) => {
  try {
    const {
      quotationDate,
      validUntil,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      status,
      notes,
      items,
    } = req.body;

    // Generate quotation number
    const count = await prisma.salesQuotation.count();
    const quotationNo = `SQ-${String(count + 1).padStart(3, '0')}`;

    const quotation = await prisma.salesQuotation.create({
      data: {
        quotationNo,
        quotationDate: new Date(quotationDate),
        validUntil: new Date(validUntil),
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        status: status || 'draft',
        notes,
        items: {
          create: items.map((item: any) => ({
            partId: item.partId,
            partNo: item.partNo,
            description: item.description || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    // Calculate total
    const totalAmount = quotation.items.reduce((sum, item) => sum + item.total, 0);
    const updatedQuotation = await prisma.salesQuotation.update({
      where: { id: quotation.id },
      data: { totalAmount },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    res.json(updatedQuotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update quotation
router.put('/quotations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      quotationDate,
      validUntil,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      status,
      notes,
      items,
    } = req.body;

    // Update quotation
    const quotation = await prisma.salesQuotation.update({
      where: { id },
      data: {
        quotationDate: quotationDate ? new Date(quotationDate) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        status,
        notes,
      },
    });

    // Update items if provided
    if (items) {
      // Delete existing items
      await prisma.salesQuotationItem.deleteMany({
        where: { quotationId: id },
      });

      // Create new items
      await prisma.salesQuotationItem.createMany({
        data: items.map((item: any) => ({
          quotationId: id,
          partId: item.partId,
          partNo: item.partNo,
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
      });
    }

    // Recalculate total
    const updatedItems = await prisma.salesQuotationItem.findMany({
      where: { quotationId: id },
    });
    const totalAmount = updatedItems.reduce((sum, item) => sum + item.total, 0);

    const updatedQuotation = await prisma.salesQuotation.update({
      where: { id },
      data: { totalAmount },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    res.json(updatedQuotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete quotation
router.delete('/quotations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.salesQuotation.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Convert quotation to invoice
router.post('/quotations/:id/convert-to-invoice', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      invoiceDate,
      customerId,
      customerType,
      salesPerson,
      accountId,
      deliveredTo,
      remarks,
      discount,
      tax,
      paidAmount,
    } = req.body;

    const quotation = await prisma.salesQuotation.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Check stock availability
    for (const item of quotation.items) {
      const stock = await getStockBalance(item.partId);
      const reserved = await getReservedQuantity(item.partId);
      const available = stock - reserved;

      if (available < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for part ${item.partNo}. Available: ${available}, Required: ${item.quantity}`,
        });
      }
    }

    // Generate invoice number
    const count = await prisma.salesInvoice.count();
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Calculate totals
    const subtotal = quotation.totalAmount;
    const overallDiscount = discount || 0;
    const taxAmount = tax || 0;
    const grandTotal = subtotal - overallDiscount + taxAmount;

    // Create invoice
    const invoice = await prisma.salesInvoice.create({
      data: {
        invoiceNo,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        customerId,
        customerName: quotation.customerName,
        customerType: customerType || 'registered',
        salesPerson: salesPerson || 'Admin',
        subtotal,
        overallDiscount,
        tax: taxAmount,
        grandTotal,
        paidAmount: paidAmount || 0,
        status: 'pending',
        paymentStatus: paidAmount >= grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        accountId,
        deliveredTo,
        remarks,
        quotationId: id,
        items: {
          create: quotation.items.map((item) => ({
            partId: item.partId,
            partNo: item.partNo,
            description: item.description || '',
            orderedQty: item.quantity,
            deliveredQty: 0,
            pendingQty: item.quantity,
            unitPrice: item.unitPrice,
            discount: 0,
            lineTotal: item.total,
            grade: 'A',
            brand: item.part.brand?.name || '',
          })),
        },
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    // Create stock reservations for ALL invoices (stock is reserved but not reduced yet)
    for (const item of invoice.items) {
      await prisma.stockReservation.create({
        data: {
          invoiceId: invoice.id,
          partId: item.partId,
          quantity: item.orderedQty,
          status: 'reserved',
        },
      });
    }

    // Determine initial status based on customer type
    let initialStatus = 'pending';
    if (customerType === 'registered' && paidAmount >= grandTotal) {
      // Cash sale with full payment - ready for approval
      initialStatus = 'pending_approval';
    }

    // Update invoice status
    await prisma.salesInvoice.update({
      where: { id: invoice.id },
      data: { status: initialStatus },
    });

    // Update quotation status
    await prisma.salesQuotation.update({
      where: { id },
      data: { status: 'converted', invoiceId: invoice.id },
    });

    // PART SELL (walking) - Credit Sale Logic
    // NO immediate stock reduction - stock will be reduced when delivery is confirmed
    if (customerType === 'walking' && customerId) {
      const dueAmount = grandTotal - (paidAmount || 0);
      
      // Create receivable for part sell (credit sale)
      await prisma.receivable.create({
        data: {
          invoiceId: invoice.id,
          customerId,
          amount: grandTotal,
          paidAmount: paidAmount || 0,
          dueAmount,
          status: dueAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending',
        },
      });

      const accountsReceivableAccount = await prisma.account.findFirst({
        where: {
          OR: [
            { name: { contains: 'Accounts Receivable' } },
            { name: { contains: 'Receivable' } },
          ],
          status: 'Active',
        },
      });

      const salesRevenueAccount = await prisma.account.findFirst({
        where: {
          name: { contains: 'Sales Revenue' },
          status: 'Active',
        },
      });

      if (accountsReceivableAccount && salesRevenueAccount) {
        await createJournalEntry(
          new Date(invoiceDate || new Date()),
          invoiceNo,
          `Sales Invoice ${invoiceNo} - Part Sell (Credit)`,
          [
            {
              accountId: accountsReceivableAccount.id,
              description: `Receivable - Invoice ${invoiceNo}`,
              debit: grandTotal,
              credit: 0,
            },
            {
              accountId: salesRevenueAccount.id,
              description: `Sales Revenue - Invoice ${invoiceNo}`,
              debit: 0,
              credit: grandTotal,
            },
          ],
          salesPerson || 'System'
        );
      }

      // Update customer balance
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          openingBalance: {
            increment: dueAmount,
          },
        },
      });
    }
    // CASH SELL (registered) - Cash Sale Logic
    // Stock will be reduced upon approval, but journal entry created immediately
    else if (customerType === 'registered' && accountId) {
      const salesRevenueAccount = await prisma.account.findFirst({
        where: {
          name: { contains: 'Sales Revenue' },
          status: 'Active',
        },
      });

      if (salesRevenueAccount) {
        await createJournalEntry(
          new Date(invoiceDate || new Date()),
          invoiceNo,
          `Sales Invoice ${invoiceNo} - Cash Sell`,
          [
            {
              accountId,
              description: `Cash sale - Invoice ${invoiceNo}`,
              debit: grandTotal,
              credit: 0,
            },
            {
              accountId: salesRevenueAccount.id,
              description: `Sales Revenue - Invoice ${invoiceNo}`,
              debit: 0,
              credit: grandTotal,
            },
          ],
          salesPerson || 'System'
        );

        // Create voucher for cash sale
        try {
          await createVoucherForInvoice(
            invoiceNo,
            new Date(invoiceDate || new Date()),
            customerType,
            accountId,
            grandTotal,
            salesPerson
          );
        } catch (voucherError: any) {
        }
      }
    }

    const updatedInvoice = await prisma.salesInvoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        receivable: true,
      },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Sales Invoice Routes ==========

// Get all invoices
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const { status, paymentStatus, customerType, search } = req.query;
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (paymentStatus && paymentStatus !== 'all') {
      where.paymentStatus = paymentStatus;
    }
    
    if (customerType && customerType !== 'all') {
      where.customerType = customerType;
    }
    
    if (search) {
      where.AND = [
        {
          OR: [
            { invoiceNo: { contains: search as string } },
            { customerName: { contains: search as string } },
          ]
        }
      ];
    }

    // Fetch all invoices (we'll filter out "Demo" customers in memory since SQLite doesn't support case-insensitive mode)
    const allInvoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        items: {
          include: {
            part: true,
          },
        },
        receivable: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });

    // Filter out invoices with "Demo" customers (case-insensitive) - SQLite doesn't support mode: 'insensitive'
    const filteredInvoices = allInvoices.filter(
      (invoice) => !invoice.customerName.toLowerCase().includes('demo')
    );

    res.json(filteredInvoices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get invoice by ID
router.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
        deliveryLogs: {
          include: {
            items: true,
          },
        },
        receivable: true,
        quotation: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get sales invoices by part ID
router.get('/invoices/by-part/:partId', async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    const { page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Find all sales invoice items for this part
    const invoiceItems = await prisma.salesInvoiceItem.findMany({
      where: { partId },
      include: {
        invoice: {
          include: {
            items: {
              include: {
                part: {
                  include: {
                    brand: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        invoice: {
          invoiceDate: 'desc',
        },
      },
      skip,
      take: limitNum,
    });

    // Get unique invoices
    const uniqueInvoiceIds = [...new Set(invoiceItems.map(item => item.invoiceId))];
    const invoices = await prisma.salesInvoice.findMany({
      where: { id: { in: uniqueInvoiceIds } },
      include: {
        items: {
          where: { partId },
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
      orderBy: {
        invoiceDate: 'desc',
      },
    });

    // Format response with invoice details and the specific item for this part
    const result = invoices.map(inv => {
      const itemForPart = inv.items.find(item => item.partId === partId);
      return {
        id: inv.id,
        invoice_no: inv.invoiceNo,
        invoice_date: inv.invoiceDate,
        customer_name: inv.customerName,
        customer_type: inv.customerType,
        status: inv.status,
        payment_status: inv.paymentStatus,
        grand_total: inv.grandTotal,
        subtotal: inv.subtotal,
        overall_discount: inv.overallDiscount,
        tax: inv.tax,
        paid_amount: inv.paidAmount,
        delivered_to: inv.deliveredTo,
        sales_person: inv.salesPerson,
        item: itemForPart ? {
          id: itemForPart.id,
          part_id: itemForPart.partId,
          part_no: itemForPart.partNo,
          part_description: itemForPart.description,
          brand: itemForPart.brand || itemForPart.part?.brand?.name || '',
          ordered_qty: itemForPart.orderedQty,
          delivered_qty: itemForPart.deliveredQty,
          pending_qty: itemForPart.pendingQty,
          unit_price: itemForPart.unitPrice,
          discount: itemForPart.discount,
          line_total: itemForPart.lineTotal,
          grade: itemForPart.grade,
        } : null,
        created_at: inv.createdAt,
      };
    }).filter(inv => inv.item !== null); // Only return invoices that have items for this part

    const total = await prisma.salesInvoiceItem.count({
      where: { partId },
    });

    res.json({
      data: result,
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

// Create invoice
router.post('/invoices', async (req: Request, res: Response) => {
  try {
    const {
      invoiceDate,
      customerId,
      customerName,
      customerType,
      salesPerson,
      accountId,
      bankAccountId,
      cashAccountId,
      bankAmount, // NEW: Separate bank amount
      cashAmount, // NEW: Separate cash amount
      deliveredTo,
      remarks,
      items,
      subtotal,
      overallDiscount,
      tax,
      grandTotal,
      paidAmount,
    } = req.body;

    // Check stock availability
    for (const item of items) {
      const stock = await getStockBalance(item.partId);
      const reserved = await getReservedQuantity(item.partId);
      const available = stock - reserved;

      if (available < item.orderedQty) {
        return res.status(400).json({
          error: `Insufficient stock for part ${item.partNo}. Available: ${available}, Required: ${item.orderedQty}`,
        });
      }
    }

    // Generate invoice number
    const count = await prisma.salesInvoice.count();
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Determine which account ID to store (prefer bank, then cash, then legacy accountId)
    const finalAccountId = bankAccountId || cashAccountId || accountId;

    // Create invoice
    const invoice = await prisma.salesInvoice.create({
      data: {
        invoiceNo,
        invoiceDate: new Date(invoiceDate),
        customerId,
        customerName,
        customerType: customerType || 'registered',
        salesPerson: salesPerson || 'Admin',
        subtotal: subtotal || 0,
        overallDiscount: overallDiscount || 0,
        tax: tax || 0,
        grandTotal: grandTotal || 0,
        paidAmount: paidAmount || 0,
        status: 'pending',
        paymentStatus: paidAmount >= grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        accountId: finalAccountId,
        deliveredTo,
        remarks,
        items: {
          create: items.map((item: any) => ({
            partId: item.partId,
            partNo: item.partNo,
            description: item.description || '',
            orderedQty: item.orderedQty,
            deliveredQty: 0,
            pendingQty: item.orderedQty,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            lineTotal: item.lineTotal,
            grade: item.grade || 'A',
            brand: item.brand || '',
          })),
        },
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    // Create stock reservations for ALL invoices (stock is reserved but not reduced yet)
    for (const item of invoice.items) {
      await prisma.stockReservation.create({
        data: {
          invoiceId: invoice.id,
          partId: item.partId,
          quantity: item.orderedQty,
          status: 'reserved',
        },
      });
    }

    // Determine initial status based on customer type
    let initialStatus = 'pending';
    if (customerType === 'registered' && paidAmount >= grandTotal) {
      // Cash sale with full payment - ready for approval
      initialStatus = 'pending_approval';
    }

    // Update invoice status
    await prisma.salesInvoice.update({
      where: { id: invoice.id },
      data: { status: initialStatus },
    });

    // ========== VOUCHER CREATION LOGIC (Similar to DPO) ==========
    // Always create JV voucher, and RV vouchers if accounts with amounts are selected
    try {
      // Get Sales Revenue account (required for all invoices)
      let salesRevenueAccount = await prisma.account.findFirst({
        where: {
          OR: [
            { name: { contains: 'Sales Revenue' } },
            { name: { contains: 'Goods Sold' } },
            { name: { contains: 'Revenue' } },
            { code: { startsWith: '701' } }, // Revenue subgroup typically starts with 701 or 401
            { 
              subgroup: {
                mainGroup: {
                  type: { in: ['Revenue', 'revenue', 'REVENUE'] }
                }
              }
            }
          ],
          status: 'Active',
        },
        include: {
          subgroup: {
            include: {
              mainGroup: true,
            },
          },
        },
      });

      // If Sales Revenue account doesn't exist, try to find or create Revenue subgroup and account
      if (!salesRevenueAccount) {
        
        // Find Revenue main group
        const revenueMainGroup = await prisma.mainGroup.findFirst({
          where: {
            OR: [
              { type: 'Revenue' },
              { type: 'revenue' },
              { name: { contains: 'Revenue' } },
            ],
          },
        });

        if (revenueMainGroup) {
          // Find or create Revenue subgroup
          let revenueSubgroup = await prisma.subgroup.findFirst({
            where: {
              mainGroupId: revenueMainGroup.id,
              OR: [
                { code: '401' },
                { name: { contains: 'Revenue' } },
                { name: { contains: 'Sales' } },
              ],
            },
          });

          if (!revenueSubgroup) {
            // Create Revenue subgroup
            const existingSubgroups = await prisma.subgroup.findMany({
              where: {
                mainGroupId: revenueMainGroup.id,
                code: {
                  startsWith: '401',
                },
              },
              orderBy: {
                code: 'desc',
              },
            });

            let subgroupCode = '401001';
            if (existingSubgroups.length > 0) {
              const lastCode = existingSubgroups[0].code;
              if (lastCode.length >= 6) {
                const sequence = parseInt(lastCode.slice(-3)) || 0;
                subgroupCode = `401${String(sequence + 1).padStart(3, '0')}`;
              }
            }

            revenueSubgroup = await prisma.subgroup.create({
              data: {
                mainGroupId: revenueMainGroup.id,
                code: '401',
                name: 'Sales Revenue',
              },
            });
          }

          if (revenueSubgroup) {
            // Create Sales Revenue account
            const existingAccounts = await prisma.account.findMany({
              where: {
                subgroupId: revenueSubgroup.id,
                code: {
                  startsWith: revenueSubgroup.code,
                },
              },
              orderBy: {
                code: 'desc',
              },
            });

            let accountCode = `${revenueSubgroup.code}001`;
            if (existingAccounts.length > 0) {
              const lastCode = existingAccounts[0].code;
              if (lastCode.length >= 6) {
                const sequence = parseInt(lastCode.slice(-3)) || 0;
                accountCode = `${revenueSubgroup.code}${String(sequence + 1).padStart(3, '0')}`;
              }
            }

            salesRevenueAccount = await prisma.account.create({
              data: {
                subgroupId: revenueSubgroup.id,
                code: accountCode,
                name: 'Sales Revenue',
                accountType: 'regular',
                openingBalance: 0,
                currentBalance: 0,
                status: 'Active',
              },
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            });
          }
        }
      }

      if (!salesRevenueAccount) {
      } else {
        // Generate JV voucher/journal entry number (must be unique across both tables)
        const jvVoucherNumber = await getNextNumberForPrefix({ prefix: 'JV', voucherType: 'journal' });

        // Get customer receivable account
        let customerReceivableAccount = null;
        if (customerId && (customerType === 'walking' || customerType === 'registered')) {
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
          });

          if (customer) {
            // Find customer account in Accounts Receivable subgroup (typically 201)
            const receivableSubgroup = await prisma.subgroup.findFirst({
              where: {
                OR: [
                  { code: '104' }, // Sales Customer Receivables
                  { code: '201' }, // Standard Accounts Receivable subgroup
                  { name: { contains: 'Receivable' } },
                  { mainGroup: { type: 'Asset' }, name: { contains: 'Receivable' } }
                ],
              },
            });

            if (receivableSubgroup) {
              customerReceivableAccount = await prisma.account.findFirst({
                where: {
                  subgroupId: receivableSubgroup.id,
                  name: customer.name,
                  status: 'Active',
                },
                include: {
                  subgroup: {
                    include: {
                      mainGroup: true,
                    },
                  },
                },
              });

              // If customer account doesn't exist, create it
              if (!customerReceivableAccount && receivableSubgroup) {
                const existingAccounts = await prisma.account.findMany({
                  where: {
                    subgroupId: receivableSubgroup.id,
                    code: {
                      startsWith: receivableSubgroup.code,
                    },
                  },
                  orderBy: {
                    code: 'desc',
                  },
                });

                let accountCode = `${receivableSubgroup.code}001`;
                if (existingAccounts.length > 0) {
                  const lastCode = existingAccounts[0].code;
                  const lastSequence = parseInt(lastCode.slice(-3)) || 0;
                  accountCode = `${receivableSubgroup.code}${String(lastSequence + 1).padStart(3, '0')}`;
                }

                customerReceivableAccount = await prisma.account.create({
                  data: {
                    subgroupId: receivableSubgroup.id,
                    code: accountCode,
                    name: customer.name,
                    accountType: 'regular',
                    openingBalance: customer.openingBalance || 0,
                    currentBalance: customer.openingBalance || 0,
                    status: 'Active',
                  },
                  include: {
                    subgroup: {
                      include: {
                        mainGroup: true,
                      },
                    },
                  },
                });

              }
            }
          }
        }

        // Build JV voucher entries
        const jvVoucherEntries = [];

        // Determine receivable account to use
        let receivableAccount = customerReceivableAccount;
        if (!receivableAccount) {
          // Fallback to generic Accounts Receivable
          const receivableSubgroup = await prisma.subgroup.findFirst({
            where: {
              OR: [
                { code: '104' },
                { code: '201' },
                { name: { contains: 'Receivable' } },
              ],
            },
          });

          if (receivableSubgroup) {
            receivableAccount = await prisma.account.findFirst({
              where: {
                subgroupId: receivableSubgroup.id,
                OR: [
                  { code: '104001' },
                  { code: '201001' },
                  { name: { contains: 'Accounts Receivable' } },
                ],
                status: 'Active',
              },
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            });
          }
        }

        // JV Entry 1: Debit Accounts Receivable (or Customer Account)
        if (receivableAccount) {
          jvVoucherEntries.push({
            accountId: receivableAccount.id,
            accountName: `${receivableAccount.code}-${receivableAccount.name}`,
            description: `INV: ${invoiceNo} Receivable Created - ${customerName}`,
            debit: grandTotal,
            credit: 0,
            sortOrder: 0,
          });
        }

        // JV Entry 2: Credit Sales Revenue
        jvVoucherEntries.push({
          accountId: salesRevenueAccount.id,
          accountName: `${salesRevenueAccount.code}-${salesRevenueAccount.name}`,
          description: `INV: ${invoiceNo} Sales Revenue - ${customerName}`,
          debit: 0,
          credit: grandTotal,
          sortOrder: 1,
        });

        // Create Journal Entry (for ledger tracking)
        const journalLines = jvVoucherEntries.map(entry => ({
          accountId: entry.accountId,
          description: entry.description,
          debit: entry.debit,
          credit: entry.credit,
          lineOrder: entry.sortOrder,
        }));

        const totalDebit = journalLines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = journalLines.reduce((sum, line) => sum + line.credit, 0);

        if (journalLines.length > 0 && totalDebit === totalCredit) {
          const journalEntry = await prisma.journalEntry.create({
            data: {
              entryNo: jvVoucherNumber,
              entryDate: new Date(invoiceDate),
              reference: `INV-${invoiceNo}`,
              description: `Sales Invoice ${invoiceNo} - ${customerName}`,
              totalDebit,
              totalCredit,
              status: 'posted',
              createdBy: salesPerson || 'System',
              postedBy: 'System',
              postedAt: new Date(),
              lines: {
                create: journalLines,
              },
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

          // Update account balances for JV
          for (const line of journalEntry.lines) {
            const accountType = line.account.subgroup.mainGroup.type.toLowerCase();
            const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
              ? (line.debit - line.credit)
              : (line.credit - line.debit);

            await prisma.account.update({
              where: { id: line.accountId },
              data: {
                currentBalance: {
                  increment: balanceChange,
                },
              },
            });
          }

          // Create JV Voucher
          const jvVoucher = await prisma.voucher.create({
            data: {
              voucherNumber: jvVoucherNumber,
              type: 'journal',
              date: new Date(invoiceDate),
              narration: customerName,
              totalDebit,
              totalCredit,
              status: 'posted',
              createdBy: salesPerson || 'System',
              approvedBy: 'System',
              approvedAt: new Date(),
              entries: {
                create: jvVoucherEntries,
              },
            },
          });

          // ========== RV VOUCHER CREATION (if accounts with amounts are selected) ==========
          const accountsToProcess: Array<{ id: string; name: string; amount: number }> = [];

          // Check bank account with amount
          if (bankAccountId && bankAmount && bankAmount > 0) {
            const bankAccount = await prisma.account.findUnique({
              where: { id: bankAccountId },
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            });

            if (bankAccount) {
              accountsToProcess.push({
                id: bankAccountId,
                name: bankAccount.name,
                amount: bankAmount,
              });
            }
          }

          // Check cash account with amount
          if (cashAccountId && cashAmount && cashAmount > 0) {
            const cashAccount = await prisma.account.findUnique({
              where: { id: cashAccountId },
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            });

            if (cashAccount) {
              accountsToProcess.push({
                id: cashAccountId,
                name: cashAccount.name,
                amount: cashAmount,
              });
            }
          }

          // Create RV vouchers for each account with amount
          for (const accountInfo of accountsToProcess) {
            try {
              const account = await prisma.account.findUnique({
                where: { id: accountInfo.id },
                include: {
                  subgroup: {
                    include: {
                      mainGroup: true,
                    },
                  },
                },
              });

              if (!account) continue;

              const subgroupCode = account.subgroup?.code || '';
              const isCashOrBank = subgroupCode === '101' || subgroupCode === '102';

              if (!isCashOrBank) {
                const accountType = account.subgroup?.mainGroup?.type?.toLowerCase() || '';
                if (accountType !== 'asset') {
                  continue;
                }
              }

              // Generate RV number (format: RV####)
              const lastRV = await prisma.voucher.findFirst({
                where: {
                  type: 'receipt',
                  voucherNumber: {
                    startsWith: 'RV',
                  },
                },
                orderBy: {
                  voucherNumber: 'desc',
                },
              });

              let rvNumber = 1;
              if (lastRV) {
                const match = lastRV.voucherNumber.match(/^RV(\d+)$/);
                if (match) {
                  rvNumber = parseInt(match[1]) + 1;
                } else {
                  const voucherCount = await prisma.voucher.count({
                    where: { type: 'receipt' },
                  });
                  rvNumber = voucherCount + 1;
                }
              }
              const rvVoucherNumber = `RV${String(rvNumber).padStart(4, '0')}`;

              // Create RV Voucher
              // Debit Cash/Bank (increases asset) and Credit Receivable (decreases receivable)
              const rvVoucher = await prisma.voucher.create({
                data: {
                  voucherNumber: rvVoucherNumber,
                  type: 'receipt',
                  date: new Date(invoiceDate),
                  narration: customerName,
                  cashBankAccount: account.name,
                  totalDebit: accountInfo.amount,
                  totalCredit: accountInfo.amount,
                  status: 'posted',
                  createdBy: salesPerson || 'System',
                  approvedBy: 'System',
                  approvedAt: new Date(),
                  entries: {
                    create: [
                      {
                        accountId: account.id,
                        accountName: `${account.code}-${account.name}`,
                        description: `Receipt for INV ${invoiceNo}`,
                        debit: accountInfo.amount,
                        credit: 0,
                        sortOrder: 0,
                      },
                      {
                        accountId: receivableAccount!.id,
                        accountName: `${receivableAccount!.code}-${receivableAccount!.name}`,
                        description: `Receipt for INV ${invoiceNo}`,
                        debit: 0,
                        credit: accountInfo.amount,
                        sortOrder: 1,
                      },
                    ],
                  },
                },
              });

              // Update account balances for RV voucher
              // Debit Cash/Bank (increases asset)
              await prisma.account.update({
                where: { id: account.id },
                data: {
                  currentBalance: {
                    increment: accountInfo.amount, // Asset increases with debit
                  },
                },
              });

              // Credit Receivable (decreases receivable asset)
              await prisma.account.update({
                where: { id: receivableAccount!.id },
                data: {
                  currentBalance: {
                    decrement: accountInfo.amount, // Receivable decreases with credit
                  },
                },
              });

            } catch (rvError: any) {
            }
          }

          if (accountsToProcess.length === 0) {
            
            // ========== CASH SALE RV VOUCHER CREATION ==========
            // For CASH sales (walking customer with accountId and paidAmount > 0), create RV voucher
            if (customerType === 'walking' && finalAccountId && paidAmount > 0) {
              try {
                const cashAccount = await prisma.account.findUnique({
                  where: { id: finalAccountId },
                  include: {
                    subgroup: {
                      include: { mainGroup: true },
                    },
                  },
                });

                if (cashAccount) {
                  const subgroupCode = cashAccount.subgroup?.code || '';
                  const isCashOrBank = subgroupCode === '101' || subgroupCode === '102';
                  const accountType = cashAccount.subgroup?.mainGroup?.type?.toLowerCase() || '';
                  
                  if (isCashOrBank || accountType === 'asset') {
                    // Generate RV number
                    const lastRV = await prisma.voucher.findFirst({
                      where: {
                        type: 'receipt',
                        voucherNumber: { startsWith: 'RV' },
                      },
                      orderBy: { voucherNumber: 'desc' },
                    });

                    let rvNumber = 1;
                    if (lastRV) {
                      const match = lastRV.voucherNumber.match(/^RV(\d+)$/);
                      if (match) {
                        rvNumber = parseInt(match[1]) + 1;
                      } else {
                        const voucherCount = await prisma.voucher.count({
                          where: { type: 'receipt' },
                        });
                        rvNumber = voucherCount + 1;
                      }
                    }
                    const rvVoucherNumber = `RV${String(rvNumber).padStart(4, '0')}`;

                    // Get Sales Revenue account for RV
                    const salesRevenueAccount = await prisma.account.findFirst({
                      where: {
                        OR: [
                          { name: { contains: 'Sales Revenue' } },
                          { code: { startsWith: '701' } },
                        ],
                        status: 'Active',
                      },
                    });

                    if (salesRevenueAccount) {
                      // Create RV Voucher: DR Cash/Bank, CR Sales Revenue
                      const rvVoucher = await prisma.voucher.create({
                        data: {
                          voucherNumber: rvVoucherNumber,
                          type: 'receipt',
                          date: new Date(invoiceDate),
                          narration: `Cash Sale - Invoice ${invoiceNo}`,
                          cashBankAccount: cashAccount.name,
                          totalDebit: paidAmount,
                          totalCredit: paidAmount,
                          status: 'posted',
                          createdBy: salesPerson || 'System',
                          approvedBy: 'System',
                          approvedAt: new Date(),
                          entries: {
                            create: [
                              {
                                accountId: cashAccount.id,
                                accountName: `${cashAccount.code}-${cashAccount.name}`,
                                description: `Cash Sale - Invoice ${invoiceNo}`,
                                debit: paidAmount,
                                credit: 0,
                                sortOrder: 0,
                              },
                              {
                                accountId: salesRevenueAccount.id,
                                accountName: `${salesRevenueAccount.code}-${salesRevenueAccount.name}`,
                                description: `Sales Revenue - Invoice ${invoiceNo}`,
                                debit: 0,
                                credit: paidAmount,
                                sortOrder: 1,
                              },
                            ],
                          },
                        },
                      });

                      // Update account balances
                      await prisma.account.update({
                        where: { id: cashAccount.id },
                        data: { currentBalance: { increment: paidAmount } },
                      });

                      await prisma.account.update({
                        where: { id: salesRevenueAccount.id },
                        data: { currentBalance: { increment: paidAmount } },
                      });

                    }
                  }
                }
              } catch (rvError: any) {
              }
            } else {
            }
          }
        }
      }
    } catch (voucherError: any) {
      // Don't fail invoice creation if voucher creation fails
    }

    // PART SELL (walking) - Credit Sale Logic (for receivable creation)
    // NO immediate stock reduction - stock will be reduced when delivery is confirmed
    if (customerType === 'walking' && customerId) {
      const totalPaid = (bankAmount || 0) + (cashAmount || 0) || (paidAmount || 0);
      const dueAmount = grandTotal - totalPaid;
      
      // Create receivable for part sell (credit sale)
      await prisma.receivable.create({
        data: {
          invoiceId: invoice.id,
          customerId,
          amount: grandTotal,
          paidAmount: totalPaid,
          dueAmount,
          status: dueAmount === 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending',
        },
      });

      // Update customer balance
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          openingBalance: {
            increment: dueAmount,
          },
        },
      });
    }

    const updatedInvoice = await prisma.salesInvoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        receivable: true,
      },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update sales invoice (for store managers to edit invoices)
router.put('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      invoiceDate,
      customerName,
      customerId,
      deliveredTo,
      remarks,
      items,
      overallDiscount,
    } = req.body;

    // Find existing invoice
    const existingInvoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        items: true,
        reservations: true,
        deliveryLogs: true,
        receivable: true,
      },
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Don't allow editing cancelled or fully delivered invoices
    if (existingInvoice.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot edit a cancelled invoice' });
    }

    if (existingInvoice.status === 'fully_delivered') {
      return res.status(400).json({ error: 'Cannot edit a fully delivered invoice' });
    }

    // Check if any items have been delivered
    const hasDeliveredItems = existingInvoice.items.some(item => item.deliveredQty > 0);
    if (hasDeliveredItems && items) {
      return res.status(400).json({ 
        error: 'Cannot modify items on an invoice that has partial deliveries. Please complete or cancel existing deliveries first.' 
      });
    }

    // Update basic invoice fields
    const updateData: any = {};
    
    if (invoiceDate !== undefined) {
      updateData.invoiceDate = new Date(invoiceDate);
    }
    if (customerName !== undefined) {
      updateData.customerName = customerName;
    }
    if (customerId !== undefined) {
      updateData.customerId = customerId;
    }
    if (deliveredTo !== undefined) {
      updateData.deliveredTo = deliveredTo;
    }
    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }
    if (overallDiscount !== undefined) {
      updateData.overallDiscount = overallDiscount;
    }

    // If items are being updated, handle them
    if (items && Array.isArray(items) && items.length > 0) {
      // First, release existing stock reservations
      for (const reservation of existingInvoice.reservations) {
        if (reservation.status === 'reserved') {
          await prisma.stockReservation.update({
            where: { id: reservation.id },
            data: {
              status: 'released',
              releasedAt: new Date(),
            },
          });
        }
      }

      // Delete existing items
      await prisma.salesInvoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Create new items
      let subtotal = 0;
      for (const item of items) {
        const lineTotal = item.orderedQty * item.unitPrice;
        subtotal += lineTotal;

        await prisma.salesInvoiceItem.create({
          data: {
            invoiceId: id,
            partId: item.partId,
            partNo: item.partNo || '',
            description: item.description || '',
            orderedQty: item.orderedQty,
            deliveredQty: 0,
            pendingQty: item.orderedQty,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            lineTotal: lineTotal,
            grade: item.grade || 'A',
            brand: item.brand || '',
          },
        });

        // Create new stock reservation
        await prisma.stockReservation.create({
          data: {
            invoiceId: id,
            partId: item.partId,
            quantity: item.orderedQty,
            status: 'reserved',
          },
        });
      }

      // Calculate new totals
      const discount = overallDiscount !== undefined ? overallDiscount : existingInvoice.overallDiscount;
      const grandTotal = subtotal - discount;

      updateData.subtotal = subtotal;
      updateData.grandTotal = grandTotal;
    } else if (overallDiscount !== undefined) {
      // If only discount changed, recalculate grand total
      updateData.grandTotal = existingInvoice.subtotal - overallDiscount;
    }

    // Update the invoice
    const updatedInvoice = await prisma.salesInvoice.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            part: true,
          },
        },
        deliveryLogs: {
          include: {
            items: true,
          },
        },
        receivable: true,
      },
    });

    // Update receivable if exists and totals changed
    if (existingInvoice.receivable && (updateData.grandTotal !== undefined)) {
      const newDueAmount = updateData.grandTotal - existingInvoice.paidAmount;
      await prisma.receivable.update({
        where: { invoiceId: id },
        data: {
          amount: updateData.grandTotal,
          dueAmount: newDueAmount,
          status: newDueAmount <= 0 ? 'paid' : existingInvoice.paidAmount > 0 ? 'partial' : 'pending',
        },
      });
    }

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve Cash Sale Invoice (reduces stock immediately)
router.post('/invoices/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { items: true, reservations: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only cash sales (registered) can be approved
    if (invoice.customerType !== 'registered') {
      return res.status(400).json({ 
        error: 'Only cash sales can be approved. Part sell invoices require delivery confirmation.' 
      });
    }

    // Check if already approved (stock already reduced)
    const hasStockMovements = await prisma.stockMovement.findFirst({
      where: {
        referenceType: 'sales_invoice',
        referenceId: id,
        notes: { contains: 'Approved' },
      },
    });

    if (hasStockMovements) {
      return res.status(400).json({ error: 'Invoice already approved' });
    }

    // Reduce stock immediately for cash sale
    for (const item of invoice.items) {
      // Update stock reservation status to "out"
      const reservations = await prisma.stockReservation.findMany({
        where: {
          invoiceId: id,
          partId: item.partId,
          status: 'reserved',
        },
        orderBy: { reservedAt: 'asc' },
      });

      for (const reservation of reservations) {
        await prisma.stockReservation.update({
          where: { id: reservation.id },
          data: { status: 'out' },
        });
      }

      // Create stock movement - stock out
      await prisma.stockMovement.create({
        data: {
          partId: item.partId,
          type: 'out',
          quantity: item.orderedQty,
          referenceType: 'sales_invoice',
          referenceId: id,
          notes: `Sales Invoice ${invoice.invoiceNo} - Approved by ${approvedBy || 'Store Manager'}`,
        },
      });
    }

    // Update invoice status
    await prisma.salesInvoice.update({
      where: { id },
      data: { 
        status: 'fully_delivered', // Cash sales don't need delivery, mark as delivered
      },
    });

    // Create cost JV (COGS vs Inventory) when stock is reduced (approval step)
    // This keeps inventory valuation and COGS in sync with stock-out movements.
    try {
      const costMarker = `COGS for INV ${invoice.invoiceNo}`;

      const existingCostVoucher = await prisma.voucher.findFirst({
        where: {
          type: 'journal',
          entries: {
            some: {
              description: { contains: costMarker },
            },
          },
        },
        select: { id: true, voucherNumber: true },
      });

      if (!existingCostVoucher) {
        // Inventory account (expected code 101001 in this system)
        const inventoryAccount = await prisma.account.findFirst({
          where: {
            code: '101001',
            status: 'Active',
          },
          include: {
            subgroup: { include: { mainGroup: true } },
          },
        });

        // COGS account (expected code 901001). Create it if missing.
        let cogsAccount = await prisma.account.findFirst({
          where: {
            status: 'Active',
            OR: [
              { code: '901001' },
              { name: { contains: 'Cost of Goods Sold' } },
              { name: { contains: 'COGS' } },
            ],
          },
          include: {
            subgroup: { include: { mainGroup: true } },
          },
        });

        if (!cogsAccount) {
          // Find or create "Cost" main group
          let costMainGroup = await prisma.mainGroup.findFirst({
            where: {
              OR: [
                { code: '9' },
                { type: 'Cost' },
                { type: 'cost' },
                { name: { contains: 'Cost' } },
                { name: { contains: 'COGS' } },
              ],
            },
          });
          if (!costMainGroup) {
            costMainGroup = await prisma.mainGroup.create({
              data: {
                code: '9',
                name: 'Cost',
                type: 'Cost',
                displayOrder: 9,
              },
            });
          }

          // Find or create "Cost of Goods Sold" subgroup (901)
          let cogsSubgroup = await prisma.subgroup.findFirst({
            where: {
              mainGroupId: costMainGroup.id,
              OR: [
                { code: '901' },
                { name: { contains: 'Cost of Goods' } },
                { name: { contains: 'COGS' } },
              ],
            },
          });
          if (!cogsSubgroup) {
            cogsSubgroup = await prisma.subgroup.create({
              data: {
                mainGroupId: costMainGroup.id,
                code: '901',
                name: 'Cost of Goods Sold',
              },
            });
          }

          cogsAccount = await prisma.account.create({
            data: {
              subgroupId: cogsSubgroup.id,
              code: '901001',
              name: 'Cost of Goods Sold',
              accountType: 'regular',
              openingBalance: 0,
              currentBalance: 0,
              status: 'Active',
            },
            include: {
              subgroup: { include: { mainGroup: true } },
            },
          });
        }

        if (inventoryAccount && cogsAccount) {
          // Cost basis: prefer Part.cost; fallback to most recent DPO purchase price.
          let totalCost = 0;
          for (const item of invoice.items) {
            const part = await prisma.part.findUnique({
              where: { id: item.partId },
              select: { cost: true },
            });
            let unitCost = typeof part?.cost === 'number' && part.cost > 0 ? part.cost : 0;
            if (!unitCost) {
              const lastDpoItem = await prisma.directPurchaseOrderItem.findFirst({
                where: { partId: item.partId },
                orderBy: { createdAt: 'desc' },
                select: { purchasePrice: true },
              });
              if (lastDpoItem?.purchasePrice && lastDpoItem.purchasePrice > 0) {
                unitCost = lastDpoItem.purchasePrice;
              }
            }
            totalCost += unitCost * item.orderedQty;
          }

          if (totalCost > 0) {
            // Generate JV voucher/journal entry number (must be unique across both tables)
            const costVoucherNumber = await getNextNumberForPrefix({ prefix: 'JV', voucherType: 'journal' });

            const totalDebit = totalCost;
            const totalCredit = totalCost;

            // Journal entry for ledger tracking
            const journalEntry = await prisma.journalEntry.create({
              data: {
                entryNo: costVoucherNumber,
                entryDate: invoice.invoiceDate,
                reference: `COGS-${invoice.invoiceNo}`,
                description: `COGS for ${invoice.invoiceNo}`,
                totalDebit,
                totalCredit,
                status: 'posted',
                createdBy: approvedBy || 'System',
                postedBy: 'System',
                postedAt: new Date(),
                lines: {
                  create: [
                    {
                      accountId: cogsAccount.id,
                      description: costMarker,
                      debit: totalCost,
                      credit: 0,
                      lineOrder: 0,
                    },
                    {
                      accountId: inventoryAccount.id,
                      description: costMarker,
                      debit: 0,
                      credit: totalCost,
                      lineOrder: 1,
                    },
                  ],
                },
              },
              include: {
                lines: {
                  include: {
                    account: { include: { subgroup: { include: { mainGroup: true } } } },
                  },
                },
              },
            });

            // Update account balances using proper accounting logic (same as other postings)
            for (const line of journalEntry.lines) {
              const accountType = line.account.subgroup.mainGroup.type.toLowerCase();
              const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
                ? (line.debit - line.credit)
                : (line.credit - line.debit);

              await prisma.account.update({
                where: { id: line.accountId },
                data: {
                  currentBalance: { increment: balanceChange },
                },
              });
            }

            // Voucher
            await prisma.voucher.create({
              data: {
                voucherNumber: costVoucherNumber,
                type: 'journal',
                date: invoice.invoiceDate,
                narration: `COGS - ${invoice.invoiceNo}`,
                totalDebit,
                totalCredit,
                status: 'posted',
                createdBy: approvedBy || 'System',
                approvedBy: 'System',
                approvedAt: new Date(),
                entries: {
                  create: [
                    {
                      accountId: cogsAccount.id,
                      accountName: `${cogsAccount.code}-${cogsAccount.name}`,
                      description: costMarker,
                      debit: totalCost,
                      credit: 0,
                      sortOrder: 0,
                    },
                    {
                      accountId: inventoryAccount.id,
                      accountName: `${inventoryAccount.code}-${inventoryAccount.name}`,
                      description: costMarker,
                      debit: 0,
                      credit: totalCost,
                      sortOrder: 1,
                    },
                  ],
                },
              },
            });
          } else {
          }
        } else {
        }
      }
    } catch (costErr: any) {
      // Don't fail approval if cost voucher creation fails
    }

    const updatedInvoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record delivery - Only for Part Sell (walking) invoices
router.post('/invoices/:id/delivery', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { challanNo, deliveryDate, deliveredBy, items } = req.body;

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only part sell (walking) invoices require delivery
    if (invoice.customerType !== 'walking') {
      return res.status(400).json({ 
        error: 'Delivery can only be recorded for Part sell invoices. Cash sales are approved directly.' 
      });
    }

    // Create delivery log
    const deliveryLog = await prisma.deliveryLog.create({
      data: {
        invoiceId: id,
        challanNo,
        deliveryDate: new Date(deliveryDate),
        deliveredBy,
        items: {
          create: items.map((item: any) => ({
            invoiceItemId: item.invoiceItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            invoiceItem: true,
          },
        },
      },
    });

    // Update invoice items and reservations
    for (const item of items) {
      const invoiceItem = await prisma.salesInvoiceItem.findUnique({
        where: { id: item.invoiceItemId },
      });

      if (invoiceItem) {
        const newDeliveredQty = invoiceItem.deliveredQty + item.quantity;
        const newPendingQty = invoiceItem.orderedQty - newDeliveredQty;

        await prisma.salesInvoiceItem.update({
          where: { id: item.invoiceItemId },
          data: {
            deliveredQty: newDeliveredQty,
            pendingQty: newPendingQty,
          },
        });

        // Update stock reservation status to "out"
        const reservations = await prisma.stockReservation.findMany({
          where: {
            invoiceId: id,
            partId: invoiceItem.partId,
            status: 'reserved',
          },
          orderBy: { reservedAt: 'asc' },
        });

        let remainingQty = item.quantity;
        for (const reservation of reservations) {
          if (remainingQty <= 0) break;

          const qtyToMove = Math.min(reservation.quantity, remainingQty);
          await prisma.stockReservation.update({
            where: { id: reservation.id },
            data: { status: 'out' },
          });

          // Create stock movement - THIS IS WHERE STOCK IS REDUCED FOR PART SELL
          await prisma.stockMovement.create({
            data: {
              partId: invoiceItem.partId,
              type: 'out',
              quantity: qtyToMove,
              referenceType: 'sales_invoice',
              referenceId: id,
              notes: `Delivery - Invoice ${invoice.invoiceNo} - Part Sell`,
            },
          });

          remainingQty -= qtyToMove;
        }
      }
    }

    // Update invoice status
    const updatedInvoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    const allDelivered = updatedInvoice?.items.every((item) => item.pendingQty === 0);
    const hasDelivered = updatedInvoice?.items.some((item) => item.deliveredQty > 0);

    let newStatus = invoice.status;
    if (allDelivered) {
      newStatus = 'fully_delivered';
    } else if (hasDelivered) {
      newStatus = 'partially_delivered';
    }

    await prisma.salesInvoice.update({
      where: { id },
      data: { status: newStatus },
    });

    const finalInvoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        deliveryLogs: {
          include: {
            items: true,
          },
        },
      },
    });

    res.json(finalInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record payment
router.post('/invoices/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, accountId, paymentDate } = req.body;

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { receivable: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const newPaidAmount = invoice.paidAmount + amount;
    const newPaymentStatus = newPaidAmount >= invoice.grandTotal ? 'paid' : newPaidAmount > 0 ? 'partial' : 'unpaid';

    await prisma.salesInvoice.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
      },
    });

    // Update receivable if exists
    if (invoice.receivable) {
      const newReceivablePaid = invoice.receivable.paidAmount + amount;
      const newReceivableDue = invoice.receivable.amount - newReceivablePaid;
      const newReceivableStatus = newReceivableDue === 0 ? 'paid' : newReceivablePaid > 0 ? 'partial' : 'pending';

      await prisma.receivable.update({
        where: { invoiceId: id },
        data: {
          paidAmount: newReceivablePaid,
          dueAmount: newReceivableDue,
          status: newReceivableStatus,
        },
      });

      // Create journal entry for payment
      if (accountId) {
        const accountsReceivableAccount = await prisma.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Accounts Receivable' } },
              { name: { contains: 'Receivable' } },
            ],
            status: 'Active',
          },
        });

        if (accountsReceivableAccount) {
          await createJournalEntry(
            new Date(paymentDate || new Date()),
            invoice.invoiceNo,
            `Payment received - Invoice ${invoice.invoiceNo}`,
            [
              {
                accountId,
                description: `Payment - Invoice ${invoice.invoiceNo}`,
                debit: amount,
                credit: 0,
              },
              {
                accountId: accountsReceivableAccount.id,
                description: `Receivable payment - Invoice ${invoice.invoiceNo}`,
                debit: 0,
                credit: amount,
              },
            ],
            'System'
          );
        }
      }

      // Update customer balance
      if (invoice.customerId) {
        await prisma.customer.update({
          where: { id: invoice.customerId },
          data: {
            openingBalance: {
              decrement: amount,
            },
          },
        });
      }
    }

    const updatedInvoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        receivable: true,
      },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Put invoice on hold
router.post('/invoices/:id/hold', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { holdReason } = req.body;

    const invoice = await prisma.salesInvoice.update({
      where: { id },
      data: {
        status: 'on_hold',
        holdReason,
        holdSince: new Date(),
      },
    });

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Release hold
router.post('/invoices/:id/release-hold', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const hasPending = invoice.items.some((item) => item.pendingQty > 0);
    const hasDelivered = invoice.items.some((item) => item.deliveredQty > 0);

    let newStatus = 'pending';
    if (hasDelivered && hasPending) {
      newStatus = 'partially_delivered';
    } else if (!hasPending) {
      newStatus = 'fully_delivered';
    }

    const updatedInvoice = await prisma.salesInvoice.update({
      where: { id },
      data: {
        status: newStatus,
        holdReason: null,
        holdSince: null,
      },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update invoice status
router.put('/invoices/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending', 'partially_delivered', 'fully_delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be one of: pending, partially_delivered, fully_delivered, cancelled' });
    }

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { reservations: true, receivable: true, items: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // If changing to cancelled, handle stock reservations and receivables
    if (status === 'cancelled' && invoice.status !== 'cancelled') {
      // Release all reservations
      for (const reservation of invoice.reservations) {
        if (reservation.status === 'reserved') {
          await prisma.stockReservation.update({
            where: { id: reservation.id },
            data: {
              status: 'released',
              releasedAt: new Date(),
            },
          });
        }
      }

      // Update receivable if exists
      if (invoice.receivable) {
        await prisma.receivable.update({
          where: { invoiceId: id },
          data: { status: 'cancelled' },
        });

        // Update customer balance
        if (invoice.customerId) {
          await prisma.customer.update({
            where: { id: invoice.customerId },
            data: {
              openingBalance: {
                decrement: invoice.receivable.dueAmount,
              },
            },
          });
        }
      }
    }

    // Update invoice status
    const updatedInvoice = await prisma.salesInvoice.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        deliveryLogs: {
          include: {
            items: true,
          },
        },
      },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel invoice
router.post('/invoices/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { reservations: true, receivable: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Release all reservations
    for (const reservation of invoice.reservations) {
      if (reservation.status === 'reserved') {
        await prisma.stockReservation.update({
          where: { id: reservation.id },
          data: {
            status: 'released',
            releasedAt: new Date(),
          },
        });
      }
    }

    // Update invoice status
    await prisma.salesInvoice.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Update receivable if exists
    if (invoice.receivable) {
      await prisma.receivable.update({
        where: { invoiceId: id },
        data: { status: 'cancelled' },
      });

      // Update customer balance
      if (invoice.customerId) {
        await prisma.customer.update({
          where: { id: invoice.customerId },
          data: {
            openingBalance: {
              decrement: invoice.receivable.dueAmount,
            },
          },
        });
      }
    }

    const updatedInvoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        items: true,
        reservations: true,
      },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Permanently delete a cancelled invoice
router.delete('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: { receivable: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status !== 'cancelled') {
      return res.status(400).json({
        error: 'Only cancelled invoices can be permanently deleted. Cancel the invoice first.',
      });
    }

    // Unlink any quotation that references this invoice
    await prisma.salesQuotation.updateMany({
      where: { invoiceId: id },
      data: { invoiceId: null },
    });

    // Delete receivable if exists (before invoice)
    if (invoice.receivable) {
      await prisma.receivable.delete({ where: { invoiceId: id } });
    }

    // Delete invoice (cascades to items, reservations, deliveryLogs, returns)
    await prisma.salesInvoice.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Stock Management Routes ==========

// Get reserved quantity for a part
router.get('/stock/reserved/:partId', async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    
    const reservedQty = await getReservedQuantity(partId);
    
    res.json({ partId, reservedQty });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available stock for a part
router.get('/stock/available/:partId', async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    const stock = await getStockBalance(partId);
    const reserved = await getReservedQuantity(partId);
    const available = stock - reserved;
    res.json({ partId, stock, reserved, available });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

