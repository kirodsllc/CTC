const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Cleaning up orphaned journal entries from deleted Purchase Orders...\n');
    
    // Get all journal entries with PO references
    const entries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          { reference: { contains: 'PO-' } },
          { description: { contains: 'PO:' } },
          { description: { contains: 'PO-' } },
        ]
      },
      include: {
        lines: {
          include: {
            account: {
              include: {
                subgroup: {
                  include: {
                    mainGroup: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    console.log(`Found ${entries.length} journal entries with PO references\n`);
    
    let orphanedCount = 0;
    const orphanedEntries = [];
    
    for (const entry of entries) {
      // Extract PO number from reference or description
      let poNumber = null;
      if (entry.reference) {
        // Handle formats like "PO-PO-API-TEST-001" or "PO-API-TEST-001"
        const match = entry.reference.match(/PO-+(.+)$/);
        if (match) {
          poNumber = match[1];
        }
      }
      
      if (!poNumber && entry.description) {
        const match = entry.description.match(/PO[:\s-]+([A-Z0-9-]+)/);
        if (match) {
          poNumber = match[1];
        }
      }
      
      if (!poNumber) {
        console.log(`⚠️  Could not extract PO number from entry ${entry.entryNo}`);
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
        orphanedEntries.push({ entry, poNumber });
        console.log(`Orphaned: Entry ${entry.entryNo} references non-existent PO "${poNumber}"`);
      }
    }
    
    if (orphanedCount === 0) {
      console.log('\n✓ No orphaned journal entries found. All entries reference existing POs.');
      await prisma.$disconnect();
      process.exit(0);
    }
    
    console.log(`\nFound ${orphanedCount} orphaned journal entry/entries`);
    console.log('\nReversing account balances and deleting entries...\n');
    
    for (const { entry, poNumber } of orphanedEntries) {
      // Reverse account balances if posted
      if (entry.status === 'posted') {
        for (const line of entry.lines) {
          const accountType = line.account.subgroup.mainGroup.type.toLowerCase();
          const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
            ? (line.credit - line.debit)
            : (line.debit - line.credit);
          
          await prisma.account.update({
            where: { id: line.accountId },
            data: {
              currentBalance: {
                increment: balanceChange,
              },
            },
          });
        }
        console.log(`  ✓ Reversed balances for entry ${entry.entryNo}`);
      }
      
      // Delete the entry
      await prisma.journalEntry.delete({
        where: { id: entry.id }
      });
      console.log(`  ✓ Deleted entry ${entry.entryNo}`);
    }
    
    console.log(`\n✅ Successfully cleaned up ${orphanedCount} orphaned journal entry/entries`);
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
})();

