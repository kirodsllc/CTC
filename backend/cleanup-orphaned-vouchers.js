const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Cleaning up orphaned vouchers from deleted Purchase Orders...\n');
    
    // Get all vouchers with PO references in narration
    const vouchers = await prisma.voucher.findMany({
      where: {
        OR: [
          { narration: { contains: 'PO-' } },
          { narration: { contains: 'Purchase Order' } },
        ]
      },
      include: {
        entries: true
      }
    });
    
    console.log(`Found ${vouchers.length} vouchers with PO references\n`);
    
    let orphanedCount = 0;
    const orphanedVouchers = [];
    
    for (const voucher of vouchers) {
      // Extract PO number from narration
      let poNumber = null;
      if (voucher.narration) {
        const match = voucher.narration.match(/Purchase Order[:\s]+(?:Number[:\s]+)?([A-Z0-9-]+)/i);
        if (match) {
          poNumber = match[1];
        }
      }
      
      // Also check entries descriptions
      if (!poNumber) {
        for (const entry of voucher.entries) {
          if (entry.description) {
            const match = entry.description.match(/PO[:\s-]+([A-Z0-9-]+)/);
            if (match) {
              poNumber = match[1];
              break;
            }
          }
        }
      }
      
      if (!poNumber) {
        console.log(`⚠️  Could not extract PO number from voucher ${voucher.voucherNumber}`);
        continue;
      }
      
      // Check if PO exists
      const po = await prisma.purchaseOrder.findFirst({
        where: {
          OR: [
            { poNumber: poNumber },
            { poNumber: `PO-${poNumber}` },
            { poNumber: { contains: poNumber } },
          ]
        }
      });
      
      if (!po) {
        orphanedCount++;
        orphanedVouchers.push({ voucher, poNumber });
        console.log(`Orphaned: Voucher ${voucher.voucherNumber} references non-existent PO "${poNumber}"`);
      }
    }
    
    if (orphanedCount === 0) {
      console.log('\n✓ No orphaned vouchers found. All vouchers reference existing POs.');
      await prisma.$disconnect();
      process.exit(0);
    }
    
    console.log(`\nFound ${orphanedCount} orphaned voucher(s)`);
    console.log('\nDeleting vouchers...\n');
    
    for (const { voucher } of orphanedVouchers) {
      await prisma.voucher.delete({
        where: { id: voucher.id }
      });
      console.log(`  ✓ Deleted voucher ${voucher.voucherNumber}`);
    }
    
    console.log(`\n✅ Successfully cleaned up ${orphanedCount} orphaned voucher(s)`);
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
})();

