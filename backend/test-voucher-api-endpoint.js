import { PrismaClient } from '@prisma/client';

// Use native fetch (Node 18+) or node-fetch
let fetch;
try {
  fetch = globalThis.fetch || (await import('node-fetch')).default;
} catch {
  // Fallback for older Node versions
  const nodeFetch = await import('node-fetch');
  fetch = nodeFetch.default;
}

const prisma = new PrismaClient();
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

async function testVoucherViaAPI() {
  console.log('🧪 ============================================');
  console.log('🧪 TESTING VOUCHER AUTO-CREATION VIA API');
  console.log('🧪 ============================================\n');

  let testSupplier = null;
  let testPart = null;
  let testPO = null;
  let createdVoucher = null;

  try {
    // Step 1: Create test data
    console.log('📋 Step 1: Creating Test Data...\n');
    
    // Create supplier
    testSupplier = await prisma.supplier.create({
      data: {
        code: `API-TEST-SUP-${Date.now()}`,
        name: 'API Test Supplier',
        companyName: 'API Test Supplier Company Ltd',
        email: 'apitest@supplier.com',
        phone: '1234567890',
        status: 'active',
        openingBalance: 0,
        date: new Date(),
      },
    });
    console.log(`✅ Created test supplier: ${testSupplier.companyName}`);

    // Get brand and category
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

    // Create part
    testPart = await prisma.part.create({
      data: {
        partNo: `API-TEST-PART-${Date.now()}`,
        description: 'API Test Part for Voucher Testing',
        cost: 2000,
        priceA: 3000,
        brandId: brand.id,
        categoryId: category.id,
        status: 'Active',
      },
    });
    console.log(`✅ Created test part: ${testPart.partNo}`);

    // Create purchase order
    const poCount = await prisma.purchaseOrder.count();
    const poNumber = `PO-API-TEST-${String(poCount + 1).padStart(3, '0')}`;
    
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
            quantity: 5,
            unitCost: 2000,
            totalCost: 10000,
            receivedQty: 0,
          },
        },
      },
    });
    console.log(`✅ Created test PO: ${testPO.poNumber} (ID: ${testPO.id})\n`);

    // Step 2: Check voucher count before
    console.log('🎫 Step 2: Checking Voucher Count Before API Call...\n');
    const vouchersBefore = await prisma.voucher.count({
      where: { type: 'journal' },
    });
    console.log(`📊 Vouchers before: ${vouchersBefore}\n`);

    // Step 3: Call API to receive the PO
    console.log('📡 Step 3: Calling API to Receive Purchase Order...\n');
    console.log(`   Endpoint: PUT ${API_BASE_URL}/inventory/purchase-orders/${testPO.id}`);
    console.log(`   Status: Received\n`);

    const updateResponse = await fetch(`${API_BASE_URL}/inventory/purchase-orders/${testPO.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'Received',
        items: [
          {
            part_id: testPart.id,
            quantity: 5,
            unit_cost: 2000,
            total_cost: 10000,
            received_qty: 5, // Receive all items
          },
        ],
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`API call failed: ${updateResponse.status} - ${errorText}`);
    }

    const updateResult = await updateResponse.json();
    console.log(`✅ API Response: ${JSON.stringify(updateResult, null, 2)}\n`);

    // Step 4: Wait a bit for async operations
    console.log('⏳ Step 4: Waiting for async operations...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Check if voucher was created
    console.log('🔍 Step 5: Checking if Voucher was Created...\n');
    const vouchersAfter = await prisma.voucher.count({
      where: { type: 'journal' },
    });
    console.log(`📊 Vouchers after: ${vouchersAfter}`);
    console.log(`📈 Difference: ${vouchersAfter - vouchersBefore}\n`);

    // Find the voucher related to this PO
    const vouchers = await prisma.voucher.findMany({
      where: {
        type: 'journal',
        narration: {
          contains: testPO.poNumber.replace('PO-API-TEST-', ''),
        },
      },
      include: {
        entries: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (vouchers.length > 0) {
      createdVoucher = vouchers[0];
      console.log('🎉 ============================================');
      console.log('🎉 TEST RESULT: ✅ SUCCESS');
      console.log('🎉 ============================================');
      console.log(`\n✅ Voucher was automatically created via API!`);
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
      console.log('\n❌ Voucher was NOT created via API!');
      console.log('\n🔍 Possible Issues:');
      console.log('   1. The API route might not be executing voucher creation code');
      console.log('   2. The status check condition might not be met');
      console.log('   3. There might be an error in the voucher creation that is being silently caught');
      console.log('   4. The backend server might not be running or updated');
      console.log('\n💡 Check the backend server logs for errors or warnings.');
    }

  } catch (error) {
    console.error('\n❌ ============================================');
    console.error('❌ TEST ERROR');
    console.error('❌ ============================================');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
      console.error('\n⚠️  Backend server might not be running!');
      console.error('   Please start the backend server and try again.');
    }
  } finally {
    // Cleanup
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
    console.log('\n✅ Test completed!\n');
  }
}

// Check if backend is running first
console.log('🔍 Checking if backend server is running...\n');
fetch(`${API_BASE_URL.replace('/api', '')}/health`)
  .then(() => {
    console.log('✅ Backend server is running\n');
    testVoucherViaAPI();
  })
  .catch(() => {
    console.error('❌ Backend server is not running!');
    console.error('   Please start the backend server first:');
    console.error('   cd backend && npm run dev\n');
    process.exit(1);
  });

