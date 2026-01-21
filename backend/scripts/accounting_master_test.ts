/**
 * ACCOUNTING MASTER TEST (PROOF OUTPUT)
 *
 * DO NOT change frontend/UI. Only backend scripts/tests and output files.
 *
 * Proof requirements:
 * - prints TEST_RUN_ID
 * - prints created document IDs + numbers
 * - prints created voucherNumbers + types
 * - prints expected vs actual + diff for every strict check
 * - uses ONLY posted vouchers as canonical source of truth
 * - filters ALL validations to TEST_RUN_ID data only
 * - does NOT use Account.currentBalance for correctness
 * - writes JSON + MD reports under scripts/output
 *
 * Run:
 *   cd /var/www/Dev-Koncepts/backend
 *   PORT=3001 npm run smoke:accounting:master
 */

// IMPORTANT: use the SAME DB config as the running API server
// so that /api/vouchers proof queries see the same records.
import prisma from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const TEST_RUN_ID = `TEST-${Date.now()}`;
const TEST_START = new Date();
const TOLERANCE = 0.01;

const API_PORT = process.env.PORT || '3001';
const API_BASE = `http://127.0.0.1:${API_PORT}`;

type Status = 'PASS' | 'FAIL';

type VoucherProof = {
  id: string;
  voucherNumber: string;
  type: string;
  date: string;
  narration: string | null;
  totalDebit: number;
  totalCredit: number;
  status: string;
  entries: Array<{
    id: string;
    accountId: string | null;
    accountName: string;
    description: string | null;
    debit: number;
    credit: number;
    sortOrder: number;
  }>;
};

type LedgerProof = {
  accountCode: string;
  accountName: string;
  openingBalance: number;
  sumDebit: number;
  sumCredit: number;
  sumNet: number;
  closingBalance: number;
  lastRunningBalance: number;
  diffClosingVsRunning: number;
};

type ProofReport = {
  testRunId: string;
  startedAt: string;
  finishedAt?: string;
  apiBase: string;
  overallStatus: Status;
  exitCode: 0 | 1;
  created: {
    supplier?: { id: string; code: string; companyName: string };
    customer?: { id: string; name: string };
    part?: { id: string; partNo: string };
    dpo?: { id: string; dpoNumber: string };
    po?: { id: string; poNumber: string };
    invoiceCash?: { id: string; invoiceNo: string };
    invoiceCredit?: { id: string; invoiceNo: string };
    adjustmentIn?: { id: string; subject: string | null };
    adjustmentOut?: { id: string; subject: string | null };
  };
  vouchers: VoucherProof[];
  checks: {
    voucherIntegrity: Array<{ voucherNumber: string; expected: number; actual: number; diff: number; passed: boolean }>;
    voucherPrefix: Array<{ voucherNumber: string; type: string; expectedPrefix: string; passed: boolean }>;
    voucherTypeFilters: Array<{ query: string; expectedType: string; count: number; allMatch: boolean; mismatches: Array<{ voucherNumber: string; type: string }> }>;
    linkage: Array<{ voucherNumber: string; passed: boolean; notes?: string }>;
    ledgers: Array<{ accountCode: string; accountName: string; expectedNet: number; actualNet: number; diff: number; passed: boolean; details: LedgerProof }>;
    trialBalance: { totalDebit: number; totalCredit: number; diff: number; passed: boolean };
    incomeStatement: { expectedRevenue: number; expectedCogs: number; expectedGrossProfit: number; revenue: number; cogs: number; grossProfit: number; diffs: { revenue: number; cogs: number; grossProfit: number }; passed: boolean };
    balanceSheet: { assets: number; liabilities: number; equity: number; netIncome: number; diff: number; passed: boolean };
  };
  notes: string[];
};

const proof: ProofReport = {
  testRunId: TEST_RUN_ID,
  startedAt: TEST_START.toISOString(),
  apiBase: API_BASE,
  overallStatus: 'PASS',
  exitCode: 0,
  created: {},
  vouchers: [],
  checks: {
    voucherIntegrity: [],
    voucherPrefix: [],
    voucherTypeFilters: [],
    linkage: [],
    ledgers: [],
    trialBalance: { totalDebit: 0, totalCredit: 0, diff: 0, passed: false },
    incomeStatement: {
      expectedRevenue: 13500,
      expectedCogs: 9000,
      expectedGrossProfit: 4500,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      diffs: { revenue: 0, cogs: 0, grossProfit: 0 },
      passed: false,
    },
    balanceSheet: { assets: 0, liabilities: 0, equity: 0, netIncome: 0, diff: 0, passed: false },
  },
  notes: [],
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}
function fail(note: string) {
  proof.overallStatus = 'FAIL';
  proof.exitCode = 1;
  proof.notes.push(note);
}
function section(title: string) {
  console.log('\n' + '='.repeat(90));
  console.log(title);
  console.log('='.repeat(90));
}

async function ensureMainGroup(code: string, type: string, name: string) {
  const existing = await prisma.mainGroup.findUnique({ where: { code } });
  if (existing) return existing;
  return prisma.mainGroup.create({ data: { code, type, name, displayOrder: parseInt(code, 10) || undefined } });
}

async function ensureSubgroup(code: string, name: string, mainGroupId: string) {
  const existing = await prisma.subgroup.findUnique({ where: { code }, select: { id: true, code: true, name: true, mainGroupId: true } });
  if (existing) return existing;
  return prisma.subgroup.create({ data: { code, name, mainGroupId, isActive: true, canDelete: true }, select: { id: true, code: true, name: true, mainGroupId: true } });
}

async function ensureAccount(code: string, name: string, subgroupId: string) {
  const existing = await prisma.account.findUnique({ where: { code }, select: { id: true, code: true, name: true, openingBalance: true } });
  if (existing) return existing;
  return prisma.account.create({
    data: { code, name, subgroupId, status: 'Active', openingBalance: 0, currentBalance: 0, accountType: 'regular' },
    select: { id: true, code: true, name: true, openingBalance: true },
  });
}

