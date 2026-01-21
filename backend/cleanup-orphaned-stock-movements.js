const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Cleaning up orphaned stock movements from deleted Purchase Orders...\n');
    
    // Get all stock movements with purchase reference
    const movements = await prisma.stockMovement.findMany({
      where: {
        referenceType: 'purchase'
      }
    });
    
    console.log(`Found ${movements.length} stock movements with purchase reference\n`);
    
    let orphanedCount = 0;
    const orphanedIds = [];
    
    for (const m of movements) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: m.referenceId }
      });
      
      if (!po) {
        orphanedCount++;
        orphanedIds.push(m.id);
        console.log(`Orphaned: Movement ${m.id} references non-existent PO ${m.referenceId}`);
      }
    }
    
    if (orphanedCount === 0) {
      console.log('\n✓ No orphaned stock movements found. All stock movements reference existing POs.');
      await prisma.$disconnect();
      process.exit(0);
    }
    
    console.log(`\nFound ${orphanedCount} orphaned stock movement(s)`);
    console.log('\nDeleting orphaned stock movements...');
    
    const deleted = await prisma.stockMovement.deleteMany({
      where: {
        id: { in: orphanedIds }
      }
    });
    
    console.log(`✓ Deleted ${deleted.count} orphaned stock movement(s)`);
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();

