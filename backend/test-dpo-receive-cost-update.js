#!/usr/bin/env node

/**
 * Simple test: Receive a DPO and verify cost updates
 * 
 * Logic:
 * 1. Find or create a DPO with part 6C0570
 * 2. Receive it (status = 'Received')
 * 3. Verify Part.cost is updated to landed cost
 * 4. Verify API returns updated cost
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3002';
const TEST_PART_NO = '6C0570';

// Helper to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, error: e.message });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testDPOReceiveCostUpdate() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST: DPO Receive Cost Update');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    // Step 1: Get canonical part for 6C0570
    console.log('\n📋 Step 1: Finding canonical part for 6C0570...');
    const parts = await prisma.part.findMany({
      where: { partNo: TEST_PART_NO },
      orderBy: [
        { costUpdatedAt: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    if (parts.length === 0) {
      console.error('❌ Part 6C0570 not found!');
      return false;
    }

    const canonicalPart = parts[0];
    console.log(`✅ Found canonical part: ID=${canonicalPart.id}, Current Cost=${canonicalPart.cost || 'NULL'}`);

    // Step 2: Find or create a DPO with this part
    console.log('\n📋 Step 2: Finding DPO with part 6C0570...');
    let dpo = await prisma.directPurchaseOrder.findFirst({
      where: {
        items: {
          some: {
            partId: canonicalPart.id,
          },
        },
      },
      include: {
        items: true,
        expenses: true,
      },
      orderBy: { date: 'desc' },
    });

    if (!dpo) {
      console.log('   No existing DPO found. Creating test DPO...');
      // Create a test DPO
      const dpoNumber = `DPO-TEST-${Date.now()}`;
      dpo = await prisma.directPurchaseOrder.create({
        data: {
          dpoNumber,
          date: new Date(),
          status: 'Order Receivable Pending',
          totalAmount: 0,
          items: {
            create: {
              partId: canonicalPart.id,
              quantity: 10,
              purchasePrice: 10000,
              salePrice: 12000,
              amount: 100000,
            },
          },
          expenses: {
            create: {
              expenseType: 'Freight',
              payableAccount: 'Test',
              description: 'Test expense',
              amount: 20000,
            },
          },
        },
        include: {
          items: true,
          expenses: true,
        },
      });
      console.log(`✅ Created test DPO: ${dpo.dpoNumber}`);
    } else {
      console.log(`✅ Found existing DPO: ${dpo.dpoNumber}, Status: ${dpo.status}`);
    }

    // Step 3: Check current cost before receive
    console.log('\n📋 Step 3: Current cost before receive...');
    const partBefore = await prisma.part.findUnique({
      where: { id: canonicalPart.id },
      select: { cost: true, costSource: true },
    });
    console.log(`   Current Cost: ${partBefore?.cost || 'NULL'}`);
    console.log(`   Cost Source: ${partBefore?.costSource || 'NULL'}`);

    // Step 4: Calculate expected landed cost
    const item = dpo.items.find(i => i.partId === canonicalPart.id);
    const totalExpenses = dpo.expenses.reduce((sum, e) => sum + e.amount, 0);
    const itemsTotal = dpo.items.reduce((sum, i) => sum + (i.purchasePrice * i.quantity), 0);
    const expensePerUnit = itemsTotal > 0 ? (totalExpenses * item.purchasePrice * item.quantity) / itemsTotal / item.quantity : 0;
    const expectedLandedCost = item.purchasePrice + expensePerUnit;
    
    console.log(`\n📋 Step 4: Expected landed cost calculation...`);
    console.log(`   Purchase Price: ${item.purchasePrice}`);
    console.log(`   Total Expenses: ${totalExpenses}`);
    console.log(`   Items Total: ${itemsTotal}`);
    console.log(`   Expense Per Unit: ${expensePerUnit.toFixed(2)}`);
    console.log(`   Expected Landed Cost: ${expectedLandedCost.toFixed(2)}`);

    // Step 5: Receive DPO if not already received
    if (dpo.status !== 'Received' && dpo.status !== 'Completed') {
      console.log(`\n📋 Step 5: Receiving DPO ${dpo.dpoNumber}...`);
      
      const receiveResponse = await makeRequest('PUT', `/api/inventory/direct-purchase-orders/${dpo.id}`, {
        status: 'Received',
        items: dpo.items.map(i => ({
          part_id: i.partId,
          quantity: i.quantity,
          purchase_price: i.purchasePrice,
        })),
        expenses: dpo.expenses.map(e => ({
          expense_type: e.expenseType,
          payable_account: e.payableAccount,
          description: e.description,
          amount: e.amount,
        })),
      });

      if (receiveResponse.status !== 200) {
        console.error(`❌ Failed to receive DPO:`, receiveResponse.data);
        return false;
      }

      console.log(`✅ DPO received successfully`);
      console.log(`   Response:`, JSON.stringify(receiveResponse.data, null, 2));
    } else {
      console.log(`\n📋 Step 5: DPO already received (Status: ${dpo.status})`);
    }

    // Step 6: Wait a moment for updates to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Verify cost updated in database
    console.log(`\n📋 Step 6: Verifying cost updated in database...`);
    const partAfter = await prisma.part.findUnique({
      where: { id: canonicalPart.id },
      select: { cost: true, costSource: true, costSourceRef: true, costUpdatedAt: true },
    });

    console.log(`   Cost After: ${partAfter?.cost || 'NULL'}`);
    console.log(`   Cost Source: ${partAfter?.costSource || 'NULL'}`);
    console.log(`   Cost Source Ref: ${partAfter?.costSourceRef || 'NULL'}`);
    console.log(`   Cost Updated At: ${partAfter?.costUpdatedAt || 'NULL'}`);

    if (!partAfter || !partAfter.costSource || partAfter.costSource !== 'DPO_RECEIVED') {
      console.error(`❌ FAILED: Cost was not updated by DPO receive!`);
      console.error(`   Expected: costSource='DPO_RECEIVED'`);
      console.error(`   Got: costSource='${partAfter?.costSource || 'NULL'}'`);
      return false;
    }

    const costMatches = Math.abs((partAfter.cost || 0) - expectedLandedCost) < 0.01;
    if (!costMatches) {
      console.error(`❌ FAILED: Cost does not match expected landed cost!`);
      console.error(`   Expected: ${expectedLandedCost.toFixed(2)}`);
      console.error(`   Got: ${partAfter.cost}`);
      return false;
    }

    console.log(`✅ Cost updated correctly in database!`);

    // Step 8: Verify API returns updated cost
    console.log(`\n📋 Step 7: Verifying API returns updated cost...`);
    const apiResponse = await makeRequest('GET', `/api/parts?search=${TEST_PART_NO}&limit=1`);
    
    if (apiResponse.status !== 200 || !apiResponse.data.data || apiResponse.data.data.length === 0) {
      console.error(`❌ API request failed:`, apiResponse);
      return false;
    }

    const apiPart = apiResponse.data.data[0];
    console.log(`   API returned cost: ${apiPart.cost}`);
    
    if (Math.abs((apiPart.cost || 0) - expectedLandedCost) > 0.01) {
      console.error(`❌ FAILED: API returns wrong cost!`);
      console.error(`   Expected: ${expectedLandedCost.toFixed(2)}`);
      console.error(`   Got: ${apiPart.cost}`);
      return false;
    }

    console.log(`✅ API returns correct cost!`);

    // Step 9: Verify debug endpoint
    console.log(`\n📋 Step 8: Verifying debug endpoint...`);
    const debugResponse = await makeRequest('GET', `/api/debug/part-cost/${TEST_PART_NO}`);
    
    if (debugResponse.status === 200) {
      const { canonicalPartId, pricingApiWillReturn } = debugResponse.data;
      console.log(`   Canonical Part ID: ${canonicalPartId}`);
      console.log(`   Pricing API Will Return Cost: ${pricingApiWillReturn.cost}`);
      
      if (pricingApiWillReturn.cost !== partAfter.cost) {
        console.error(`❌ FAILED: Debug endpoint shows different cost!`);
        return false;
      }
      console.log(`✅ Debug endpoint shows correct cost!`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ ALL VERIFICATIONS PASSED!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Part: ${TEST_PART_NO}`);
    console.log(`   Old Cost: ${partBefore?.cost || 'NULL'}`);
    console.log(`   New Cost: ${partAfter.cost}`);
    console.log(`   Expected Landed Cost: ${expectedLandedCost.toFixed(2)}`);
    console.log(`   Cost Source: ${partAfter.costSource}`);
    console.log(`   Cost Source Ref: ${partAfter.costSourceRef}`);
    
    return true;
  } catch (error) {
    console.error('❌ ERROR:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testDPOReceiveCostUpdate()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
