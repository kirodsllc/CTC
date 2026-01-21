const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('==========================================');
    console.log('  Delete All Items (Parts) and Models');
    console.log('==========================================\n');
    
    // Step 1: Count current items
    const partCount = await prisma.part.count();
    const modelCount = await prisma.model.count();
    const priceHistoryCount = await prisma.priceHistory.count();
    // Count unique parts used in kits
    const allKitItems = await prisma.kitItem.findMany({
      select: { partId: true }
    });
    const uniquePartIds = new Set(allKitItems.map(ki => ki.partId));
    const kitItemCount = uniquePartIds.size;
    
    console.log('Current database state:');
    console.log(`  - Parts (Items): ${partCount}`);
    console.log(`  - Models: ${modelCount}`);
    console.log(`  - Price History records: ${priceHistoryCount}`);
    console.log(`  - Parts used in Kits: ${kitItemCount}\n`);
    
    if (partCount === 0) {
      console.log('✓ No parts found in database. Nothing to delete.');
      await prisma.$disconnect();
      process.exit(0);
    }
    
    // Step 2: Check for parts used in kits
    if (kitItemCount > 0) {
      console.log(`⚠ Warning: ${kitItemCount} part(s) are used in kits.`);
      console.log('  These parts cannot be deleted due to foreign key constraints.');
      console.log('  Deleting KitItems first...\n');
      
      const deletedKitItems = await prisma.kitItem.deleteMany({});
      console.log(`✓ Deleted ${deletedKitItems.count} KitItem(s)\n`);
    }
    
    // Step 3: Delete PriceHistory records (they don't have cascade delete)
    if (priceHistoryCount > 0) {
      console.log('Deleting PriceHistory records...');
      const deletedPriceHistory = await prisma.priceHistory.deleteMany({});
      console.log(`✓ Deleted ${deletedPriceHistory.count} PriceHistory record(s)\n`);
    }
    
    // Step 4: Delete all Models (they will be cascade deleted with Parts, but let's be explicit)
    if (modelCount > 0) {
      console.log('Deleting Models...');
      const deletedModels = await prisma.model.deleteMany({});
      console.log(`✓ Deleted ${deletedModels.count} Model(s)\n`);
    }
    
    // Step 5: Delete all Parts (this will cascade delete related records)
    console.log('Deleting all Parts (Items)...');
    const deletedParts = await prisma.part.deleteMany({});
    console.log(`✓ Deleted ${deletedParts.count} Part(s)\n`);
    
    // Step 6: Verify deletion
    const remainingParts = await prisma.part.count();
    const remainingModels = await prisma.model.count();
    const remainingPriceHistory = await prisma.priceHistory.count();
    
    console.log('==========================================');
    console.log('  Deletion Complete');
    console.log('==========================================');
    console.log(`Deleted: ${deletedParts.count} Part(s)`);
    console.log(`Deleted: ${modelCount} Model(s)`);
    console.log(`Deleted: ${priceHistoryCount} PriceHistory record(s)`);
    if (kitItemCount > 0) {
      console.log(`Deleted: ${kitItemCount} KitItem(s)`);
    }
    console.log('\nRemaining:');
    console.log(`  - Parts: ${remainingParts}`);
    console.log(`  - Models: ${remainingModels}`);
    console.log(`  - Price History: ${remainingPriceHistory}`);
    console.log('==========================================\n');
    
    if (remainingParts === 0 && remainingModels === 0) {
      console.log('✓ Successfully deleted all items and models!');
    } else {
      console.log('⚠ Warning: Some items may still remain.');
    }
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
})();

