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

function isTestText(v?: string | null): boolean {
  if (!v) return false;
  const s = String(v).trim();
  if (!s) return false;
  // Avoid accidental matches like "attest" by using word boundary when possible
  return /\btest\b/i.test(s) || /^test/i.test(s);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const dbPath = dbFilePathFromDatabaseUrl(databaseUrl);

  console.log('==============================================');
  console.log('  Cleanup TEST Accounts (Person Accounts)');
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

  const allAccounts = await prisma.account.findMany({
    select: { id: true, code: true, name: true, description: true, canDelete: true },
  });

  const candidates = allAccounts.filter((a) => {
    const name = String(a.name || '');
    const desc = String(a.description || '');
    const hasTest =
      isTestText(a.name) ||
      isTestText(a.description) ||
      name.toLowerCase().includes('test') ||
      desc.toLowerCase().includes('test');
    return hasTest;
  });

  if (candidates.length === 0) {
    console.log('✓ No test accounts found (with canDelete=true). Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  const accountIds = candidates.map((a) => a.id);
  const locked = candidates.filter((a) => a.canDelete === false);
  console.log(`Found test accounts to delete: ${candidates.length} (locked/system: ${locked.length})`);
  console.log(
    `Examples: ${candidates
      .slice(0, 12)
      .map((a) => `${a.code}:${a.name}`)
      .join(', ')}${candidates.length > 12 ? ', ...' : ''}\n`,
  );

  // Unlink optional references that could block deletion
  const voucherEntriesLinked = await prisma.voucherEntry.count({ where: { accountId: { in: accountIds } } });
  if (voucherEntriesLinked > 0) {
    const upd = await prisma.voucherEntry.updateMany({
      where: { accountId: { in: accountIds } },
      data: { accountId: null },
    });
    console.log(`✓ Unlinked VoucherEntries from test accounts: ${upd.count}`);
  }

  const invoicesLinked = await prisma.salesInvoice.count({ where: { accountId: { in: accountIds } } });
  if (invoicesLinked > 0) {
    const upd = await prisma.salesInvoice.updateMany({
      where: { accountId: { in: accountIds } },
      data: { accountId: null },
    });
    console.log(`✓ Unlinked SalesInvoices from test accounts: ${upd.count}`);
  }

  // Delete accounts (JournalLines cascade from Account via onDelete: Cascade)
  const del = await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
  console.log(`✓ Deleted test accounts: ${del.count}`);

  const remainingTest = await prisma.account.count({
    where: {
      OR: [{ name: { contains: 'test' } }, { name: { contains: 'Test' } }, { description: { contains: 'test' } }, { description: { contains: 'Test' } }],
    },
  });
  console.log(`Remaining test-like accounts: ${remainingTest}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Cleanup test accounts failed:', e?.message || e);
  console.error(e?.stack || e);
  await prisma.$disconnect();
  process.exit(1);
});

