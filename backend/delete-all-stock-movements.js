const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    try {
        console.log('⚠️  WARNING: This will DELETE ALL stock movements from the database!');
        console.log('This action cannot be undone.\n');

        // Count current stock movements
        const count = await prisma.stockMovement.count();
        console.log(`Found ${count} stock movement(s) in the database\n`);

        if (count === 0) {
            console.log('✓ No stock movements to delete.');
            await prisma.$disconnect();
            process.exit(0);
        }

        console.log('Deleting all stock movements...\n');

        // Delete all stock movements
        const deleted = await prisma.stockMovement.deleteMany({});

        console.log(`✅ Successfully deleted ${deleted.count} stock movement(s)\n`);
        console.log('✅ All stock movements have been deleted successfully!');
        console.log('\n📝 Note: Stock balances may need to be recalculated manually.');

        await prisma.$disconnect();
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    }
})();
