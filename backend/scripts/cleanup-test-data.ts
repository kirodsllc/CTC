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
  // Expected: file:/abs/path/to/db.sqlite
  if (!url.startsWith('file:')) return null;
  const p = url.replace(/^file:/, '');
  // prisma accepts file:/abs/path (single slash) and file:./relative
  // We'll normalize absolute paths here.
  return p.startsWith('/') ? p : path.resolve(process.cwd(), p);
}

function looksLikeTestText(v?: string | null): boolean {
  if (!v) return false;
  const s = String(v).trim();
  if (!s) return false;
  // Be slightly strict to avoid accidental matches like "attest"
  return /\btest\b/i.test(s) || /^test/i.test(s) || /test\s*item/i.test(s) || /test\s*supplier/i.test(s) || /test\s*store/i.test(s);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const dbPath = dbFilePathFromDatabaseUrl(databaseUrl);

  console.log('==============================================');
  console.log('  Cleanup Test Data (Stores/Suppliers/Items)');
  console.log('==============================================\n');

  console.log(`DATABASE_URL: ${databaseUrl || '(missing)'}`);
  if (dbPath) {
    console.log(`DB file:       ${dbPath}`);
  } else {
    console.log('DB file:       (could not parse from DATABASE_URL; backup skipped)');
  }

  // 0) Backup DB (best-effort)
  if (dbPath && fs.existsSync(dbPath)) {
    const backupPath = `${dbPath}.backup.${nowStamp()}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`\n✓ Backup created: ${backupPath}\n`);
  } else {
    console.log('\n⚠ No DB backup created (file not found or DATABASE_URL not file:...)\n');
  }

  // 1) Identify "test" entities
  const storesRaw = await prisma.store.findMany({ select: { id: true, code: true, name: true } });
  const testStores = storesRaw.filter((s) => looksLikeTestText(s.code) || looksLikeTestText(s.name));
  const testStoreIds = testStores.map((s) => s.id);

  const suppliersRaw = await prisma.supplier.findMany({
    select: { id: true, code: true, name: true, companyName: true },
  });
  const testSuppliers = suppliersRaw.filter(
    (s) => looksLikeTestText(s.code) || looksLikeTestText(s.name) || looksLikeTestText(s.companyName),
  );
  const testSupplierIds = testSuppliers.map((s) => s.id);

  const partsRaw = await prisma.part.findMany({ select: { id: true, partNo: true, description: true } });
  const testParts = partsRaw.filter((p) => looksLikeTestText(p.partNo) || looksLikeTestText(p.description));
  const testPartIds = testParts.map((p) => p.id);

  console.log('Detected test master data:');
  console.log(`  - Test Stores:    ${testStores.length}`);
  console.log(`  - Test Suppliers: ${testSuppliers.length}`);
  console.log(`  - Test Items:     ${testParts.length}\n`);

  // 2) Identify documents to delete (by test patterns OR by linkage to test stores/suppliers/items)
  // Stock movements can link invoices to stores, so use it to catch "store test" sales.
  const storeLinkedInvoiceIds =
    testStoreIds.length === 0
      ? []
      : (
          await prisma.stockMovement.findMany({
            where: {
              storeId: { in: testStoreIds },
              referenceType: { in: ['sales_invoice', 'SALES_INVOICE', 'Sales_Invoice'] },
              referenceId: { not: null },
            },
            select: { referenceId: true },
          })
        )
          .map((m) => m.referenceId)
          .filter(Boolean) as string[];

  const invoicesToDelete = await prisma.salesInvoice.findMany({
    where: {
      OR: [
        { id: { in: storeLinkedInvoiceIds } },
        { invoiceNo: { contains: 'test' } },
        { invoiceNo: { contains: 'Test' } },
        { customerName: { contains: 'test' } },
        { customerName: { contains: 'Test' } },
        { remarks: { contains: 'test' } },
        { remarks: { contains: 'Test' } },
        { deliveredTo: { contains: 'test' } },
        { deliveredTo: { contains: 'Test' } },
        testPartIds.length > 0 ? { items: { some: { partId: { in: testPartIds } } } } : undefined,
        { items: { some: { partNo: { contains: 'test' } } } },
        { items: { some: { partNo: { contains: 'Test' } } } },
      ].filter(Boolean) as any[],
    },
    select: { id: true, invoiceNo: true },
  });
  const invoiceIds = uniq(invoicesToDelete.map((i) => i.id));

  const returnsToDelete =
    invoiceIds.length === 0 && testPartIds.length === 0
      ? []
      : await prisma.salesReturn.findMany({
          where: {
            OR: [
              invoiceIds.length > 0 ? { salesInvoiceId: { in: invoiceIds } } : undefined,
              { returnNumber: { contains: 'test' } },
              { returnNumber: { contains: 'Test' } },
              { reason: { contains: 'test' } },
              { reason: { contains: 'Test' } },
              testPartIds.length > 0 ? { items: { some: { partId: { in: testPartIds } } } } : undefined,
            ].filter(Boolean) as any[],
          },
          select: { id: true, returnNumber: true },
        });
  const salesReturnIds = uniq(returnsToDelete.map((r) => r.id));

  const dposToDelete = await prisma.directPurchaseOrder.findMany({
    where: {
      OR: [
        { dpoNumber: { contains: 'test' } },
        { dpoNumber: { contains: 'Test' } },
        { description: { contains: 'test' } },
        { description: { contains: 'Test' } },
        testStoreIds.length > 0 ? { storeId: { in: testStoreIds } } : undefined,
        testSupplierIds.length > 0 ? { supplierId: { in: testSupplierIds } } : undefined,
        testPartIds.length > 0 ? { items: { some: { partId: { in: testPartIds } } } } : undefined,
      ].filter(Boolean) as any[],
    },
    select: { id: true, dpoNumber: true },
  });
  const dpoIds = uniq(dposToDelete.map((d) => d.id));

  const vouchersToDelete = await prisma.voucher.findMany({
    where: {
      OR: [
        { voucherNumber: { contains: 'test' } },
        { voucherNumber: { contains: 'Test' } },
        { narration: { contains: 'test' } },
        { narration: { contains: 'Test' } },
        {
          entries: {
            some: {
              OR: [
                { accountName: { contains: 'test' } },
                { accountName: { contains: 'Test' } },
                { description: { contains: 'test' } },
                { description: { contains: 'Test' } },
              ],
            },
          },
        },
      ],
    },
    select: { id: true, voucherNumber: true },
  });
  const voucherIds = uniq(vouchersToDelete.map((v) => v.id));

  // Transfers / Adjustments / Stock Verifications tied to test store(s)
  const transfersToDelete =
    testStoreIds.length === 0
      ? []
      : await prisma.transfer.findMany({
          where: {
            OR: [
              { transferNumber: { contains: 'test' } },
              { transferNumber: { contains: 'Test' } },
              { fromStoreId: { in: testStoreIds } },
              { toStoreId: { in: testStoreIds } },
            ],
          },
          select: { id: true, transferNumber: true },
        });
  const transferIds = uniq(transfersToDelete.map((t) => t.id));

  const adjustmentsToDelete =
    testStoreIds.length === 0
      ? []
      : await prisma.adjustment.findMany({
          where: {
            OR: [
              { subject: { contains: 'test' } },
              { subject: { contains: 'Test' } },
              { notes: { contains: 'test' } },
              { notes: { contains: 'Test' } },
              { storeId: { in: testStoreIds } },
            ],
          },
          select: { id: true },
        });
  const adjustmentIds = uniq(adjustmentsToDelete.map((a) => a.id));

  const verificationsToDelete =
    testStoreIds.length === 0 && testPartIds.length === 0
      ? []
      : await prisma.stockVerification.findMany({
          where: {
            OR: [
              { name: { contains: 'test' } },
              { name: { contains: 'Test' } },
              testStoreIds.length > 0 ? { items: { some: { storeId: { in: testStoreIds } } } } : undefined,
              testPartIds.length > 0 ? { items: { some: { partId: { in: testPartIds } } } } : undefined,
            ].filter(Boolean) as any[],
          },
          select: { id: true, name: true },
        });
  const verificationIds = uniq(verificationsToDelete.map((v) => v.id));

  console.log('Detected test transactions to delete:');
  console.log(`  - Vouchers:          ${voucherIds.length}`);
  console.log(`  - DPOs:              ${dpoIds.length}`);
  console.log(`  - Sales Invoices:    ${invoiceIds.length}`);
  console.log(`  - Sales Returns:     ${salesReturnIds.length}`);
  console.log(`  - Transfers:         ${transferIds.length}`);
  console.log(`  - Adjustments:       ${adjustmentIds.length}`);
  console.log(`  - Stock Verifications:${verificationIds.length}\n`);

  // 3) Delete documents (parents first; cascades handle children)
  if (salesReturnIds.length > 0) {
    const del = await prisma.salesReturn.deleteMany({ where: { id: { in: salesReturnIds } } });
    console.log(`✓ Deleted Sales Returns: ${del.count}`);
  }

  if (invoiceIds.length > 0) {
    const del = await prisma.salesInvoice.deleteMany({ where: { id: { in: invoiceIds } } });
    console.log(`✓ Deleted Sales Invoices: ${del.count}`);
  }

  if (dpoIds.length > 0) {
    const del = await prisma.directPurchaseOrder.deleteMany({ where: { id: { in: dpoIds } } });
    console.log(`✓ Deleted DPOs: ${del.count}`);
  }

  if (voucherIds.length > 0) {
    const del = await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } });
    console.log(`✓ Deleted Vouchers: ${del.count}`);
  }

  if (transferIds.length > 0) {
    const del = await prisma.transfer.deleteMany({ where: { id: { in: transferIds } } });
    console.log(`✓ Deleted Transfers: ${del.count}`);
  }

  if (adjustmentIds.length > 0) {
    const del = await prisma.adjustment.deleteMany({ where: { id: { in: adjustmentIds } } });
    console.log(`✓ Deleted Adjustments: ${del.count}`);
  }

  if (verificationIds.length > 0) {
    const del = await prisma.stockVerification.deleteMany({ where: { id: { in: verificationIds } } });
    console.log(`✓ Deleted Stock Verifications: ${del.count}`);
  }

  // 4) Clean stock movements for deleted docs / test stores / test items
  const deletedReferenceIds = uniq([...invoiceIds, ...salesReturnIds, ...dpoIds]);
  const smWhere =
    testStoreIds.length === 0 && testPartIds.length === 0 && deletedReferenceIds.length === 0
      ? null
      : ({
          OR: [
            testStoreIds.length > 0 ? { storeId: { in: testStoreIds } } : undefined,
            testPartIds.length > 0 ? { partId: { in: testPartIds } } : undefined,
            deletedReferenceIds.length > 0 ? { referenceId: { in: deletedReferenceIds } } : undefined,
            { notes: { contains: 'test' } },
            { notes: { contains: 'Test' } },
          ].filter(Boolean) as any[],
        } as any);

  if (smWhere) {
    const del = await prisma.stockMovement.deleteMany({ where: smWhere });
    console.log(`✓ Deleted Stock Movements (test-linked): ${del.count}`);
  }

  // 5) Delete racks/shelves in test stores (and related shelving structure)
  if (testStoreIds.length > 0) {
    const racks = await prisma.rack.findMany({ where: { storeId: { in: testStoreIds } }, select: { id: true } });
    const rackIds = racks.map((r) => r.id);
    if (rackIds.length > 0) {
      // Shelves cascade from Rack via onDelete: Cascade
      const del = await prisma.rack.deleteMany({ where: { id: { in: rackIds } } });
      console.log(`✓ Deleted Racks (and Shelves) in test stores: ${del.count}`);
    }
  }

  // 6) Delete test items only (plus blocking KitItems / PriceHistory)
  if (testPartIds.length > 0) {
    const delKitItems = await prisma.kitItem.deleteMany({ where: { partId: { in: testPartIds } } });
    if (delKitItems.count > 0) console.log(`✓ Deleted KitItems referencing test items: ${delKitItems.count}`);

    // PriceHistory.partId is nullable (no cascade), so delete by partId + by test partNo (best-effort)
    const testPartNos = testParts.map((p) => p.partNo).filter(Boolean) as string[];
    const delPriceHistory = await prisma.priceHistory.deleteMany({
      where: {
        OR: [
          { partId: { in: testPartIds } },
          testPartNos.length > 0 ? { partNo: { in: testPartNos } } : undefined,
          { partNo: { contains: 'test' } },
          { partNo: { contains: 'Test' } },
        ].filter(Boolean) as any[],
      },
    });
    if (delPriceHistory.count > 0) console.log(`✓ Deleted PriceHistory for test items: ${delPriceHistory.count}`);

    const delParts = await prisma.part.deleteMany({ where: { id: { in: testPartIds } } });
    console.log(`✓ Deleted Test Items: ${delParts.count}`);
  } else {
    console.log('✓ No test items found to delete.');
  }

  // 7) Delete test suppliers / stores (after transactions are removed)
  if (testSupplierIds.length > 0) {
    const del = await prisma.supplier.deleteMany({ where: { id: { in: testSupplierIds } } });
    console.log(`✓ Deleted Test Suppliers: ${del.count}`);
  }

  if (testStoreIds.length > 0) {
    const del = await prisma.store.deleteMany({ where: { id: { in: testStoreIds } } });
    console.log(`✓ Deleted Test Stores: ${del.count}`);
  }

  console.log('\n==============================================');
  console.log('  Cleanup Complete');
  console.log('==============================================');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Cleanup failed:', e?.message || e);
  console.error(e?.stack || e);
  await prisma.$disconnect();
  process.exit(1);
});

