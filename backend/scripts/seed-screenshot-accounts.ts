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

type SeedSubgroup = { code: string; name: string; mainGroupCode: string };
type SeedAccount = { code: string; name: string };

const seedSubgroups: SeedSubgroup[] = [
  { code: '101', name: '101-Inventory', mainGroupCode: '1' },
  { code: '102', name: '102-Cash', mainGroupCode: '1' },
  { code: '104', name: '104-Sales Customer Receivables', mainGroupCode: '1' },

  { code: '301', name: '301-Purchase Orders Payables', mainGroupCode: '3' },
  { code: '302', name: '302-Purchase expenses Payables', mainGroupCode: '3' },

  // Screenshot shows "-" for subgroup in Long Term Liabilities rows
  { code: '401', name: '-', mainGroupCode: '4' },

  { code: '501', name: '501-Owner Equity', mainGroupCode: '5' },
  { code: '701', name: '701-Goods Revenue', mainGroupCode: '7' },
  { code: '801', name: '801-Purchase Expenses', mainGroupCode: '8' },
  { code: '901', name: '901-Goods Purchased Cost', mainGroupCode: '9' },
];

const seedAccounts: { subgroupCode: string; account: SeedAccount }[] = [
  { subgroupCode: '101', account: { code: '101001', name: 'Inventory' } },
  { subgroupCode: '102', account: { code: '102014', name: 'Abdcash' } },
  { subgroupCode: '104', account: { code: '104323', name: 'Abdullahcoustomer' } },

  { subgroupCode: '301', account: { code: '301244', name: 'Abdullah' } },
  { subgroupCode: '301', account: { code: '301245', name: 'Abdpayabel' } },
  { subgroupCode: '302', account: { code: '302012', name: 'Testpayabels' } },

  { subgroupCode: '401', account: { code: '401001', name: 'GST' } },
  { subgroupCode: '401', account: { code: '401002', name: 'Purchase Tax Payable' } },

  { subgroupCode: '501', account: { code: '501003', name: 'OWNER CAPITAL' } },

  { subgroupCode: '701', account: { code: '701001', name: 'Goods Sold' } },
  { subgroupCode: '701', account: { code: '701002', name: 'Goods Sold (Discounts)' } },

  { subgroupCode: '801', account: { code: '801002', name: 'Purchase Tax Expense' } },
  { subgroupCode: '801', account: { code: '801014', name: 'Dispose Inventory' } },

  { subgroupCode: '901', account: { code: '901001', name: 'Cost Inventory' } },
  { subgroupCode: '901', account: { code: '901002', name: 'Cost Inventory (Discounts)' } },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const dbPath = dbFilePathFromDatabaseUrl(databaseUrl);

  console.log('==============================================');
  console.log('  Seed Accounts (from screenshot)');
  console.log('==============================================\n');
  console.log(`DATABASE_URL: ${databaseUrl || '(missing)'}`);
  if (dbPath) console.log(`DB file:       ${dbPath}`);

  // Backup (best-effort)
  if (dbPath && fs.existsSync(dbPath)) {
    const backupPath = `${dbPath}.backup.${nowStamp()}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`\n✓ Backup created: ${backupPath}\n`);
  }

  // Ensure main groups exist (by code)
  const mainGroups = await prisma.mainGroup.findMany({ select: { id: true, code: true, name: true } });
  const mainGroupByCode = new Map(mainGroups.map((g) => [String(g.code), g]));

  for (const sg of seedSubgroups) {
    const mg = mainGroupByCode.get(sg.mainGroupCode);
    if (!mg) {
      throw new Error(`Missing MainGroup code=${sg.mainGroupCode}. Please seed main groups first.`);
    }

    await prisma.subgroup.upsert({
      where: { code: sg.code },
      update: {
        name: sg.name,
        mainGroupId: mg.id,
        isActive: true,
      },
      create: {
        code: sg.code,
        name: sg.name,
        mainGroupId: mg.id,
        isActive: true,
        canDelete: true,
      },
    });
  }

  // Fetch subgroups again so we have IDs
  const subgroups = await prisma.subgroup.findMany({ select: { id: true, code: true, name: true } });
  const subgroupByCode = new Map(subgroups.map((s) => [String(s.code), s]));

  let upserted = 0;
  for (const row of seedAccounts) {
    const sg = subgroupByCode.get(row.subgroupCode);
    if (!sg) throw new Error(`Missing subgroup code=${row.subgroupCode}`);

    // Sanity: account code first 3 digits must match subgroup code
    if (!row.account.code.startsWith(row.subgroupCode) || row.account.code.length !== 6) {
      throw new Error(`Invalid account code ${row.account.code} for subgroup ${row.subgroupCode}`);
    }

    await prisma.account.upsert({
      where: { code: row.account.code },
      update: {
        subgroupId: sg.id,
        name: row.account.name,
        description: row.account.name,
        accountType: 'regular',
        status: 'Active',
        canDelete: true,
      },
      create: {
        subgroupId: sg.id,
        code: row.account.code,
        name: row.account.name,
        description: row.account.name,
        accountType: 'regular',
        openingBalance: 0,
        currentBalance: 0,
        status: 'Active',
        canDelete: true,
      },
    });
    upserted++;
  }

  console.log(`✓ Upserted accounts: ${upserted}`);
  const total = await prisma.account.count();
  console.log(`Total accounts in DB now: ${total}`);

  // Show the 15 seeded accounts in code order
  const seeded = await prisma.account.findMany({
    where: { code: { in: seedAccounts.map((x) => x.account.code) } },
    select: { code: true, name: true, subgroup: { select: { name: true }, } },
    orderBy: { code: 'asc' },
  });
  console.log('\nSeeded accounts:');
  for (const a of seeded) console.log(`  ${a.code}  ${a.name}  [${a.subgroup?.name || ''}]`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Seed failed:', e?.message || e);
  console.error(e?.stack || e);
  await prisma.$disconnect();
  process.exit(1);
});

