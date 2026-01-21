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
  console.log('  Delete ALL Accounts');
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

  const accountCount = await prisma.account.count();
  if (accountCount === 0) {
    console.log('✓ No accounts found. Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found accounts: ${accountCount}\n`);

  // Break optional links that could block deletion
  const voucherEntriesLinked = await prisma.voucherEntry.count({ where: { accountId: { not: null } } });
  if (voucherEntriesLinked > 0) {
    const upd = await prisma.voucherEntry.updateMany({
      where: { accountId: { not: null } },
      data: { accountId: null },
    });
    console.log(`✓ Unlinked VoucherEntries from accounts: ${upd.count}`);
  }

  const invoicesLinked = await prisma.salesInvoice.count({ where: { accountId: { not: null } } });
  if (invoicesLinked > 0) {
    const upd = await prisma.salesInvoice.updateMany({
      where: { accountId: { not: null } },
      data: { accountId: null },
    });
    console.log(`✓ Unlinked SalesInvoices from accounts: ${upd.count}`);
  }

  // Deleting accounts will cascade JournalLines (onDelete: Cascade).
  const delAccounts = await prisma.account.deleteMany({});
  console.log(`✓ Deleted accounts: ${delAccounts.count}`);

  // Cleanup orphaned journal entries that have no lines anymore (optional)
  const orphaned = await prisma.journalEntry.findMany({
    where: { lines: { none: {} } },
    select: { id: true },
  });
  if (orphaned.length > 0) {
    const delJ = await prisma.journalEntry.deleteMany({ where: { id: { in: orphaned.map((j) => j.id) } } });
    console.log(`✓ Deleted orphaned journal entries (no lines): ${delJ.count}`);
  }

  const remaining = await prisma.account.count();
  console.log(`\nRemaining accounts: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Delete accounts failed:', e?.message || e);
  console.error(e?.stack || e);
  await prisma.$disconnect();
  process.exit(1);
});