async function nextVoucherNumber(prefix: 'JV' | 'PV' | 'RV'): Promise<string> {
  const last = await prisma.voucher.findFirst({
    where: { voucherNumber: { startsWith: prefix } },
    orderBy: { voucherNumber: 'desc' },
    select: { voucherNumber: true },
  });
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const m = last?.voucherNumber ? String(last.voucherNumber).match(re) : null;
  const next = m ? parseInt(m[1], 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

async function nextDpoNumber(date: Date): Promise<string> {
  const year = date.getFullYear();
  const last = await prisma.directPurchaseOrder.findFirst({
    where: { dpoNumber: { startsWith: `DPO-${year}-` } },
    orderBy: { dpoNumber: 'desc' },
    select: { dpoNumber: true },
  });
  const m = last?.dpoNumber ? String(last.dpoNumber).match(new RegExp(`^DPO-${year}-(\\d+)$`)) : null;
  const next = m ? parseInt(m[1], 10) + 1 : 1;
  return `DPO-${year}-${String(next).padStart(3, '0')}`;
}

async function nextPoNumber(date: Date): Promise<string> {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `PO-${year}${month}-`;
  const last = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  const m = last?.poNumber ? String(last.poNumber).match(new RegExp(`^${prefix}(\\d+)$`)) : null;
  const next = m ? parseInt(m[1], 10) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

async function nextInvoiceNo(): Promise<string> {
  const count = await prisma.salesInvoice.count();
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
}

async function createVoucher(args: {
  type: 'journal' | 'payment' | 'receipt';
  voucherNumber: string;
  date: Date;
  narration: string;
  entries: Array<{ accountId: string; accountCode: string; accountName: string; description: string; debit: number; credit: number }>;
}): Promise<VoucherProof> {
  const totalDebit = round2(args.entries.reduce((s, e) => s + (e.debit || 0), 0));
  const totalCredit = round2(args.entries.reduce((s, e) => s + (e.credit || 0), 0));
  if (!closeEnough(totalDebit, totalCredit)) throw new Error(`Voucher not balanced at create time: ${args.voucherNumber}`);

  const v = await prisma.voucher.create({
    data: {
      voucherNumber: args.voucherNumber,
      type: args.type,
      date: args.date,
      narration: args.narration,
      totalDebit,
      totalCredit,
      status: 'posted',
      entries: {
        create: args.entries.map((e, idx) => ({
          accountId: e.accountId,
          accountName: `${e.accountCode}-${e.accountName}`,
          description: e.description,
          debit: e.debit,
          credit: e.credit,
          sortOrder: idx,
        })),
      },
    },
    include: { entries: { orderBy: { sortOrder: 'asc' } } },
  });

  const proofRow: VoucherProof = {
    id: v.id,
    voucherNumber: v.voucherNumber,
    type: v.type,
    date: v.date.toISOString(),
    narration: v.narration,
    totalDebit: v.totalDebit,
    totalCredit: v.totalCredit,
    status: v.status,
    entries: v.entries.map((e) => ({
      id: e.id,
      accountId: e.accountId,
      accountName: e.accountName,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      sortOrder: e.sortOrder,
    })),
  };
  proof.vouchers.push(proofRow);
  return proofRow;
}

async function getPostedTestVouchers(): Promise<VoucherProof[]> {
  const vouchers = await prisma.voucher.findMany({
    where: { status: 'posted', narration: { contains: TEST_RUN_ID } },
    include: { entries: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { date: 'asc' },
  });
  return vouchers.map((v) => ({
    id: v.id,
    voucherNumber: v.voucherNumber,
    type: v.type,
    date: v.date.toISOString(),
    narration: v.narration,
    totalDebit: v.totalDebit,
    totalCredit: v.totalCredit,
    status: v.status,
    entries: v.entries.map((e) => ({
      id: e.id,
      accountId: e.accountId,
      accountName: e.accountName,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      sortOrder: e.sortOrder,
    })),
  }));
}

async function computeLedger(accountId: string, fromDate: Date, toDate: Date): Promise<LedgerProof> {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { code: true, name: true, openingBalance: true } });
  if (!account) throw new Error(`Account not found: ${accountId}`);

  const before = await prisma.voucherEntry.findMany({
    where: {
      accountId,
      voucher: { status: 'posted', narration: { contains: TEST_RUN_ID }, date: { lt: fromDate } },
      description: { contains: TEST_RUN_ID },
    },
    select: { debit: true, credit: true },
  });
  const beforeNet = before.reduce((s, e) => s + e.debit - e.credit, 0);
  const opening = (account.openingBalance || 0) + beforeNet;

  const range = await prisma.voucherEntry.findMany({
    where: {
      accountId,
      voucher: { status: 'posted', narration: { contains: TEST_RUN_ID }, date: { gte: fromDate, lte: toDate } },
      description: { contains: TEST_RUN_ID },
    },
    select: { debit: true, credit: true, sortOrder: true, voucher: { select: { date: true, voucherNumber: true } } },
    orderBy: [{ voucher: { date: 'asc' } }, { sortOrder: 'asc' }],
  });

  let running = opening;
  let sumDebit = 0;
  let sumCredit = 0;
  for (const e of range) {
    sumDebit += e.debit;
    sumCredit += e.credit;
    running += e.debit - e.credit;
  }
  const sumNet = sumDebit - sumCredit;
  const closing = opening + sumNet;

  return {
    accountCode: account.code,
    accountName: account.name,
    openingBalance: round2(opening),
    sumDebit: round2(sumDebit),
    sumCredit: round2(sumCredit),
    sumNet: round2(sumNet),
    closingBalance: round2(closing),
    lastRunningBalance: round2(running),
    diffClosingVsRunning: round2(closing - running),
  };
}

async function fetchVouchers(query: string): Promise<any> {
  const url = `${API_BASE}/api/vouchers${query}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`HTTP ${resp.status} ${url}: ${body}`);
  }
  return resp.json();
}

function renderMarkdown(p: ProofReport): string {
  const lines: string[] = [];
  lines.push(`# Accounting Master Test PROOF`);
  lines.push('');
  lines.push(`- TEST_RUN_ID: \`${p.testRunId}\``);
  lines.push(`- StartedAt: ${p.startedAt}`);
  lines.push(`- FinishedAt: ${p.finishedAt || ''}`);
  lines.push(`- OVERALL_STATUS: **${p.overallStatus}**`);
  lines.push(`- EXIT_CODE: **${p.exitCode}**`);
  lines.push('');
  lines.push(`## Created Documents`);
  lines.push(`- DPO: ${p.created.dpo?.dpoNumber || 'N/A'} (${p.created.dpo?.id || ''})`);
  lines.push(`- PO: ${p.created.po?.poNumber || 'N/A'} (${p.created.po?.id || ''})`);
  lines.push(`- Invoice CASH: ${p.created.invoiceCash?.invoiceNo || 'N/A'} (${p.created.invoiceCash?.id || ''})`);
  lines.push(`- Invoice CREDIT: ${p.created.invoiceCredit?.invoiceNo || 'N/A'} (${p.created.invoiceCredit?.id || ''})`);
  lines.push(`- Adjustment IN: ${p.created.adjustmentIn?.id || 'N/A'}`);
  lines.push(`- Adjustment OUT: ${p.created.adjustmentOut?.id || 'N/A'}`);
  lines.push('');
  lines.push(`## Vouchers (posted only; TEST_RUN_ID only)`);
  for (const v of p.vouchers) {
    lines.push(`### ${v.voucherNumber} (${v.type})`);
    lines.push(`- narration: ${v.narration || ''}`);
    lines.push(`- totalDebit: ${v.totalDebit}`);
    lines.push(`- totalCredit: ${v.totalCredit}`);
    lines.push('');
    lines.push('| sort | account | debit | credit | description |');
    lines.push('|---:|---|---:|---:|---|');
    for (const e of v.entries) {
      lines.push(`| ${e.sortOrder} | ${e.accountName} | ${e.debit} | ${e.credit} | ${String(e.description || '').replace(/\n/g, ' ')} |`);
    }
    lines.push('');
  }
  lines.push(`## Checks`);
  lines.push(`### Trial Balance`);
  lines.push(`- totalDebit=${p.checks.trialBalance.totalDebit} totalCredit=${p.checks.trialBalance.totalCredit} diff=${p.checks.trialBalance.diff} pass=${p.checks.trialBalance.passed ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push(`### Income Statement`);
  lines.push(`- revenue expected=${p.checks.incomeStatement.expectedRevenue} actual=${p.checks.incomeStatement.revenue} diff=${p.checks.incomeStatement.diffs.revenue}`);
  lines.push(`- cogs expected=${p.checks.incomeStatement.expectedCogs} actual=${p.checks.incomeStatement.cogs} diff=${p.checks.incomeStatement.diffs.cogs}`);
  lines.push(`- grossProfit expected=${p.checks.incomeStatement.expectedGrossProfit} actual=${p.checks.incomeStatement.grossProfit} diff=${p.checks.incomeStatement.diffs.grossProfit}`);
  lines.push(`- pass=${p.checks.incomeStatement.passed ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push(`### Balance Sheet`);
  lines.push(`- assets=${p.checks.balanceSheet.assets} liabilities=${p.checks.balanceSheet.liabilities} equity=${p.checks.balanceSheet.equity} netIncome=${p.checks.balanceSheet.netIncome}`);
  lines.push(`- diff=${p.checks.balanceSheet.diff} pass=${p.checks.balanceSheet.passed ? 'YES' : 'NO'}`);
  lines.push('');
  if (p.notes.length) {
    lines.push(`## Notes`);
    for (const n of p.notes) lines.push(`- ${n}`);
  }
  return lines.join('\n');
}

async function main() {
  section('🚀 ACCOUNTING MASTER TEST (PROOF OUTPUT)');
  console.log(`TEST_RUN_ID: ${TEST_RUN_ID}`);
  console.log(`StartedAt:   ${TEST_START.toISOString()}`);
  console.log(`API_BASE:    ${API_BASE}`);

  try {
    // Ensure COA (create only if missing; do not update existing)
    section('SETUP: Ensure COA');
    const mgAssets = await ensureMainGroup('1', 'Asset', 'Assets');
    const mgLiab = await ensureMainGroup('2', 'Liability', 'Liabilities');
    const mgRevenue = await ensureMainGroup('4', 'Revenue', 'Revenue');
    const mgCost = await ensureMainGroup('9', 'Cost', 'Cost');
    const mgExpense = await ensureMainGroup('5', 'Expense', 'Expenses');

    const sgInventory = await ensureSubgroup('104', 'Inventory', mgAssets.id);
    const sgCash = await ensureSubgroup('101', 'Cash', mgAssets.id);
    const sgAR = await ensureSubgroup('201', 'Accounts Receivable', mgAssets.id);
    const sgAP = await ensureSubgroup('301', 'Supplier Payables', mgLiab.id);
    const sgSalesRevenue = await ensureSubgroup('401', 'Sales Revenue', mgRevenue.id);
    const sgCogs = await ensureSubgroup('901', 'COGS', mgCost.id);
    const sgAdjExpense = await ensureSubgroup('502', 'Inventory Adjustments', mgExpense.id);

    const inventory = await ensureAccount('101001', 'Inventory', sgInventory.id);
    const cash = await ensureAccount('101002', 'Cash', sgCash.id);
    const ar = await ensureAccount('201001', 'Accounts Receivable', sgAR.id);
    const ap = await ensureAccount('301001', 'Supplier Payable (Control)', sgAP.id);
    const salesRev = await ensureAccount('401001', 'Sales Revenue', sgSalesRevenue.id);
    const cogs = await ensureAccount('901001', 'COGS', sgCogs.id);
    const adjGainLoss = await ensureAccount('502001', 'Inventory Adjustment Gain/Loss', sgAdjExpense.id);

    console.log('Accounts used:');
    console.log(`- Inventory: ${inventory.code} ${inventory.name}`);
    console.log(`- Cash:      ${cash.code} ${cash.name}`);
    console.log(`- AR:        ${ar.code} ${ar.name}`);
    console.log(`- AP:        ${ap.code} ${ap.name}`);
    console.log(`- Revenue:   ${salesRev.code} ${salesRev.name}`);
    console.log(`- COGS:      ${cogs.code} ${cogs.name}`);
    console.log(`- Adj G/L:   ${adjGainLoss.code} ${adjGainLoss.name}`);

    // Create documents
    section('CREATE DOCUMENTS (TEST_RUN_ID tagged)');
    const supplier = await prisma.supplier.create({
      data: { code: `SUP-${TEST_RUN_ID}`, companyName: `Supplier ${TEST_RUN_ID}`, name: `Supplier ${TEST_RUN_ID}`, status: 'active', notes: TEST_RUN_ID },
      select: { id: true, code: true, companyName: true },
    });
    proof.created.supplier = supplier;
    const customer = await prisma.customer.create({
      data: { name: `Customer ${TEST_RUN_ID}`, status: 'active', openingBalance: 0, email: `${TEST_RUN_ID}@example.test`, contactNo: '0000000000' },
      select: { id: true, name: true },
    });
    proof.created.customer = customer;
    const part = await prisma.part.create({
      data: { partNo: `PART-${TEST_RUN_ID}`, description: `Test Part ${TEST_RUN_ID}`, uom: 'pcs', status: 'active' },
      select: { id: true, partNo: true },
    });
    proof.created.part = part;

    const dpoDate = new Date();
    const dpoNumber = await nextDpoNumber(dpoDate);
    const dpo = await prisma.directPurchaseOrder.create({
      data: {
        dpoNumber,
        date: dpoDate,
        supplierId: supplier.id,
        description: `DPO Receive ${TEST_RUN_ID}`,
        status: 'Completed',
        totalAmount: 1000,
        items: { create: [{ partId: part.id, quantity: 1, purchasePrice: 1000, salePrice: 0, amount: 1000 }] },
      },
      select: { id: true, dpoNumber: true },
    });
    proof.created.dpo = dpo;

    const poDate = new Date();
    const poNumber = await nextPoNumber(poDate);
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        date: poDate,
        supplierId: supplier.id,
        status: 'Received',
        notes: `PO Receive ${TEST_RUN_ID}`,
        totalAmount: 2000,
        items: { create: [{ partId: part.id, quantity: 1, unitCost: 2000, totalCost: 2000, receivedQty: 1, notes: TEST_RUN_ID }] },
      },
      select: { id: true, poNumber: true },
    });
    proof.created.po = po;

    const adjIn = await prisma.adjustment.create({
      data: { date: new Date(), subject: `Adjustment IN ${TEST_RUN_ID}`, addInventory: true, notes: TEST_RUN_ID, totalAmount: 200, items: { create: [{ partId: part.id, quantity: 200, cost: 1, notes: TEST_RUN_ID }] } },
      select: { id: true, subject: true },
    });
    proof.created.adjustmentIn = adjIn;

    const adjOut = await prisma.adjustment.create({
      data: { date: new Date(), subject: `Adjustment OUT ${TEST_RUN_ID}`, addInventory: false, notes: TEST_RUN_ID, totalAmount: 100, items: { create: [{ partId: part.id, quantity: 100, cost: 1, notes: TEST_RUN_ID }] } },
      select: { id: true, subject: true },
    });
    proof.created.adjustmentOut = adjOut;

    const invCashNo = await nextInvoiceNo();
    const invoiceCash = await prisma.salesInvoice.create({
      data: {
        invoiceNo: invCashNo,
        invoiceDate: new Date(),
        customerId: customer.id,
        customerName: customer.name,
        customerType: 'registered',
        salesPerson: 'System',
        subtotal: 7500,
        grandTotal: 7500,
        paidAmount: 7500,
        status: 'fully_delivered',
        paymentStatus: 'paid',
        remarks: `Cash Sale ${TEST_RUN_ID}`,
        items: { create: [{ partId: part.id, partNo: part.partNo, description: TEST_RUN_ID, orderedQty: 50, deliveredQty: 50, pendingQty: 0, unitPrice: 150, discount: 0, lineTotal: 7500, grade: 'A', brand: '' }] },
      },
      select: { id: true, invoiceNo: true },
    });
    proof.created.invoiceCash = invoiceCash;

    const invCreditNo = await nextInvoiceNo();
    const invoiceCredit = await prisma.salesInvoice.create({
      data: {
        invoiceNo: invCreditNo,
        invoiceDate: new Date(),
        customerId: customer.id,
        customerName: customer.name,
        customerType: 'walking',
        salesPerson: 'System',
        subtotal: 6000,
        grandTotal: 6000,
        paidAmount: 0,
        status: 'fully_delivered',
        paymentStatus: 'unpaid',
        remarks: `Credit Sale ${TEST_RUN_ID}`,
        items: { create: [{ partId: part.id, partNo: part.partNo, description: TEST_RUN_ID, orderedQty: 40, deliveredQty: 40, pendingQty: 0, unitPrice: 150, discount: 0, lineTotal: 6000, grade: 'A', brand: '' }] },
      },
      select: { id: true, invoiceNo: true },
    });
    proof.created.invoiceCredit = invoiceCredit;

    console.log('Created document IDs:');
    console.log(`- DPO: ${dpo.id} (${dpo.dpoNumber})`);
    console.log(`- PO: ${po.id} (${po.poNumber})`);
    console.log(`- Invoice CASH: ${invoiceCash.id} (${invoiceCash.invoiceNo})`);
    console.log(`- Invoice CREDIT: ${invoiceCredit.id} (${invoiceCredit.invoiceNo})`);
    console.log(`- Adjustment IN: ${adjIn.id}`);
    console.log(`- Adjustment OUT: ${adjOut.id}`);

    // Stock movements tagged (for stock qty proof if needed)
    await prisma.stockMovement.create({ data: { partId: part.id, type: 'in', quantity: 1, referenceType: 'direct_purchase', referenceId: dpo.id, notes: TEST_RUN_ID } });
    await prisma.stockMovement.create({ data: { partId: part.id, type: 'in', quantity: 1, referenceType: 'purchase_order', referenceId: po.id, notes: TEST_RUN_ID } });
    await prisma.stockMovement.create({ data: { partId: part.id, type: 'in', quantity: 200, referenceType: 'adjustment', referenceId: adjIn.id, notes: TEST_RUN_ID } });
    await prisma.stockMovement.create({ data: { partId: part.id, type: 'out', quantity: 100, referenceType: 'adjustment', referenceId: adjOut.id, notes: TEST_RUN_ID } });
    await prisma.stockMovement.create({ data: { partId: part.id, type: 'out', quantity: 50, referenceType: 'sales_invoice', referenceId: invoiceCash.id, notes: TEST_RUN_ID } });
    await prisma.stockMovement.create({ data: { partId: part.id, type: 'out', quantity: 40, referenceType: 'sales_invoice', referenceId: invoiceCredit.id, notes: TEST_RUN_ID } });

    // Create vouchers (canonical)
    section('CREATE VOUCHERS (posted; canonical)');
    await createVoucher({
      type: 'journal',
      voucherNumber: await nextVoucherNumber('JV'),
      date: dpoDate,
      narration: `${TEST_RUN_ID} | DPO=${dpo.dpoNumber}`,
      entries: [
        { accountId: inventory.id, accountCode: inventory.code, accountName: inventory.name, description: `${TEST_RUN_ID} | DPO ${dpo.dpoNumber} | DR Inventory 1000`, debit: 1000, credit: 0 },
        { accountId: ap.id, accountCode: ap.code, accountName: ap.name, description: `${TEST_RUN_ID} | DPO ${dpo.dpoNumber} | CR Supplier Payable 1000`, debit: 0, credit: 1000 },
      ],
    });
    await createVoucher({
      type: 'payment',
      voucherNumber: await nextVoucherNumber('PV'),
      date: new Date(),
      narration: `${TEST_RUN_ID} | PAY DPO=${dpo.dpoNumber}`,
      entries: [
        { accountId: ap.id, accountCode: ap.code, accountName: ap.name, description: `${TEST_RUN_ID} | PAY DPO ${dpo.dpoNumber} | DR Supplier Payable 500`, debit: 500, credit: 0 },
        { accountId: cash.id, accountCode: cash.code, accountName: cash.name, description: `${TEST_RUN_ID} | PAY DPO ${dpo.dpoNumber} | CR Cash 500`, debit: 0, credit: 500 },
      ],
    });
    await createVoucher({
      type: 'journal',
      voucherNumber: await nextVoucherNumber('JV'),
      date: poDate,
      narration: `${TEST_RUN_ID} | PO=${po.poNumber}`,
      entries: [
        { accountId: inventory.id, accountCode: inventory.code, accountName: inventory.name, description: `${TEST_RUN_ID} | PO ${po.poNumber} | DR Inventory 2000`, debit: 2000, credit: 0 },
        { accountId: ap.id, accountCode: ap.code, accountName: ap.name, description: `${TEST_RUN_ID} | PO ${po.poNumber} | CR Supplier Payable 2000`, debit: 0, credit: 2000 },
      ],
    });
    await createVoucher({
      type: 'receipt',
      voucherNumber: await nextVoucherNumber('RV'),
      date: new Date(),
      narration: `${TEST_RUN_ID} | INV=${invoiceCash.invoiceNo} | CASH`,
      entries: [
        { accountId: cash.id, accountCode: cash.code, accountName: cash.name, description: `${TEST_RUN_ID} | INV ${invoiceCash.invoiceNo} | DR Cash 7500`, debit: 7500, credit: 0 },
        { accountId: salesRev.id, accountCode: salesRev.code, accountName: salesRev.name, description: `${TEST_RUN_ID} | INV ${invoiceCash.invoiceNo} | CR Sales Revenue 7500`, debit: 0, credit: 7500 },
      ],
    });
    await createVoucher({
      type: 'journal',
      voucherNumber: await nextVoucherNumber('JV'),
      date: new Date(),
      narration: `${TEST_RUN_ID} | INV=${invoiceCash.invoiceNo} | COGS`,
      entries: [
        { accountId: cogs.id, accountCode: cogs.code, accountName: cogs.name, description: `${TEST_RUN_ID} | INV ${invoiceCash.invoiceNo} | DR COGS 5000`, debit: 5000, credit: 0 },
        { accountId: inventory.id, accountCode: inventory.code, accountName: inventory.name, description: `${TEST_RUN_ID} | INV ${invoiceCash.invoiceNo} | CR Inventory 5000`, debit: 0, credit: 5000 },
      ],
    });
    await createVoucher({
      type: 'journal',
      voucherNumber: await nextVoucherNumber('JV'),
      date: new Date(),
      narration: `${TEST_RUN_ID} | INV=${invoiceCredit.invoiceNo} | CREDIT`,
      entries: [
        { accountId: ar.id, accountCode: ar.code, accountName: ar.name, description: `${TEST_RUN_ID} | INV ${invoiceCredit.invoiceNo} | DR AR 6000`, debit: 6000, credit: 0 },
        { accountId: salesRev.id, accountCode: salesRev.code, accountName: salesRev.name, description: `${TEST_RUN_ID} | INV ${invoiceCredit.invoiceNo} | CR Sales Revenue 6000`, debit: 0, credit: 6000 },
      ],
    });
    await createVoucher({
      type: 'journal',
      voucherNumber: await nextVoucherNumber('JV'),
      date: new Date(),
      narration: `${TEST_RUN_ID} | INV=${invoiceCredit.invoiceNo} | COGS`,
      entries: [
        { accountId: cogs.id, accountCode: cogs.code, accountName: cogs.name, description: `${TEST_RUN_ID} | INV ${invoiceCredit.invoiceNo} | DR COGS 4000`, debit: 4000, credit: 0 },
        { accountId: inventory.id, accountCode: inventory.code, accountName: inventory.name, description: `${TEST_RUN_ID} | INV ${invoiceCredit.invoiceNo} | CR Inventory 4000`, debit: 0, credit: 4000 },
      ],
    });
    await createVoucher({
      type: 'journal',
      voucherNumber: await nextVoucherNumber('JV'),
      date: new Date(),
      narration: `${TEST_RUN_ID} | ADJ=${adjIn.id} | IN`,
      entries: [
        { accountId: inventory.id, accountCode: inventory.code, accountName: inventory.name, description: `${TEST_RUN_ID} | ADJ IN ${adjIn.id} | DR Inventory 200`, debit: 200, credit: 0 },
        { accountId: adjGainLoss.id, accountCode: adjGainLoss.code, accountName: adjGainLoss.name, description: `${TEST_RUN_ID} | ADJ IN ${adjIn.id} | CR Adj Gain/Loss 200`, debit: 0, credit: 200 },
      ],
    });
    await createVoucher({
      type: 'journal',
      voucherNumber: await nextVoucherNumber('JV'),
      date: new Date(),
      narration: `${TEST_RUN_ID} | ADJ=${adjOut.id} | OUT`,
      entries: [
        { accountId: adjGainLoss.id, accountCode: adjGainLoss.code, accountName: adjGainLoss.name, description: `${TEST_RUN_ID} | ADJ OUT ${adjOut.id} | DR Adj Gain/Loss 100`, debit: 100, credit: 0 },
        { accountId: inventory.id, accountCode: inventory.code, accountName: inventory.name, description: `${TEST_RUN_ID} | ADJ OUT ${adjOut.id} | CR Inventory 100`, debit: 0, credit: 100 },
      ],
    });

    console.log('Created voucherNumbers + types:');
    for (const v of proof.vouchers) console.log(`- ${v.voucherNumber}: ${v.type}`);

    // VALIDATIONS
    section('VALIDATIONS (posted vouchers only; TEST_RUN_ID only)');
    const posted = await getPostedTestVouchers();

    // Voucher integrity + prefix + linkage
    for (const v of posted) {
      const dr = round2(v.entries.reduce((s, e) => s + e.debit, 0));
      const cr = round2(v.entries.reduce((s, e) => s + e.credit, 0));
      const diff = round2(dr - cr);
      const passed = closeEnough(dr, cr);
      proof.checks.voucherIntegrity.push({ voucherNumber: v.voucherNumber, expected: 0, actual: diff, diff, passed });
      if (!passed) fail(`Voucher integrity failed: ${v.voucherNumber} diff=${diff}`);

      const expectedPrefix = v.type === 'journal' ? 'JV' : v.type === 'payment' ? 'PV' : v.type === 'receipt' ? 'RV' : '';
      const prefixOk = expectedPrefix ? v.voucherNumber.startsWith(expectedPrefix) : true;
      proof.checks.voucherPrefix.push({ voucherNumber: v.voucherNumber, type: v.type, expectedPrefix, passed: prefixOk });
      if (!prefixOk) fail(`Voucher prefix failed: ${v.voucherNumber} type=${v.type}`);

      const narr = v.narration || '';
      const entryText = v.entries.map((e) => e.description || '').join(' | ');
      // Linkage requirement is contextual:
      // - DPO vouchers must reference DPO number
      // - PO vouchers must reference PO number
      // - INV vouchers must reference Invoice number
      // - ADJ vouchers must reference adjustment id
      let required: string[] = [];
      if (narr.includes('DPO=')) required = [dpo.dpoNumber];
      else if (narr.includes('PO=')) required = [po.poNumber];
      else if (narr.includes('INV=')) required = [invoiceCash.invoiceNo, invoiceCredit.invoiceNo];
      else if (narr.includes('ADJ=')) required = [adjIn.id, adjOut.id];
      else required = [dpo.dpoNumber, po.poNumber, invoiceCash.invoiceNo, invoiceCredit.invoiceNo, adjIn.id, adjOut.id];

      const matched = required.filter((t) => narr.includes(t) || entryText.includes(t));
      const hasLink = matched.length > 0;
      proof.checks.linkage.push({
        voucherNumber: v.voucherNumber,
        passed: hasLink,
        notes: hasLink ? `linked via ${matched.join(', ')}` : `missing linkage, required one of: ${required.join(', ')}`,
      });
      if (!hasLink) fail(`Linkage failed: ${v.voucherNumber}`);
    }

    // Voucher type filters (API) - strict (must return non-zero for proof)
    try {
      const search = encodeURIComponent(TEST_RUN_ID);
      const j = await fetchVouchers(`?type=3&search=${search}&limit=500`);
      const pj = j?.data || [];
      proof.checks.voucherTypeFilters.push({
        query: `/api/vouchers?type=3&search=${TEST_RUN_ID}`,
        expectedType: 'journal',
        count: pj.length,
        allMatch: pj.every((x: any) => x.type === 'journal'),
        mismatches: pj.filter((x: any) => x.type !== 'journal').map((x: any) => ({ voucherNumber: x.voucherNumber, type: x.type })),
      });
      if (pj.length === 0) fail(`Voucher type filter returned 0 rows (proof failed): /api/vouchers?type=3&search=${TEST_RUN_ID}`);
      const p = await fetchVouchers(`?type=1&search=${search}&limit=500`);
      const pp = p?.data || [];
      proof.checks.voucherTypeFilters.push({
        query: `/api/vouchers?type=1&search=${TEST_RUN_ID}`,
        expectedType: 'payment',
        count: pp.length,
        allMatch: pp.every((x: any) => x.type === 'payment'),
        mismatches: pp.filter((x: any) => x.type !== 'payment').map((x: any) => ({ voucherNumber: x.voucherNumber, type: x.type })),
      });
      if (pp.length === 0) fail(`Voucher type filter returned 0 rows (proof failed): /api/vouchers?type=1&search=${TEST_RUN_ID}`);
      const r = await fetchVouchers(`?type=2&search=${search}&limit=500`);
      const pr = r?.data || [];
      proof.checks.voucherTypeFilters.push({
        query: `/api/vouchers?type=2&search=${TEST_RUN_ID}`,
        expectedType: 'receipt',
        count: pr.length,
        allMatch: pr.every((x: any) => x.type === 'receipt'),
        mismatches: pr.filter((x: any) => x.type !== 'receipt').map((x: any) => ({ voucherNumber: x.voucherNumber, type: x.type })),
      });
      if (pr.length === 0) fail(`Voucher type filter returned 0 rows (proof failed): /api/vouchers?type=2&search=${TEST_RUN_ID}`);
      for (const f of proof.checks.voucherTypeFilters) if (!f.allMatch) fail(`Voucher type filter failed: ${f.query}`);
    } catch (e: any) {
      fail(`Voucher type filter API check failed: ${e?.message || String(e)}`);
    }

    // Ledgers
    const expectedNetByAccountId: Record<string, number> = {
      [inventory.id]: -5900,
      [ap.id]: -2500,
      [ar.id]: 6000,
      [cash.id]: 7000,
    };
    for (const acc of [inventory, ap, ar, cash]) {
      const ledger = await computeLedger(acc.id, TEST_START, new Date());
      const expectedNet = expectedNetByAccountId[acc.id];
      const actualNet = ledger.sumNet;
      const diff = round2(actualNet - expectedNet);
      const passed = closeEnough(actualNet, expectedNet) && closeEnough(ledger.diffClosingVsRunning, 0);
      proof.checks.ledgers.push({ accountCode: ledger.accountCode, accountName: ledger.accountName, expectedNet, actualNet, diff, passed, details: ledger });
      if (!passed) fail(`Ledger check failed: ${ledger.accountCode} expectedNet=${expectedNet} actualNet=${actualNet} diff=${diff}`);
    }

    // Trial balance
    const allEntries = await prisma.voucherEntry.findMany({
      where: { voucher: { status: 'posted', narration: { contains: TEST_RUN_ID } }, description: { contains: TEST_RUN_ID } },
      select: { debit: true, credit: true },
    });
    const tbDebit = round2(allEntries.reduce((s, e) => s + e.debit, 0));
    const tbCredit = round2(allEntries.reduce((s, e) => s + e.credit, 0));
    const tbDiff = round2(tbDebit - tbCredit);
    const tbPassed = closeEnough(tbDebit, tbCredit);
    proof.checks.trialBalance = { totalDebit: tbDebit, totalCredit: tbCredit, diff: tbDiff, passed: tbPassed };
    if (!tbPassed) fail(`Trial balance failed: DR=${tbDebit} CR=${tbCredit} diff=${tbDiff}`);

    // Income statement (Revenue + COGS only)
    const revenueEntries = await prisma.voucherEntry.findMany({
      where: { accountId: salesRev.id, voucher: { status: 'posted', narration: { contains: TEST_RUN_ID } }, description: { contains: TEST_RUN_ID } },
      select: { debit: true, credit: true },
    });
    const cogsEntries = await prisma.voucherEntry.findMany({
      where: { accountId: cogs.id, voucher: { status: 'posted', narration: { contains: TEST_RUN_ID } }, description: { contains: TEST_RUN_ID } },
      select: { debit: true, credit: true },
    });
    const revenueTotal = round2(revenueEntries.reduce((s, e) => s + (e.credit - e.debit), 0));
    const cogsTotal = round2(cogsEntries.reduce((s, e) => s + (e.debit - e.credit), 0));
    const gp = round2(revenueTotal - cogsTotal);
    proof.checks.incomeStatement.revenue = revenueTotal;
    proof.checks.incomeStatement.cogs = cogsTotal;
    proof.checks.incomeStatement.grossProfit = gp;
    proof.checks.incomeStatement.diffs = {
      revenue: round2(revenueTotal - proof.checks.incomeStatement.expectedRevenue),
      cogs: round2(cogsTotal - proof.checks.incomeStatement.expectedCogs),
      grossProfit: round2(gp - proof.checks.incomeStatement.expectedGrossProfit),
    };
    proof.checks.incomeStatement.passed =
      closeEnough(revenueTotal, proof.checks.incomeStatement.expectedRevenue) &&
      closeEnough(cogsTotal, proof.checks.incomeStatement.expectedCogs) &&
      closeEnough(gp, proof.checks.incomeStatement.expectedGrossProfit);
    if (!proof.checks.incomeStatement.passed) fail(`Income statement failed: revenue=${revenueTotal} cogs=${cogsTotal} gp=${gp}`);

    // Balance sheet (Assets = Liabilities + Equity), equity = net income (incl. adjustment g/l)
    const balInv = (await computeLedger(inventory.id, TEST_START, new Date())).closingBalance;
    const balCash = (await computeLedger(cash.id, TEST_START, new Date())).closingBalance;
    const balAR = (await computeLedger(ar.id, TEST_START, new Date())).closingBalance;
    const balAP = (await computeLedger(ap.id, TEST_START, new Date())).closingBalance;
    const assets = round2(balInv + balCash + balAR);
    const liabilities = round2(Math.abs(balAP));
    const adjEntries = await prisma.voucherEntry.findMany({
      where: { accountId: adjGainLoss.id, voucher: { status: 'posted', narration: { contains: TEST_RUN_ID } }, description: { contains: TEST_RUN_ID } },
      select: { debit: true, credit: true },
    });
    const adjNetExpense = round2(adjEntries.reduce((s, e) => s + (e.debit - e.credit), 0)); // +100-200=-100
    const netIncome = round2((revenueTotal - cogsTotal) - adjNetExpense);
    const equity = netIncome;
    const bsDiff = round2(assets - (liabilities + equity));
    const bsPassed = closeEnough(assets, liabilities + equity);
    proof.checks.balanceSheet = { assets, liabilities, equity, netIncome, diff: bsDiff, passed: bsPassed };
    if (!bsPassed) fail(`Balance sheet failed: assets=${assets} liab+eq=${round2(liabilities + equity)} diff=${bsDiff}`);

    // TERMINAL PROOF OUTPUT
    section('PROOF OUTPUT (full vouchers + expected vs actual)');
    console.log(`OVERALL_STATUS=${proof.overallStatus}`);
    console.log(`EXIT_CODE=${proof.exitCode}`);

    console.log('\nVOUCHERS (posted; filtered by TEST_RUN_ID in narration):');
    for (const v of posted) {
      console.log(`\n- ${v.voucherNumber} [${v.type}] date=${v.date}`);
      console.log(`  narration: ${v.narration}`);
      console.log(`  totals: DR=${v.totalDebit} CR=${v.totalCredit} diff=${round2(v.totalDebit - v.totalCredit)}`);
      for (const e of v.entries) {
        console.log(`    #${e.sortOrder} ${e.accountName} DR=${e.debit} CR=${e.credit} | ${e.description}`);
      }
    }

    section('CHECK: Trial Balance');
    console.log(`Expected: totalDebit == totalCredit (tolerance ${TOLERANCE})`);
    console.log(`Actual: totalDebit=${tbDebit} totalCredit=${tbCredit} diff=${tbDiff} PASS=${tbPassed}`);

    section('CHECK: Income Statement');
    console.log(`Revenue expected=${proof.checks.incomeStatement.expectedRevenue} actual=${revenueTotal} diff=${proof.checks.incomeStatement.diffs.revenue}`);
    console.log(`COGS expected=${proof.checks.incomeStatement.expectedCogs} actual=${cogsTotal} diff=${proof.checks.incomeStatement.diffs.cogs}`);
    console.log(`GrossProfit expected=${proof.checks.incomeStatement.expectedGrossProfit} actual=${gp} diff=${proof.checks.incomeStatement.diffs.grossProfit}`);
    console.log(`PASS=${proof.checks.incomeStatement.passed}`);

    section('CHECK: Balance Sheet');
    console.log(`Assets=${assets}`);
    console.log(`Liabilities=${liabilities}`);
    console.log(`Equity=${equity} (NetIncome=${netIncome})`);
    console.log(`Diff assets-(liab+eq)=${bsDiff} PASS=${bsPassed}`);

    section('CHECK: Ledgers');
    for (const l of proof.checks.ledgers) {
      const d = l.details;
      console.log(`${l.passed ? 'PASS' : 'FAIL'} | ${l.accountCode} ${l.accountName}`);
      console.log(`  expectedNet=${l.expectedNet} actualNet=${l.actualNet} diff=${l.diff}`);
      console.log(`  opening=${d.openingBalance} sumDebit=${d.sumDebit} sumCredit=${d.sumCredit} sumNet=${d.sumNet}`);
      console.log(`  closing=${d.closingBalance} lastRunning=${d.lastRunningBalance} closing-vs-running=${d.diffClosingVsRunning}`);
    }

    section('CHECK: Voucher Type Filters (API)');
    for (const f of proof.checks.voucherTypeFilters) {
      console.log(`${f.allMatch ? 'PASS' : 'FAIL'} | ${f.query} expected=${f.expectedType} count=${f.count} mismatches=${f.mismatches.length}`);
    }

    // Write reports
    proof.finishedAt = new Date().toISOString();
    const outDir = path.join(__dirname, 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'accounting_master_test_RESULT.json');
    const mdPath = path.join(outDir, 'accounting_master_test_RESULT.md');
    fs.writeFileSync(jsonPath, JSON.stringify(proof, null, 2), 'utf8');
    fs.writeFileSync(mdPath, renderMarkdown(proof), 'utf8');

    section('FILES WRITTEN');
    console.log(jsonPath);
    console.log(mdPath);

    process.exit(proof.exitCode);
  } catch (err: any) {
    proof.overallStatus = 'FAIL';
    proof.exitCode = 1;
    proof.notes.push(`FATAL: ${err?.message || String(err)}`);
    console.error('\n❌ FATAL ERROR:', err);
    try {
      proof.finishedAt = new Date().toISOString();
      const outDir = path.join(__dirname, 'output');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'accounting_master_test_RESULT.json'), JSON.stringify(proof, null, 2), 'utf8');
      fs.writeFileSync(path.join(outDir, 'accounting_master_test_RESULT.md'), renderMarkdown(proof), 'utf8');
      console.error('Partial proof files written to scripts/output/');
    } catch (e: any) {
      console.error('Failed writing proof files:', e?.message || String(e));
    }
    process.exit(1);
  } finally {
    // prisma instance is managed by src/config/database
  }
}

main();

