const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Fixed subgroups mapping: code -> { name, mainGroupCode }
const fixedSubgroups = [
  // Assets (Main Group 1 - Current Assets)
  { code: '101', name: 'Inventory', mainGroupCode: '1' },
  { code: '102', name: 'Cash', mainGroupCode: '1' },
  { code: '103', name: 'Bank', mainGroupCode: '1' },
  { code: '104', name: 'Sales Customer Receivables', mainGroupCode: '1' },
  // Liabilities (Main Group 3 - Current Liabilities)
  { code: '301', name: 'Purchase Orders Payables', mainGroupCode: '3' },
  { code: '302', name: 'Purchase expenses Payables', mainGroupCode: '3' },
  // Liabilities (Main Group 4 - Long Term Liabilities)
  { code: '304', name: 'Other Payables', mainGroupCode: '4' },
  { code: '401', name: 'Tax Payables', mainGroupCode: '4' },
  // Capital (Main Group 5 - Capital)
  { code: '501', name: 'Owner Equity', mainGroupCode: '5' },
  // Revenue (Main Group 7 - Revenues) - Not in Balance Sheet
  { code: '701', name: 'Goods Revenue', mainGroupCode: '7' },
  // Expenses (Main Group 8 - Expenses) - Not in Balance Sheet
  { code: '801', name: 'Purchase Expenses', mainGroupCode: '8' },
  // Cost (Main Group 9 - Cost) - Not in Balance Sheet
  { code: '901', name: 'Goods Purchased Cost', mainGroupCode: '9' },
];

async function seedSubgroups() {
  console.log('🌱 Seeding fixed subgroups...');
  
  // First, get all main groups by code
  const mainGroupsMap = new Map();
  const mainGroups = await prisma.mainGroup.findMany();
  mainGroups.forEach(mg => {
    mainGroupsMap.set(mg.code, mg);
  });

  for (const subgroup of fixedSubgroups) {
    try {
      const mainGroup = mainGroupsMap.get(subgroup.mainGroupCode);
      
      if (!mainGroup) {
        console.error(`❌ Main group with code ${subgroup.mainGroupCode} not found for subgroup ${subgroup.code}`);
        continue;
      }

      // Check if subgroup already exists
      const existing = await prisma.subgroup.findUnique({
        where: { code: subgroup.code },
      });

      if (existing) {
        console.log(`✓ Subgroup ${subgroup.code} - ${subgroup.name} already exists`);
        // Update canDelete to false if needed
        if (existing.canDelete) {
          await prisma.subgroup.update({
            where: { code: subgroup.code },
            data: { canDelete: false },
          });
          console.log(`  Updated canDelete to false for ${subgroup.code}`);
        }
      } else {
        await prisma.subgroup.create({
          data: {
            code: subgroup.code,
            name: subgroup.name,
            mainGroupId: mainGroup.id,
            isActive: true,
            canDelete: false, // Fixed subgroups cannot be deleted
          },
        });
        console.log(`✓ Created subgroup: ${subgroup.code} - ${subgroup.name} (Main Group: ${mainGroup.name})`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${subgroup.code} - ${subgroup.name}:`, error.message);
    }
  }

  console.log('✅ Subgroups seeding completed!');
}

seedSubgroups()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding subgroups:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
