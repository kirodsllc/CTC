import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createDemoData() {
  try {
    log('\n🎬 Creating Demo Data for Accounting Flow...\n', 'cyan');

    // Step 1: Create Demo Supplier with Opening Balance
    log('📝 Step 1: Creating Demo Supplier...', 'blue');
    
    // Check if demo supplier already exists
    let demoSupplier = await prisma.supplier.findFirst({
      where: { companyName: { contains: 'Demo Company' } },
    });

    if (demoSupplier) {
      log(`⚠️  Demo supplier already exists: ${demoSupplier.code}`, 'yellow');
      log('   Deleting existing demo supplier and related data...', 'yellow');
      
      // Delete related accounts
      const supplierAccounts = await prisma.account.findMany({
        where: {
          code: { startsWith: '301' },
          name: { contains: demoSupplier.name || demoSupplier.companyName },
        },
      });
      
      for (const account of supplierAccounts) {
        // Delete journal lines
        await prisma.journalLine.deleteMany({
          where: { accountId: account.id },
        });
        await prisma.account.delete({ where: { id: account.id } });
      }
      
      // Delete journal entries
      await prisma.journalLine.deleteMany({
        where: {
          journalEntry: {
            reference: { contains: demoSupplier.code },
          },
        },
      });
      
      await prisma.journalEntry.deleteMany({
        where: {
          reference: { contains: demoSupplier.code },
        },
      });
      
      await prisma.supplier.delete({ where: { id: demoSupplier.id } });
      log('   ✅ Old demo data deleted', 'green');
    }

    // Generate supplier code
    const lastSupplier = await prisma.supplier.findFirst({
      where: { code: { startsWith: 'SUP-' } },
      orderBy: { code: 'desc' },
    });
    let supplierCode = 'SUP-001';
    if (lastSupplier) {
      const match = lastSupplier.code.match(/SUP-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        supplierCode = `SUP-${String(nextNum).padStart(3, '0')}`;
      }
    }

    demoSupplier = await prisma.supplier.create({
      data: {
        code: supplierCode,
        name: 'Abdullah Rehman',
        companyName: 'Demo Company Ltd',
        email: 'abdullah@democompany.com',
        phone: '03313163131',
        cnic: '21213-2132132-1',
        address: 'Demo Address, Demo City',
        openingBalance: 400000,
        date: new Date('2026-01-02'),
        status: 'active',
      },
    });
    log(`✅ Supplier created: ${demoSupplier.code} - ${demoSupplier.companyName}`, 'green');
    log(`   Name: ${demoSupplier.name}`, 'green');
    log(`   Opening Balance: ${demoSupplier.openingBalance.toLocaleString()}`, 'green');

    // Create supplier account and journal entry
    log('   Creating supplier account and journal entry...', 'blue');
    const payablesSubgroup = await prisma.subgroup.findFirst({
      where: { code: '301' },
    });

    if (!payablesSubgroup) {
      throw new Error('Purchase Orders Payables subgroup (301) not found');
    }

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

    const supplierAccount = await prisma.account.create({
      data: {
        subgroupId: payablesSubgroup.id,
        code: accountCode,
        name: `${demoSupplier.name}`,
        description: `Supplier Account: ${demoSupplier.companyName}`,
        openingBalance: 0,
        currentBalance: 0,
        status: 'Active',
        canDelete: false,
      },
    });
    log(`✅ Supplier account created: ${supplierAccount.code}-${supplierAccount.name}`, 'green');

    // Find Owner Capital account
    const ownerCapitalAccount = await prisma.account.findFirst({
      where: { code: '501003' },
    });

    if (!ownerCapitalAccount) {
      log('⚠️  Owner Capital account (501003) not found, creating journal entry without it', 'yellow');
    } else {
      const count = await prisma.journalEntry.count();
      const entryNo = `JV${String(count + 1).padStart(4, '0')}`;

      const openingJournal = await prisma.journalEntry.create({
        data: {
          entryNo,
          entryDate: demoSupplier.date || new Date(),
          reference: `SUP-${demoSupplier.code}`,
          description: `${demoSupplier.name} Supplier Opening Balance : ${demoSupplier.openingBalance}`,
          totalDebit: demoSupplier.openingBalance,
          totalCredit: demoSupplier.openingBalance,
          status: 'posted',
          createdBy: 'System',
          postedBy: 'System',
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: ownerCapitalAccount.id,
                description: `${demoSupplier.name} Supplier Opening Balance : ${demoSupplier.openingBalance}`,
                debit: demoSupplier.openingBalance,
                credit: 0,
                lineOrder: 0,
              },
              {
                accountId: supplierAccount.id,
                description: `${demoSupplier.name} Supplier Opening Balance : ${demoSupplier.openingBalance}`,
                debit: 0,
                credit: demoSupplier.openingBalance,
                lineOrder: 1,
              },
            ],
          },
        },
      });

      // Update account balances
      await prisma.account.update({
        where: { id: ownerCapitalAccount.id },
        data: { currentBalance: { increment: -demoSupplier.openingBalance } },
      });

      await prisma.account.update({
        where: { id: supplierAccount.id },
        data: { currentBalance: { increment: demoSupplier.openingBalance } },
      });

      log(`✅ Opening balance journal entry created: ${openingJournal.entryNo}`, 'green');
    }

    // Step 2: Create or Find Demo Part
    log('\n📦 Step 2: Creating Demo Part...', 'blue');
    let demoPart = await prisma.part.findFirst({
      where: { partNo: 'DEMO-PART-001' },
    });

    if (!demoPart) {
      // Get or create a brand
      let brand = await prisma.brand.findFirst({ where: { name: 'Demo Brand' } });
      if (!brand) {
        brand = await prisma.brand.create({ data: { name: 'Demo Brand' } });
      }

      demoPart = await prisma.part.create({
        data: {
          partNo: 'DEMO-PART-001',
          description: 'Demo Part - Wind Shield/HAV239/Denso',
          brandId: brand.id,
          cost: 3000,
          priceA: 5000,
          status: 'active',
        },
      });
      log(`✅ Part created: ${demoPart.partNo}`, 'green');
    } else {
      log(`✅ Part already exists: ${demoPart.partNo}`, 'green');
    }

    // Step 3: Create Purchase Order
    log('\n🛒 Step 3: Creating Purchase Order...', 'blue');
    
    // Check if demo PO already exists
    let demoPO = await prisma.purchaseOrder.findFirst({
      where: { poNumber: { contains: 'DEMO' } },
    });

    if (demoPO) {
      log(`⚠️  Demo PO already exists: ${demoPO.poNumber}`, 'yellow');
      log('   Deleting existing demo PO...', 'yellow');
      await prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: demoPO.id },
      });
      
      // Delete related journal entries
      await prisma.journalLine.deleteMany({
        where: {
          journalEntry: {
            reference: { contains: demoPO.poNumber },
          },
        },
      });
      await prisma.journalEntry.deleteMany({
        where: {
          reference: { contains: demoPO.poNumber },
        },
      });
      
      await prisma.purchaseOrder.delete({ where: { id: demoPO.id } });
      log('   ✅ Old demo PO deleted', 'green');
    }

    const poDate = new Date('2026-01-02');
    const poNumber = `PO-DEMO-001`;

    demoPO = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        date: poDate,
        supplierId: demoSupplier.id,
        status: 'Draft',
        totalAmount: 0,
        items: {
          create: {
            partId: demoPart.id,
            quantity: 12,
            unitCost: 6000,
            totalCost: 72000,
            receivedQty: 0,
          },
        },
      },
      include: { items: true },
    });

    // Update total amount
    const totalAmount = demoPO.items.reduce((sum, item) => sum + item.totalCost, 0);
    demoPO = await prisma.purchaseOrder.update({
      where: { id: demoPO.id },
      data: { totalAmount },
    });

    log(`✅ Purchase Order created: ${demoPO.poNumber}`, 'green');
    log(`   Total Amount: ${demoPO.totalAmount.toLocaleString()}`, 'green');

    // Step 4: Receive Purchase Order
    log('\n📥 Step 4: Receiving Purchase Order...', 'blue');
    
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: demoPO.id },
    });

    // Update PO status to Received
    const receivedPO = await prisma.purchaseOrder.update({
      where: { id: demoPO.id },
      data: {
        status: 'Received',
      },
      include: { items: true },
    });

    // Update items separately
    if (poItems.length > 0) {
      await prisma.purchaseOrderItem.update({
        where: { id: poItems[0].id },
        data: { receivedQty: 12 },
      });
    }

    log(`✅ Purchase Order received: ${receivedPO.poNumber}`, 'green');

    // Create journal entry for PO
    const inventoryAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { code: '101001' },
          { code: '104005' },
          { code: '104001' },
        ],
      },
    });

    if (inventoryAccount && supplierAccount) {
      const count = await prisma.journalEntry.count();
      const entryNo = `JV${String(count + 1).padStart(4, '0')}`;
      const grandTotal = receivedPO.totalAmount;

      const journalEntry = await prisma.journalEntry.create({
        data: {
          entryNo,
          entryDate: receivedPO.date,
          reference: `PO-${receivedPO.poNumber}`,
          description: `Purchase Order ${receivedPO.poNumber} received from ${demoSupplier.companyName}`,
          totalDebit: grandTotal,
          totalCredit: grandTotal,
          status: 'posted',
          createdBy: 'System',
          postedBy: 'System',
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: inventoryAccount.id,
                description: `PO: ${receivedPO.poNumber} Inventory Added ,${demoPart.partNo}/, Qty 12, Rate 6000, Cost: 3000`,
                debit: grandTotal,
                credit: 0,
                lineOrder: 0,
              },
              {
                accountId: supplierAccount.id,
                description: `PO: ${receivedPO.poNumber} ${demoSupplier.name} Liability Created`,
                debit: 0,
                credit: grandTotal,
                lineOrder: 1,
              },
            ],
          },
        },
      });

      // Update account balances
      const inventoryType = inventoryAccount.subgroup?.mainGroup?.type?.toLowerCase() || 'asset';
      const supplierType = supplierAccount.subgroup?.mainGroup?.type?.toLowerCase() || 'liability';
      
      const inventoryChange = (inventoryType === 'asset' || inventoryType === 'expense' || inventoryType === 'cost')
        ? grandTotal : -grandTotal;
      const supplierChange = (supplierType === 'asset' || supplierType === 'expense' || supplierType === 'cost')
        ? -grandTotal : grandTotal;

      await prisma.account.update({
        where: { id: inventoryAccount.id },
        data: { currentBalance: { increment: inventoryChange } },
      });

      await prisma.account.update({
        where: { id: supplierAccount.id },
        data: { currentBalance: { increment: supplierChange } },
      });

      log(`✅ PO Journal entry created: ${journalEntry.entryNo}`, 'green');
      log(`   Debit: ${grandTotal.toLocaleString()} (Inventory)`, 'green');
      log(`   Credit: ${grandTotal.toLocaleString()} (Supplier Account)`, 'green');
    }

    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('✅ DEMO DATA CREATED SUCCESSFULLY!', 'green');
    log('='.repeat(60), 'cyan');
    log('\n📊 Demo Data Summary:', 'blue');
    log(`   ✅ Supplier: ${demoSupplier.code} - ${demoSupplier.companyName}`, 'green');
    log(`      Name: ${demoSupplier.name}`, 'green');
    log(`      Opening Balance: ${demoSupplier.openingBalance.toLocaleString()}`, 'green');
    log(`   ✅ Supplier Account: ${supplierAccount.code}-${supplierAccount.name}`, 'green');
    log(`   ✅ Purchase Order: ${demoPO.poNumber}`, 'green');
    log(`      Amount: ${demoPO.totalAmount.toLocaleString()}`, 'green');
    log(`   ✅ Journal Entries: 2 created`, 'green');
    log('\n📍 Where to View in App:', 'blue');
    log('   1. General Journal: /financial-statements (General Journal tab)', 'cyan');
    log('   2. Balance Sheet: /financial-statements (Balance Sheet tab)', 'cyan');
    log('   3. Trial Balance: /financial-statements (Trial Balance tab)', 'cyan');
    log('   4. Ledgers: /financial-statements (Ledgers tab)', 'cyan');
    log('   5. Suppliers: /manage (Suppliers tab)', 'cyan');
    log('   6. Purchase Orders: /inventory (Purchase Orders)', 'cyan');
    log('\n🎉 Demo data is ready to view in your app!', 'green');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createDemoData();

