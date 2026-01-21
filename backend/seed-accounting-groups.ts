import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAccountingGroups() {
  try {
    console.log('🌱 Seeding Accounting Main Groups and Subgroups...\n');

    // Define Main Groups
    const mainGroupsData = [
      { code: '1', name: 'Current Assets', type: 'Asset', displayOrder: 1 },
      { code: '2', name: 'Long Term Assets', type: 'Asset', displayOrder: 2 },
      { code: '3', name: 'Current Liabilities', type: 'Liability', displayOrder: 3 },
      { code: '4', name: 'Long Term Liabilities', type: 'Liability', displayOrder: 4 },
      { code: '5', name: 'Capital', type: 'Equity', displayOrder: 5 },
      { code: '6', name: 'Drawings', type: 'Equity', displayOrder: 6 },
      { code: '7', name: 'Revenues', type: 'Revenue', displayOrder: 7 },
      { code: '8', name: 'Expenses', type: 'Expense', displayOrder: 8 },
      { code: '9', name: 'Cost', type: 'Cost', displayOrder: 9 },
    ];

    // Create or update Main Groups
    const createdMainGroups: any[] = [];
    for (const mgData of mainGroupsData) {
      const mg = await prisma.mainGroup.upsert({
        where: { code: mgData.code },
        update: {
          name: mgData.name,
          type: mgData.type,
          displayOrder: mgData.displayOrder,
        },
        create: mgData,
      });
      createdMainGroups.push(mg);
      console.log(`✅ Main Group: ${mg.code} - ${mg.name}`);
    }

    console.log(`\n✅ ${createdMainGroups.length} Main Groups created/updated\n`);

    // Define Subgroups for each Main Group
    const subgroupsData = [
      // Current Assets (1)
      { mainGroupCode: '1', code: '101', name: 'Cash and Cash Equivalents' },
      { mainGroupCode: '1', code: '102', name: 'Bank Accounts' },
      { mainGroupCode: '1', code: '103', name: 'Accounts Receivable' },
      { mainGroupCode: '1', code: '104', name: 'Inventory' },
      { mainGroupCode: '1', code: '105', name: 'Prepaid Expenses' },
      { mainGroupCode: '1', code: '106', name: 'Short-term Investments' },
      { mainGroupCode: '1', code: '107', name: 'Other Current Assets' },

      // Long Term Assets (2)
      { mainGroupCode: '2', code: '201', name: 'Fixed Assets' },
      { mainGroupCode: '2', code: '202', name: 'Property, Plant & Equipment' },
      { mainGroupCode: '2', code: '203', name: 'Intangible Assets' },
      { mainGroupCode: '2', code: '204', name: 'Long-term Investments' },
      { mainGroupCode: '2', code: '205', name: 'Accumulated Depreciation' },
      { mainGroupCode: '2', code: '206', name: 'Other Long-term Assets' },

      // Current Liabilities (3)
      { mainGroupCode: '3', code: '301', name: 'Accounts Payable' },
      { mainGroupCode: '3', code: '302', name: 'Short-term Loans' },
      { mainGroupCode: '3', code: '303', name: 'Accrued Expenses' },
      { mainGroupCode: '3', code: '304', name: 'Tax Payable' },
      { mainGroupCode: '3', code: '305', name: 'Unearned Revenue' },
      { mainGroupCode: '3', code: '306', name: 'Current Portion of Long-term Debt' },
      { mainGroupCode: '3', code: '307', name: 'Other Current Liabilities' },

      // Long Term Liabilities (4)
      { mainGroupCode: '4', code: '401', name: 'Long-term Loans' },
      { mainGroupCode: '4', code: '402', name: 'Bonds Payable' },
      { mainGroupCode: '4', code: '403', name: 'Mortgage Payable' },
      { mainGroupCode: '4', code: '404', name: 'Deferred Tax Liabilities' },
      { mainGroupCode: '4', code: '405', name: 'Other Long-term Liabilities' },

      // Capital (5)
      { mainGroupCode: '5', code: '501', name: "Owner's Capital" },
      { mainGroupCode: '5', code: '502', name: 'Share Capital' },
      { mainGroupCode: '5', code: '503', name: 'Retained Earnings' },
      { mainGroupCode: '5', code: '504', name: 'Additional Paid-in Capital' },
      { mainGroupCode: '5', code: '505', name: 'Reserves' },

      // Drawings (6)
      { mainGroupCode: '6', code: '601', name: "Owner's Drawings" },
      { mainGroupCode: '6', code: '602', name: 'Partner Drawings' },
      { mainGroupCode: '6', code: '603', name: 'Dividends' },

      // Revenues (7)
      { mainGroupCode: '7', code: '701', name: 'Sales Revenue' },
      { mainGroupCode: '7', code: '702', name: 'Service Revenue' },
      { mainGroupCode: '7', code: '703', name: 'Interest Income' },
      { mainGroupCode: '7', code: '704', name: 'Other Income' },
      { mainGroupCode: '7', code: '705', name: 'Discount Received' },

      // Expenses (8)
      { mainGroupCode: '8', code: '801', name: 'Operating Expenses' },
      { mainGroupCode: '8', code: '802', name: 'Salaries and Wages' },
      { mainGroupCode: '8', code: '803', name: 'Rent Expense' },
      { mainGroupCode: '8', code: '804', name: 'Utilities Expense' },
      { mainGroupCode: '8', code: '805', name: 'Marketing Expenses' },
      { mainGroupCode: '8', code: '806', name: 'Administrative Expenses' },
      { mainGroupCode: '8', code: '807', name: 'Depreciation Expense' },
      { mainGroupCode: '8', code: '808', name: 'Interest Expense' },
      { mainGroupCode: '8', code: '809', name: 'Tax Expense' },
      { mainGroupCode: '8', code: '810', name: 'Other Expenses' },

      // Cost (9)
      { mainGroupCode: '9', code: '901', name: 'Cost of Goods Sold' },
      { mainGroupCode: '9', code: '902', name: 'Direct Materials' },
      { mainGroupCode: '9', code: '903', name: 'Direct Labor' },
      { mainGroupCode: '9', code: '904', name: 'Manufacturing Overhead' },
      { mainGroupCode: '9', code: '905', name: 'Purchase Discount' },
    ];

    // Create or update Subgroups
    const createdSubgroups: any[] = [];
    for (const sgData of subgroupsData) {
      const mainGroup = createdMainGroups.find(mg => mg.code === sgData.mainGroupCode);
      if (mainGroup) {
        const sg = await prisma.subgroup.upsert({
          where: { code: sgData.code },
          update: {
            name: sgData.name,
            mainGroupId: mainGroup.id,
            isActive: true,
          },
          create: {
            mainGroupId: mainGroup.id,
            code: sgData.code,
            name: sgData.name,
            isActive: true,
            canDelete: true,
          },
        });
        createdSubgroups.push(sg);
        console.log(`  ✅ Subgroup: ${sg.code} - ${sg.name} (${mainGroup.name})`);
      } else {
        console.error(`  ❌ Main Group not found for code: ${sgData.mainGroupCode}`);
      }
    }

    console.log(`\n✅ ${createdSubgroups.length} Subgroups created/updated`);
    console.log('\n🎉 Accounting Groups seeding completed successfully!\n');

  } catch (error) {
    console.error('❌ Error seeding accounting groups:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedAccountingGroups()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

