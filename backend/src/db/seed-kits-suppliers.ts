import prisma from '../config/database';

async function seedKitsAndSuppliers() {
  try {
    console.log('🌱 Seeding kits and suppliers...');
    
    // Create tables if they don't exist
    console.log('📋 Creating tables if needed...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Kit" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "badge" TEXT NOT NULL UNIQUE,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "sellingPrice" REAL NOT NULL DEFAULT 0,
          "totalCost" REAL NOT NULL DEFAULT 0,
          "itemsCount" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'Active',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `);
      
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "KitItem" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "kitId" TEXT NOT NULL,
          "partId" TEXT NOT NULL,
          "partNo" TEXT NOT NULL,
          "partName" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL DEFAULT 1,
          "costPerUnit" REAL NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "KitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "KitItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);
      
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "KitItem_kitId_idx" ON "KitItem"("kitId");`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "KitItem_partId_idx" ON "KitItem"("partId");`);
      console.log('✅ Tables created/verified');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.log('⚠️  Tables may already exist or error creating:', error.message);
      }
    }
    
    // Get parts for kits
    const parts = await prisma.part.findMany({ take: 20 });
    if (parts.length < 5) {
      console.log('⚠️  Need at least 5 parts to create kits');
      return;
    }

    // Seed Kits
    console.log('📦 Seeding kits...');
    const kitsData = [
      {
        badge: 'KIT-001',
        name: 'Brake Service Kit',
        description: 'Complete brake service kit including pads, discs, and fluid',
        sellingPrice: 8500,
        status: 'Active',
        items: [
          { partIndex: 3, quantity: 1, partNo: parts[3]?.partNo || 'BRK-001' },
          { partIndex: 4, quantity: 1, partNo: parts[4]?.partNo || 'BRK-002' },
        ],
      },
      {
        badge: 'KIT-002',
        name: 'Engine Maintenance Kit',
        description: 'Essential engine maintenance parts kit',
        sellingPrice: 3500,
        status: 'Active',
        items: [
          { partIndex: 0, quantity: 1, partNo: parts[0]?.partNo || 'ENG-001' },
          { partIndex: 1, quantity: 1, partNo: parts[1]?.partNo || 'ENG-002' },
          { partIndex: 2, quantity: 1, partNo: parts[2]?.partNo || 'ENG-003' },
        ],
      },
      {
        badge: 'KIT-003',
        name: 'Filter Replacement Kit',
        description: 'Complete filter replacement kit for regular maintenance',
        sellingPrice: 2000,
        status: 'Active',
        items: [
          { partIndex: 0, quantity: 1, partNo: parts[0]?.partNo || 'ENG-001' },
          { partIndex: 1, quantity: 1, partNo: parts[1]?.partNo || 'ENG-002' },
        ],
      },
      {
        badge: 'KIT-004',
        name: 'Electrical System Kit',
        description: 'Complete electrical system components',
        sellingPrice: 25000,
        status: 'Active',
        items: [
          { partIndex: 5, quantity: 1, partNo: parts[5]?.partNo || 'ELC-001' },
          { partIndex: 6, quantity: 1, partNo: parts[6]?.partNo || 'ELC-002' },
        ],
      },
      {
        badge: 'KIT-005',
        name: 'Cooling System Kit',
        description: 'Complete cooling system maintenance kit',
        sellingPrice: 12000,
        status: 'Active',
        items: [
          { partIndex: 7, quantity: 1, partNo: parts[7]?.partNo || 'ENG-008' },
          { partIndex: 8, quantity: 1, partNo: parts[8]?.partNo || 'ENG-009' },
        ],
      },
    ];

    const createdKits = [];
    for (const kitData of kitsData) {
      const existing = await prisma.kit.findUnique({
        where: { badge: kitData.badge },
      });
      
      if (!existing) {
        let totalCost = 0;
        const kitItems = [];

        for (const item of kitData.items) {
          const part = parts[item.partIndex];
          if (part && part.cost) {
            const itemCost = part.cost * item.quantity;
            totalCost += itemCost;
            kitItems.push({
              partId: part.id,
              partNo: item.partNo,
              partName: part.description || item.partNo,
              quantity: item.quantity,
              costPerUnit: part.cost,
            });
          }
        }

        try {
          const kit = await prisma.kit.create({
            data: {
              badge: kitData.badge,
              name: kitData.name,
              description: kitData.description,
              sellingPrice: kitData.sellingPrice,
              totalCost: totalCost,
              itemsCount: kitItems.length,
              status: kitData.status,
              items: {
                create: kitItems,
              },
            },
          });
          createdKits.push(kit);
        } catch (error: any) {
          if (error.code !== 'P2002') {
            console.error(`Error creating kit ${kitData.badge}:`, error);
          }
        }
      }
    }
    console.log(`✅ ${createdKits.length} kits seeded`);

    // Seed Additional Suppliers
    console.log('🏭 Seeding additional suppliers...');
    const additionalSuppliersData = [
      {
        code: 'SUP-005',
        name: 'Global Auto Parts',
        companyName: 'Global Auto Parts Trading Company',
        address: '500 Export Zone, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        country: 'Pakistan',
        zipCode: '75000',
        email: 'sales@globalautoparts.com',
        phone: '+92-21-34567890',
        contactPerson: 'Mr. Tariq Mehmood',
        taxId: 'TAX-005-2024',
        paymentTerms: 'Net 30',
        notes: 'International supplier',
        status: 'active',
      },
      {
        code: 'SUP-006',
        name: 'Premium Components',
        companyName: 'Premium Components Manufacturing',
        address: '600 Production Avenue, Lahore',
        city: 'Lahore',
        state: 'Punjab',
        country: 'Pakistan',
        zipCode: '54000',
        email: 'orders@premiumcomponents.com',
        phone: '+92-42-45678901',
        contactPerson: 'Ms. Ayesha Malik',
        taxId: 'TAX-006-2024',
        paymentTerms: 'Net 15',
        notes: 'Premium quality parts',
        status: 'active',
      },
    ];

    for (const supplierData of additionalSuppliersData) {
      await prisma.supplier.upsert({
        where: { code: supplierData.code },
        update: supplierData,
        create: supplierData,
      });
    }
    console.log(`✅ ${additionalSuppliersData.length} additional suppliers seeded`);

    // Final count
    const allKits = await prisma.kit.findMany({ where: { status: 'Active' } });
    const allSuppliers = await prisma.supplier.findMany({ where: { status: 'active' } });
    
    console.log('✅ Seeding completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Active Kits: ${allKits.length}`);
    console.log(`   - Active Suppliers: ${allSuppliers.length}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// SEED FILE DISABLED - Do not run automatically
// To re-enable, uncomment the code below
/*
// Run if called directly
if (require.main === module) {
  seedKitsAndSuppliers()
    .then(() => {
      console.log('✅ Seed process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed process failed:', error);
      process.exit(1);
    });
}
*/

export default seedKitsAndSuppliers;

