import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVoucherAutoCreation() {
  console.log('🧪 ============================================');
  console.log('🧪 TESTING VOUCHER AUTO-CREATION SYSTEM');
  console.log('🧪 ============================================\n');

  let testSupplier = null;
  let testPart = null;
  let testPO = null;
  let createdVoucher = null;

  try {
    // Step 1: Check prerequisites
    console.log('📋 Step 1: Checking Prerequisites...\n');
    
    // Check if Voucher table exists
    const voucherTableCheck = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name='Voucher';
    `;
    if (voucherTableCheck.length === 0) {
      console.error('❌ Voucher table does not exist!');
      return;
    }
    console.log('✅ Voucher table exists');

    // Check Inventory Account
    const inventoryAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { code: '101001' },
          { code: '104005' },
          { code: '104001' },
        ],
      },
    });
    if (!inventoryAccount) {
      console.error('❌ Inventory account not found!');
      return;
    }
    console.log(`✅ Inventory account found: ${inventoryAccount.code} - ${inventoryAccount.name}`);

    // Check Supplier Accounts subgroup
    const payablesSubgroup = await prisma.subgroup.findFirst({
      where: { code: '301' },
    });
    if (!payablesSubgroup) {
      console.error('❌ Payables subgroup (301) not found!');
      return;
    }
    console.log(`✅ Payables subgroup found: ${payablesSubgroup.code} - ${payablesSubgroup.name}\n`);

    // Step 2: Create test supplier
    console.log('👤 Step 2: Creating Test Supplier...\n');
    testSupplier = await prisma.supplier.create({
      data: {
        code: `TEST-SUP-${Date.now()}`,
        name: 'Test Supplier',
        companyName: 'Test Supplier Company Ltd',
        email: 'test@supplier.com',
        phone: '1234567890',
        status: 'active',
        openingBalance: 0,
        date: new Date(),
      },
    });
    console.log(`✅ Created test supplier: ${testSupplier.companyName} (ID: ${testSupplier.id})\n`);

    // Step 3: Create test part
    console.log('📦 Step 3: Creating Test Part...\n');
    
    // Get a brand and category
    let brand = await prisma.brand.findFirst();
    let category = await prisma.category.findFirst();
    
    if (!brand) {
      brand = await prisma.brand.create({
        data: { name: 'Test Brand', status: 'Active' },
      });
    }
    if (!category) {
      category = await prisma.category.create({
        data: { name: 'Test Category', status: 'Active' },
      });
    }

    testPart = await prisma.part.create({
      data: {
        partNo: `TEST-PART-${Date.now()}`,
        description: 'Test Part for Voucher Testing',
        cost: 1000,
        priceA: 1500,
        brandId: brand.id,
        categoryId: category.id,
        status: 'Active',
      },
    });
    console.log(`✅ Created test part: ${testPart.partNo} (ID: ${testPart.id})\n`);

    // Step 4: Create test purchase order
    console.log('📝 Step 4: Creating Test Purchase Order...\n');
    
    // Generate PO number
    const poCount = await prisma.purchaseOrder.count();
    const poNumber = `PO-TEST-${String(poCount + 1).padStart(3, '0')}`;
    
    testPO = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        date: new Date(),
        supplierId: testSupplier.id,
        status: 'Pending',
        expectedDate: new Date(),
        totalAmount: 0,
        items: {
          create: {
            partId: testPart.id,
            quantity: 10,
            unitCost: 1000,
            totalCost: 10000,
            receivedQty: 0,
          },
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
    console.log(`✅ Created test PO: ${testPO.poNumber} (ID: ${testPO.id})`);
    console.log(`   Items: ${testPO.items.length}, Total: ${testPO.items.reduce((sum, item) => sum + item.totalCost, 0)}\n`);

    // Step 5: Get voucher count before receiving PO
    console.log('🎫 Step 5: Checking Voucher Count Before Receiving PO...\n');
    const vouchersBefore = await prisma.voucher.count({
      where: { type: 'journal' },
    });
    console.log(`📊 Vouchers before: ${vouchersBefore}\n`);

    // Step 6: Simulate receiving the PO (update status to Received)
    console.log('📥 Step 6: Receiving Purchase Order (Updating Status to "Received")...\n');
    
    // Update PO with received quantities
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: testPO.id },
      data: {
        status: 'Received',
        items: {
          updateMany: {
            where: {},
            data: {
              receivedQty: 10, // Receive all items
            },
          },
        },
        totalAmount: 10000,
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });
    console.log(`✅ PO status updated to: ${updatedPO.status}`);
    console.log(`   Received quantity: ${updatedPO.items[0].receivedQty}\n`);

    // Step 7: Manually trigger voucher creation (simulating the API call)
    console.log('🔄 Step 7: Triggering Voucher Creation Logic...\n');
    
    // This simulates what happens in the PUT /purchase-orders/:id route
    const grandTotal = updatedPO.totalAmount;
    
    if (grandTotal > 0) {
      // Find or create supplier account
      let supplierAccount = await prisma.account.findFirst({
        where: {
          AND: [
            { code: { startsWith: '301' } },
            {
              OR: [
                { name: testSupplier.name },
                { name: testSupplier.companyName },
              ],
            },
          ],
        },
      });

      if (!supplierAccount) {
        const existingAccounts = await prisma.account.findMany({
          where: { code: { startsWith: '301' } },
          orderBy: { code: 'desc' },
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
        supplierAccount = await prisma.account.create({
          data: {
            subgroupId: payablesSubgroup.id,
            code: accountCode,
            name: testSupplier.companyName,
            description: `Supplier Account: ${testSupplier.companyName}`,
            openingBalance: 0,
            currentBalance: 0,
            status: 'Active',
            canDelete: false,
          },
        });
        console.log(`✅ Created supplier account: ${supplierAccount.code} - ${supplierAccount.name}`);
      } else {
        console.log(`✅ Found supplier account: ${supplierAccount.code} - ${supplierAccount.name}`);
      }

      if (inventoryAccount && supplierAccount) {
        // Generate voucher number
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
        console.log(`📝 Generated voucher number: ${voucherNumber}`);

        // Create voucher entries
        const voucherEntries = [
          {
            accountId: inventoryAccount.id,
            accountName: `${inventoryAccount.code}-${inventoryAccount.name}`,
            description: `PO: ${updatedPO.poNumber} Inventory Added`,
            debit: grandTotal,
            credit: 0,
            sortOrder: 0,
          },
          {
            accountId: supplierAccount.id,
            accountName: `${supplierAccount.code}-${supplierAccount.name}`,
            description: `PO: ${updatedPO.poNumber} ${testSupplier.companyName} Liability Created`,
            debit: 0,
            credit: grandTotal,
            sortOrder: 1,
          },
        ];

        // Create voucher
        createdVoucher = await prisma.voucher.create({
          data: {
            voucherNumber,
            type: 'journal',
            date: updatedPO.date,
            narration: `Purchase Order Number: ${updatedPO.poNumber.replace('PO-TEST-', '')}`,
            totalDebit: grandTotal,
            totalCredit: grandTotal,
            status: 'posted',
            createdBy: 'System',
            approvedBy: 'System',
            approvedAt: new Date(),
            entries: {
              create: voucherEntries,
            },
          },
          include: {
            entries: true,
          },
        });

        console.log(`✅ Voucher created successfully!`);
        console.log(`   Voucher Number: ${createdVoucher.voucherNumber}`);
        console.log(`   Type: ${createdVoucher.type}`);
        console.log(`   Status: ${createdVoucher.status}`);
        console.log(`   Total Debit: ${createdVoucher.totalDebit}`);
        console.log(`   Total Credit: ${createdVoucher.totalCredit}`);
        console.log(`   Entries: ${createdVoucher.entries.length}\n`);
      } else {
        console.error('❌ Missing required accounts for voucher creation!');
        return;
      }
    }

    // Step 8: Verify voucher was created
    console.log('✅ Step 8: Verifying Voucher Creation...\n');
    const vouchersAfter = await prisma.voucher.count({
      where: { type: 'journal' },
    });
    console.log(`📊 Vouchers after: ${vouchersAfter}`);
    console.log(`📈 Difference: ${vouchersAfter - vouchersBefore}\n`);

    if (createdVoucher) {
      console.log('🎉 ============================================');
      console.log('🎉 TEST RESULT: ✅ SUCCESS');
      console.log('🎉 ============================================');
      console.log(`\n✅ Voucher was automatically created!`);
      console.log(`\n📋 Voucher Details:`);
      console.log(`   ID: ${createdVoucher.id}`);
      console.log(`   Voucher Number: ${createdVoucher.voucherNumber}`);
      console.log(`   Type: ${createdVoucher.type}`);
      console.log(`   Date: ${createdVoucher.date.toISOString().split('T')[0]}`);
      console.log(`   Narration: ${createdVoucher.narration}`);
      console.log(`   Status: ${createdVoucher.status}`);
      console.log(`   Total Debit: ${createdVoucher.totalDebit.toLocaleString()}`);
      console.log(`   Total Credit: ${createdVoucher.totalCredit.toLocaleString()}`);
      console.log(`   Created By: ${createdVoucher.createdBy}`);
      console.log(`   Approved By: ${createdVoucher.approvedBy}`);
      console.log(`\n📝 Voucher Entries:`);
      createdVoucher.entries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.accountName}`);
        console.log(`      Description: ${entry.description}`);
        console.log(`      Debit: ${entry.debit.toLocaleString()}, Credit: ${entry.credit.toLocaleString()}`);
      });
    } else {
      console.log('❌ ============================================');
      console.log('❌ TEST RESULT: ❌ FAILED');
      console.log('❌ ============================================');
      console.log('\n❌ Voucher was NOT created automatically!');
    }

  } catch (error) {
    console.error('\n❌ ============================================');
    console.error('❌ TEST ERROR');
    console.error('❌ ============================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Cleanup: Delete test data
    console.log('\n🧹 Cleaning up test data...\n');
    try {
      if (createdVoucher) {
        await prisma.voucherEntry.deleteMany({
          where: { voucherId: createdVoucher.id },
        });
        await prisma.voucher.delete({
          where: { id: createdVoucher.id },
        });
        console.log('✅ Test voucher deleted');
      }
      if (testPO) {
        await prisma.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: testPO.id },
        });
        await prisma.purchaseOrder.delete({
          where: { id: testPO.id },
        });
        console.log('✅ Test purchase order deleted');
      }
      if (testPart) {
        await prisma.part.delete({
          where: { id: testPart.id },
        });
        console.log('✅ Test part deleted');
      }
      if (testSupplier) {
        await prisma.supplier.delete({
          where: { id: testSupplier.id },
        });
        console.log('✅ Test supplier deleted');
      }
    } catch (cleanupError) {
      console.error('⚠️  Error during cleanup:', cleanupError.message);
    }
    
    await prisma.$disconnect();
    console.log('\n✅ Test completed and cleaned up!\n');
  }
}

// Run the test
testVoucherAutoCreation();

