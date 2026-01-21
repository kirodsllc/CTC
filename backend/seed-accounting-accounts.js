const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Accounts to seed - these are NOT fixed, can be changed or deleted
const accountsToSeed = [
  { code: '101001', name: 'Inventory', subgroupCode: '101', description: 'Inventory account' },
  { code: '401001', name: 'GST', subgroupCode: '401', description: 'GST account', mainGroupCode: '4' }, // Needs subgroup 401
  { code: '401002', name: 'Purchase Tax Payable', subgroupCode: '401', description: 'Purchase Tax Payable account', mainGroupCode: '4' }, // Needs subgroup 401
  { code: '501003', name: 'OWNER CAPITAL', subgroupCode: '501', description: 'Owner Capital account' },
  { code: '701001', name: 'Goods Sold', subgroupCode: '701', description: 'Goods Sold account' },
  { code: '701002', name: 'Goods Sold (Discounts)', subgroupCode: '701', description: 'Goods Sold Discounts account' },
  { code: '801002', name: 'Purchase Tax Expense', subgroupCode: '801', description: 'Purchase Tax Expense account' },
  { code: '801014', name: 'Dispose Inventory', subgroupCode: '801', description: 'Dispose Inventory account' },
  { code: '901001', name: 'Cost Inventory', subgroupCode: '901', description: 'Cost Inventory account' },
  { code: '901002', name: 'Cost Inventory (Discounts)', subgroupCode: '901', description: 'Cost Inventory Discounts account' },
];

async function seedAccounts() {
  console.log('🌱 Seeding accounts...');
  
  // Get all subgroups by code
  const subgroupsMap = new Map();
  const subgroups = await prisma.subgroup.findMany({
    include: { mainGroup: true },
  });
  subgroups.forEach(sg => {
    subgroupsMap.set(sg.code, sg);
  });

  // Get all main groups by code
  const mainGroupsMap = new Map();
  const mainGroups = await prisma.mainGroup.findMany();
  mainGroups.forEach(mg => {
    mainGroupsMap.set(mg.code, mg);
  });

  // Check if subgroup 401 exists, if not create it
  if (!subgroupsMap.has('401')) {
    const mainGroup4 = mainGroupsMap.get('4');
    if (mainGroup4) {
      try {
        const newSubgroup = await prisma.subgroup.create({
          data: {
            code: '401',
            name: 'Tax Payables',
            mainGroupId: mainGroup4.id,
            isActive: true,
            canDelete: true, // Not fixed
          },
        });
        subgroupsMap.set('401', newSubgroup);
        console.log(`✓ Created subgroup: 401 - Tax Payables (Main Group: ${mainGroup4.name})`);
      } catch (error) {
        console.error(`❌ Error creating subgroup 401:`, error.message);
      }
    } else {
      console.error(`❌ Main group 4 (Long Term Liabilities) not found`);
    }
  }

  for (const account of accountsToSeed) {
    try {
      const subgroup = subgroupsMap.get(account.subgroupCode);
      
      if (!subgroup) {
        console.error(`❌ Subgroup with code ${account.subgroupCode} not found for account ${account.code}`);
        continue;
      }

      // Check if account already exists
      const existing = await prisma.account.findUnique({
        where: { code: account.code },
      });

      if (existing) {
        console.log(`✓ Account ${account.code} - ${account.name} already exists`);
        // Update if needed (but user said they can be changed, so we'll skip updates)
      } else {
        await prisma.account.create({
          data: {
            code: account.code,
            name: account.name,
            description: account.description || null,
            subgroupId: subgroup.id,
            accountType: 'regular',
            openingBalance: 0,
            currentBalance: 0,
            status: 'Active',
            canDelete: true, // These accounts can be deleted/changed
          },
        });
        console.log(`✓ Created account: ${account.code} - ${account.name} (Subgroup: ${subgroup.code} - ${subgroup.name})`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${account.code} - ${account.name}:`, error.message);
    }
  }

  console.log('✅ Accounts seeding completed!');
}

seedAccounts()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding accounts:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
