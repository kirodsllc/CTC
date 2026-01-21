const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('==========================================');
    console.log('  DELETE ITEMS ONLY FROM DATABASE');
    console.log('  Brands, Categories, Parts, Models, etc.');
    console.log('==========================================\n');

    // Get counts before deletion
    const counts = {
      models: await prisma.model.count(),
      priceHistory: await prisma.priceHistory.count(),
      parts: await prisma.part.count(),
      applications: await prisma.application.count(),
      subcategories: await prisma.subcategory.count(),
      categories: await prisma.category.count(),
      brands: await prisma.brand.count(),
      masterParts: await prisma.masterPart.count(),
    };

    console.log('Current items database counts:');
    console.log(`  Parts: ${counts.parts}`);
    console.log(`  Models: ${counts.models}`);
    console.log(`  Price History: ${counts.priceHistory}`);
    console.log(`  Brands: ${counts.brands}`);
    console.log(`  Categories: ${counts.categories}`);
    console.log(`  Subcategories: ${counts.subcategories}`);
    console.log(`  Applications: ${counts.applications}`);
    console.log(`  Master Parts: ${counts.masterParts}`);
    console.log('');

    const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (totalItems === 0) {
      console.log('✓ Database items are already empty. Nothing to delete.');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('Starting deletion process...\n');

    // ============================================
    // Step 1: Delete Models first (child of Parts)
    // ============================================
    console.log('Step 1: Deleting Models...');
    if (counts.models > 0) {
      const deleted = await prisma.model.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Models\n`);
    } else {
      console.log('  ✓ No Models to delete\n');
    }

    // ============================================
    // Step 2: Delete Price History
    // ============================================
    console.log('Step 2: Deleting Price History...');
    if (counts.priceHistory > 0) {
      const deleted = await prisma.priceHistory.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Price History records\n`);
    } else {
      console.log('  ✓ No Price History to delete\n');
    }

    // ============================================
    // Step 3: Delete Parts
    // ============================================
    console.log('Step 3: Deleting Parts...');
    if (counts.parts > 0) {
      const deleted = await prisma.part.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Parts\n`);
    } else {
      console.log('  ✓ No Parts to delete\n');
    }

    // ============================================
    // Step 4: Delete Attributes (in correct order)
    // ============================================
    console.log('Step 4: Deleting Attributes...');

    // Applications (must be first due to foreign keys)
    if (counts.applications > 0) {
      const deleted = await prisma.application.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Applications`);
    }

    // Subcategories
    if (counts.subcategories > 0) {
      const deleted = await prisma.subcategory.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Subcategories`);
    }

    // Categories
    if (counts.categories > 0) {
      const deleted = await prisma.category.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Categories`);
    }

    // Brands
    if (counts.brands > 0) {
      const deleted = await prisma.brand.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Brands`);
    }

    // Master Parts
    if (counts.masterParts > 0) {
      const deleted = await prisma.masterPart.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Master Parts`);
    }

    console.log('');

    // ============================================
    // Verification
    // ============================================
    console.log('==========================================');
    console.log('  DELETION COMPLETE');
    console.log('==========================================\n');

    const remainingCounts = {
      parts: await prisma.part.count(),
      models: await prisma.model.count(),
      brands: await prisma.brand.count(),
      categories: await prisma.category.count(),
      subcategories: await prisma.subcategory.count(),
      applications: await prisma.application.count(),
      masterParts: await prisma.masterPart.count(),
    };

    console.log('Remaining items:');
    console.log(`  Parts: ${remainingCounts.parts}`);
    console.log(`  Models: ${remainingCounts.models}`);
    console.log(`  Brands: ${remainingCounts.brands}`);
    console.log(`  Categories: ${remainingCounts.categories}`);
    console.log(`  Subcategories: ${remainingCounts.subcategories}`);
    console.log(`  Applications: ${remainingCounts.applications}`);
    console.log(`  Master Parts: ${remainingCounts.masterParts}`);
    console.log('');

    const totalRemaining = Object.values(remainingCounts).reduce((sum, count) => sum + count, 0);
    if (totalRemaining === 0) {
      console.log('✅ SUCCESS! All items have been deleted from database!');
    } else {
      console.log('⚠️  Warning: Some items may still remain.');
    }

    console.log('\n==========================================\n');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
