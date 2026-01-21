import * as express from 'express';
import { Request, Response } from 'express';
import prisma from '../config/database';

const router = express.Router();

/**
 * DPO RETURN SYSTEM - FUNCTIONAL SPECIFICATION
 * 
 * Purpose: Handle returns of items from Direct Purchase Orders
 * 
 * Business Rules:
 * 1. Can only return items from completed DPOs
 * 2. Return quantity cannot exceed original purchased quantity
 * 3. Returns reduce inventory (OUT movement)
 * 4. Returns create REVERSE accounting entries:
 *    - JV: Debit Supplier Payable, Credit Inventory (reverses original JV)
 *    - If original DPO had payment (PV), return creates a refund expectation
 * 5. Return status: pending -> approved -> completed
 * 6. Approved returns trigger:
 *    - Stock movement OUT
 *    - Accounting voucher creation (JV)
 *    - Supplier account balance adjustment
 */

// ==================== GET ALL DPO RETURNS ====================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, dpo_id, page = '1', limit = '100' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status as string;
    }

    if (dpo_id) {
      where.directPurchaseOrderId = dpo_id as string;
    }

    if (from_date || to_date) {
      where.returnDate = {};
      if (from_date) where.returnDate.gte = new Date(from_date as string);
      if (to_date) where.returnDate.lte = new Date(to_date as string);
    }

    const [returns, total] = await Promise.all([
      prisma.directPurchaseOrderReturn.findMany({
        where,
        include: {
          directPurchaseOrder: {
            select: {
              dpoNumber: true,
              supplierId: true,
              date: true,
            },
          },
          items: {
            include: {
              part: {
                select: {
                  partNo: true,
                  description: true,
                },
              },
            },
          },
        },
        orderBy: { returnDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.directPurchaseOrderReturn.count({ where }),
    ]);

    res.json({
      data: returns,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching DPO returns:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GET SINGLE DPO RETURN ====================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dpoReturn = await prisma.directPurchaseOrderReturn.findUnique({
      where: { id },
      include: {
        directPurchaseOrder: {
          include: {
            items: {
              include: {
                part: true,
              },
            },
          },
        },
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    if (!dpoReturn) {
      return res.status(404).json({ error: 'DPO Return not found' });
    }

    res.json(dpoReturn);
  } catch (error: any) {
    console.error('Error fetching DPO return:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CREATE DPO RETURN ====================
router.post('/', async (req: Request, res: Response) => {
  try {
    const { dpo_id, return_date, reason, items } = req.body;

    if (!dpo_id || !return_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'dpo_id, return_date, and items are required' });
    }

    // Verify DPO exists and is completed
    const dpo = await prisma.directPurchaseOrder.findUnique({
      where: { id: dpo_id },
      include: {
        items: true,
      },
    });

    if (!dpo) {
      return res.status(404).json({ error: 'Direct Purchase Order not found' });
    }

    if (dpo.status !== 'Completed') {
      return res.status(400).json({ error: 'Can only return items from completed DPOs' });
    }

    // Validate return quantities
    for (const returnItem of items) {
      const dpoItem = dpo.items.find(item => item.partId === returnItem.part_id);
      
      if (!dpoItem) {
        return res.status(400).json({ 
          error: `Part ${returnItem.part_id} not found in original DPO` 
        });
      }

      // Check if return quantity exceeds purchased quantity
      // Get total already returned for this part
      const existingReturns = await prisma.directPurchaseOrderReturnItem.findMany({
        where: {
          dpoReturn: {
            directPurchaseOrderId: dpo_id,
            status: { in: ['approved', 'completed'] },
          },
          partId: returnItem.part_id,
        },
      });

      const totalReturned = existingReturns.reduce((sum, item) => sum + item.returnQuantity, 0);
      const availableToReturn = dpoItem.quantity - totalReturned;

      if (returnItem.return_quantity > availableToReturn) {
        return res.status(400).json({ 
          error: `Cannot return ${returnItem.return_quantity} units of part ${returnItem.part_id}. Only ${availableToReturn} units available for return (purchased: ${dpoItem.quantity}, already returned: ${totalReturned})` 
        });
      }
    }

    // Generate return number
    const year = new Date(return_date).getFullYear();
    const lastReturn = await prisma.directPurchaseOrderReturn.findFirst({
      where: {
        returnNumber: {
          startsWith: `DPOR-${year}-`,
        },
      },
      orderBy: {
        returnNumber: 'desc',
      },
    });

    let nextNum = 1;
    if (lastReturn) {
      const match = lastReturn.returnNumber.match(new RegExp(`^DPOR-${year}-(\\d+)$`));
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    const returnNumber = `DPOR-${year}-${String(nextNum).padStart(3, '0')}`;

    // Calculate total amount
    const totalAmount = items.reduce((sum: number, item: any) => {
      const dpoItem = dpo.items.find(i => i.partId === item.part_id);
      return sum + (dpoItem!.purchasePrice * item.return_quantity);
    }, 0);

    // Create return
    const dpoReturn = await prisma.directPurchaseOrderReturn.create({
      data: {
        returnNumber,
        directPurchaseOrderId: dpo_id,
        returnDate: new Date(return_date),
        reason: reason || null,
        status: 'pending',
        totalAmount,
        items: {
          create: items.map((item: any) => {
            const dpoItem = dpo.items.find(i => i.partId === item.part_id);
            return {
              partId: item.part_id,
              returnQuantity: item.return_quantity,
              originalPurchasePrice: dpoItem!.purchasePrice,
              amount: dpoItem!.purchasePrice * item.return_quantity,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        directPurchaseOrder: true,
      },
    });

    console.log(`✅ Created DPO Return ${returnNumber} for DPO ${dpo.dpoNumber}`);

    res.status(201).json(dpoReturn);
  } catch (error: any) {
    console.error('Error creating DPO return:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== APPROVE DPO RETURN ====================
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dpoReturn = await prisma.directPurchaseOrderReturn.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        directPurchaseOrder: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!dpoReturn) {
      return res.status(404).json({ error: 'DPO Return not found' });
    }

    if (dpoReturn.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending returns can be approved' });
    }

    // Update status to approved
    await prisma.directPurchaseOrderReturn.update({
      where: { id },
      data: { status: 'approved' },
    });

    // Create stock movements (OUT) for returned items
    const dpo = dpoReturn.directPurchaseOrder;
    for (const returnItem of dpoReturn.items) {
      await prisma.stockMovement.create({
        data: {
          partId: returnItem.partId,
          type: 'out',
          quantity: returnItem.returnQuantity,
          storeId: dpo.storeId || null,
          referenceType: 'dpo_return',
          referenceId: dpoReturn.id,
          notes: `DPO Return ${dpoReturn.returnNumber} - Original DPO: ${dpo.dpoNumber}`,
        },
      });
    }

    console.log(`✅ Created stock movements for DPO Return ${dpoReturn.returnNumber}`);

    // Create accounting voucher (JV) - REVERSE of original DPO JV
    // Original DPO JV: DR Inventory, CR Supplier Payable
    // Return JV: DR Supplier Payable, CR Inventory
    try {
      // Find Inventory Account
      const inventoryAccount = await prisma.account.findFirst({
        where: {
          OR: [
            {
              subgroup: {
                code: '104',
              },
            },
            {
              name: {
                contains: 'Inventory',
              },
            },
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

      if (!inventoryAccount) {
        console.error('❌ Inventory Account not found! Cannot create return voucher.');
        return res.status(400).json({ error: 'Inventory Account not found' });
      }

      // Find Supplier Account
      let supplierAccount = null;
      if (dpo.supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: dpo.supplierId },
        });

        if (supplier) {
          const payablesSubgroup = await prisma.subgroup.findFirst({
            where: { code: '301' },
          });

          if (payablesSubgroup) {
            supplierAccount = await prisma.account.findFirst({
              where: {
                subgroupId: payablesSubgroup.id,
                OR: [
                  { name: supplier.name || '' },
                  { name: supplier.companyName || '' },
                ],
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

      if (!supplierAccount) {
        console.error('❌ Supplier Account not found! Cannot create return voucher.');
        return res.status(400).json({ error: 'Supplier Account not found' });
      }

      // Generate JV number
      const lastJV = await prisma.voucher.findFirst({
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

      let jvNumber = 1;
      if (lastJV) {
        const match = lastJV.voucherNumber.match(/^JV(\d+)$/);
        if (match) {
          jvNumber = parseInt(match[1]) + 1;
        }
      }
      const jvVoucherNumber = `JV${String(jvNumber).padStart(4, '0')}`;

      // Create JV Voucher (REVERSE of original DPO)
      const jvVoucher = await prisma.voucher.create({
        data: {
          voucherNumber: jvVoucherNumber,
          type: 'journal',
          date: dpoReturn.returnDate,
          narration: `DPO Return ${dpoReturn.returnNumber} - Original DPO: ${dpo.dpoNumber}`,
          totalDebit: dpoReturn.totalAmount,
          totalCredit: dpoReturn.totalAmount,
          status: 'posted',
          createdBy: 'System',
          approvedBy: 'System',
          approvedAt: new Date(),
          entries: {
            create: [
              {
                accountId: supplierAccount.id,
                accountName: `${supplierAccount.code}-${supplierAccount.name}`,
                description: `DPO Return ${dpoReturn.returnNumber}`,
                debit: dpoReturn.totalAmount,
                credit: 0,
                sortOrder: 0,
              },
              {
                accountId: inventoryAccount.id,
                accountName: `${inventoryAccount.code}-${inventoryAccount.name}`,
                description: `DPO Return ${dpoReturn.returnNumber}`,
                debit: 0,
                credit: dpoReturn.totalAmount,
                sortOrder: 1,
              },
            ],
          },
        },
      });

      // Update account balances
      // Debit Supplier Payable (decreases liability)
      await prisma.account.update({
        where: { id: supplierAccount.id },
        data: {
          currentBalance: {
            decrement: dpoReturn.totalAmount,
          },
        },
      });

      // Credit Inventory (decreases asset)
      await prisma.account.update({
        where: { id: inventoryAccount.id },
        data: {
          currentBalance: {
            decrement: dpoReturn.totalAmount,
          },
        },
      });

      console.log(`✅ Created JV voucher ${jvVoucherNumber} for DPO Return ${dpoReturn.returnNumber}`);
    } catch (voucherError: any) {
      console.error('❌ Error creating voucher for DPO return:', voucherError);
      // Don't fail the approval if voucher creation fails
    }

    // Update return status to completed
    const updatedReturn = await prisma.directPurchaseOrderReturn.update({
      where: { id },
      data: { status: 'completed' },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        directPurchaseOrder: true,
      },
    });

    res.json(updatedReturn);
  } catch (error: any) {
    console.error('Error approving DPO return:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== REJECT DPO RETURN ====================
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const dpoReturn = await prisma.directPurchaseOrderReturn.findUnique({
      where: { id },
    });

    if (!dpoReturn) {
      return res.status(404).json({ error: 'DPO Return not found' });
    }

    if (dpoReturn.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending returns can be rejected' });
    }

    const updatedReturn = await prisma.directPurchaseOrderReturn.update({
      where: { id },
      data: { 
        status: 'rejected',
        reason: rejection_reason || dpoReturn.reason,
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        directPurchaseOrder: true,
      },
    });

    console.log(`✅ Rejected DPO Return ${dpoReturn.returnNumber}`);

    res.json(updatedReturn);
  } catch (error: any) {
    console.error('Error rejecting DPO return:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DELETE DPO RETURN ====================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dpoReturn = await prisma.directPurchaseOrderReturn.findUnique({
      where: { id },
    });

    if (!dpoReturn) {
      return res.status(404).json({ error: 'DPO Return not found' });
    }

    if (dpoReturn.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Only pending returns can be deleted. Approved/completed returns cannot be deleted.' 
      });
    }

    await prisma.directPurchaseOrderReturn.delete({
      where: { id },
    });

    console.log(`✅ Deleted DPO Return ${dpoReturn.returnNumber}`);

    res.json({ message: 'DPO Return deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting DPO return:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
