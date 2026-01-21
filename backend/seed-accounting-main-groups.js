const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mainGroups = [
  { code: '1', name: 'Current Assets', type: 'Asset', displayOrder: 1 },
  { code: '2', name: 'Long Term Assets', type: 'Asset', displayOrder: 2 },
  { code: '3', name: 'Current Liabilities', type: 'Liability', displayOrder: 3 },
  { code: '4', name: 'Long Term Liabilities', type: 'Liability', displayOrder: 4 },
  { code: '5', name: 'Capital', type: 'Equity', displayOrder: 5 },
  { code: '6', name: 'Drawings', type: 'Equity', displayOrder: 6 },
  { code: '7', name: 'Revenues', type: 'Revenue', displayOrder: 7 },
  { code: '8', name: 'Expenses', type: 'Expense', displayOrder: 8 },
  { code: '9', name: 'Cost', type: 'Expense', displayOrder: 9 },
];

async function seedMainGroups() {
  console.log('🌱 Seeding main groups...');
  
  for (const group of mainGroups) {
    try {
      // Check if group already exists
      const existing = await prisma.mainGroup.findUnique({
        where: { code: group.code },
      });

      if (existing) {
        console.log(`✓ Main group ${group.code} - ${group.name} already exists`);
        // Update displayOrder if needed
        if (existing.displayOrder !== group.displayOrder) {
          await prisma.mainGroup.update({
            where: { code: group.code },
            data: { displayOrder: group.displayOrder },
          });
          console.log(`  Updated displayOrder for ${group.code}`);
        }
      } else {
        await prisma.mainGroup.create({
          data: group,
        });
        console.log(`✓ Created main group: ${group.code} - ${group.name}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${group.code} - ${group.name}:`, error.message);
    }
  }

  console.log('✅ Main groups seeding completed!');
}

seedMainGroups()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding main groups:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
