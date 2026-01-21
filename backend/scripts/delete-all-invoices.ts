import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function dbFilePathFromDatabaseUrl(url?: string): string | null {
  if (!url) return null;
  if (!url.startsWith('file:')) return null;
  const p = url.replace(/^file:/, '');
  return p.startsWith('/') ? p : path.resolve(process.cwd(), p);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const dbPath = dbFilePathFromDatabaseUrl(databaseUrl);

  console.log('==============================================');
  console.log('  Delete ALL Sales Invoices');
  console.log('==============================================\n');
  console.log(`DATABASE_URL: ${databaseUrl || '(missing)'}`);
  if (dbPath) console.log(`DB file:       ${dbPath}`);

  // Backup (best-effort)
  if (dbPath && fs.existsSync(dbPath)) {
    const backupPath = `${dbPath}.backup.${nowStamp()}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`\n✓ Backup created: ${backupPath}\n`);
  } else {
    console.log('\n⚠ No DB backup created (file not found or DATABASE_URL not file:...)\n');
  }

  const invoices = await prisma.salesInvoice.findMany({ select: { id: true, invoiceNo: true } });
  if (invoices.length === 0) {
    console.log('✓ No Sales Invoices found. Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  const invoiceIds = invoices.map((i) => i.id);
  console.log(`Found Sales Invoices: ${invoices.length}`);
  console.log(`Example invoiceNos: ${invoices.slice(0, 10).map((i) => i.invoiceNo).join(', ')}${invoices.length > 10 ? ', ...' : ''}\n`);

  // Break optional links that may default to Restrict/NoAction
  const quotationsLinked = await prisma.salesQuotation.count({ where: { invoiceId: { in: invoiceIds } } });
  if (quotationsLinked > 0) {
    const upd = await prisma.salesQuotation.updateMany({
      where: { invoiceId: { in: invoiceIds } },
      data: { invoiceId: null },
    });
    console.log(`✓ Unlinked SalesQuotations from invoices: ${upd.count}`);
  }

  // Delete sales returns explicitly (they cascade from invoice, but this keeps things clearer)
  const delReturns = await prisma.salesReturn.deleteMany({ where: { salesInvoiceId: { in: invoiceIds } } });
  if (delReturns.count > 0) console.log(`✓ Deleted Sales Returns: ${delReturns.count}`);

  // StockMovement.referenceId is not a FK, so clean it explicitly
  const delMovements = await prisma.stockMovement.deleteMany({
    where: {
      referenceType: { in: ['sales_invoice', 'SALES_INVOICE', 'Sales_Invoice'] },
      referenceId: { in: invoiceIds },
    },
  });
  if (delMovements.count > 0) console.log(`✓ Deleted Stock Movements for invoices: ${delMovements.count}`);

  // Delete invoices (cascade should remove items/reservations/delivery logs/receivable)
  const delInvoices = await prisma.salesInvoice.deleteMany({ where: { id: { in: invoiceIds } } });
  console.log(`✓ Deleted Sales Invoices: ${delInvoices.count}`);

  const remaining = await prisma.salesInvoice.count();
  console.log(`\nRemaining Sales Invoices: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Delete invoices failed:', e?.message || e);
  console.error(e?.stack || e);
  await prisma.$disconnect();
  process.exit(1);
});

