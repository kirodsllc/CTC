type Json = any;

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function assertBalanced(voucher: any, label: string) {
  const td = round2(Number(voucher.totalDebit ?? 0));
  const tc = round2(Number(voucher.totalCredit ?? 0));
  assert(td === tc, `${label}: not balanced (totalDebit=${td}, totalCredit=${tc})`);
}

async function httpJson(method: string, url: string, body?: unknown): Promise<Json> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${method} ${url}\n${text}`);
  }
  return json;
}

function pickFirst<T>(arr: T[], label: string): T {
  assert(Array.isArray(arr) && arr.length > 0, `Missing ${label}`);
  return arr[0]!;
}

function isCashOrBankAccount(acc: any): boolean {
  const subgroupCode = acc?.subgroup?.code;
  return subgroupCode === '101' || subgroupCode === '102';
}

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3001';

  // Health check
  await httpJson('GET', `${baseUrl}/api/health`);

  // Load reference data
  const suppliersResp = await httpJson('GET', `${baseUrl}/api/suppliers`);
  const supplier = pickFirst(suppliersResp.data, 'suppliers');

  const customersResp = await httpJson('GET', `${baseUrl}/api/customers`);
  const customer = pickFirst(customersResp.data, 'customers');

  const stores = await httpJson('GET', `${baseUrl}/api/inventory/stores`);
  const store = pickFirst(stores, 'stores');

  const accounts = await httpJson('GET', `${baseUrl}/api/accounting/accounts`);
  const inventoryAccount = accounts.find((a: any) => a.code === '101001') || accounts.find((a: any) => String(a?.name || '').toLowerCase().includes('inventory'));
  assert(inventoryAccount, 'Inventory account not found (expected code 101001)');

  const cashBankAccount = accounts.find((a: any) => isCashOrBankAccount(a));
  assert(cashBankAccount, 'No cash/bank account found (subgroup 101 or 102)');

  // Pick a part with cost AND available stock (or create enough DPO quantity to make it available)
  const partsResp = await httpJson('GET', `${baseUrl}/api/parts?limit=100&page=1`);
  const parts = partsResp.data || [];
  assert(Array.isArray(parts) && parts.length > 0, 'No parts returned from /api/parts');
  const partsWithCost = parts.filter((p: any) => typeof p.cost === 'number' && p.cost > 0);
  assert(partsWithCost.length > 0, 'No parts with cost found (need at least one part.cost > 0)');

  let part: any | undefined;
  let availableInfo: any | undefined;
  for (const candidate of partsWithCost.slice(0, 50)) {
    const info = await httpJson('GET', `${baseUrl}/api/sales/stock/available/${encodeURIComponent(candidate.id)}`);
    if (typeof info?.available === 'number') {
      part = candidate;
      availableInfo = info;
      if (info.available >= 1) break;
    }
  }
  part = part || partsWithCost[0];
  assert(part?.id, 'Could not select a part');

  // ---------- A) Create DPO and assert JV exists/balanced ----------
  const dpoDate = new Date().toISOString().slice(0, 10);
  const currentAvailable = typeof availableInfo?.available === 'number' ? availableInfo.available : 0;
  // If stock is negative, purchase enough to make available >= 1
  const dpoQty = Math.max(1, 1 - currentAvailable);
  const purchasePrice = typeof part.cost === 'number' && part.cost > 0 ? part.cost : 1;
  const dpoTotal = round2(purchasePrice * dpoQty);

  const dpoCreate = await httpJson('POST', `${baseUrl}/api/inventory/direct-purchase-orders`, {
    date: dpoDate,
    store_id: store.id,
    supplier_id: supplier.id,
    account: null, // important: don't auto-create PV here; we test payment separately
    description: 'Smoke: DPO create (accounting posting)',
    status: 'Completed',
    items: [
      {
        part_id: part.id,
        quantity: dpoQty,
        purchase_price: purchasePrice,
        amount: dpoTotal,
      },
    ],
    expenses: [],
  });

  const dpoId = dpoCreate.id;
  const dpoNo = dpoCreate.dpo_no;
  const dpoJvNo = dpoCreate?.vouchers?.jvNumber;
  assert(dpoId && dpoNo, 'DPO create did not return id/dpo_no');
  assert(dpoJvNo, `DPO ${dpoNo}: did not return vouchers.jvNumber`);

  const dpoJvList = await httpJson('GET', `${baseUrl}/api/vouchers?search=${encodeURIComponent(String(dpoJvNo))}&limit=5&page=1`);
  const dpoJv = (dpoJvList.data || []).find((v: any) => v.voucherNumber === dpoJvNo);
  assert(dpoJv, `Could not find DPO JV voucher ${dpoJvNo}`);
  assertBalanced(dpoJv, `DPO JV ${dpoJvNo}`);
  assert(dpoJv.type === 'journal', `DPO JV ${dpoJvNo}: expected type=journal, got ${dpoJv.type}`);
  assert(dpoJv.entries?.some((e: any) => String(e.account || '').includes('101001') && Number(e.debit) > 0), `DPO JV ${dpoJvNo}: missing DR Inventory (101001)`);
  assert(dpoJv.entries?.some((e: any) => String(e.account || '').startsWith('301') && Number(e.credit) > 0), `DPO JV ${dpoJvNo}: missing CR Supplier payable (301xxx)`);

  console.log(`✅ DPO created: ${dpoNo} -> JV ${dpoJvNo} (${dpoJv.totalDebit}/${dpoJv.totalCredit})`);

  // ---------- B) Create DPO payment voucher (PV) and assert balanced ----------
  const pvAmount = 1;
  const dpoPay = await httpJson('POST', `${baseUrl}/api/inventory/direct-purchase-orders/${encodeURIComponent(dpoId)}/payment`, {
    amount: pvAmount,
    cashBankAccountId: cashBankAccount.id,
    description: 'Smoke: DPO payment',
  });
  const pvNo = dpoPay?.data?.voucherNumber;
  assert(pvNo, 'DPO payment did not return voucherNumber');

  const pvList = await httpJson('GET', `${baseUrl}/api/vouchers?search=${encodeURIComponent(String(pvNo))}&limit=5&page=1`);
  const pv = (pvList.data || []).find((v: any) => v.voucherNumber === pvNo);
  assert(pv, `Could not find PV voucher ${pvNo}`);
  assertBalanced(pv, `DPO PV ${pvNo}`);
  assert(pv.type === 'payment', `PV ${pvNo}: expected type=payment, got ${pv.type}`);
  assert(pv.entries?.some((e: any) => String(e.account || '').startsWith('301') && Number(e.debit) > 0), `PV ${pvNo}: missing DR Supplier payable (301xxx)`);
  assert(pv.entries?.some((e: any) => String(e.account || '').startsWith('101') || String(e.account || '').startsWith('102')), `PV ${pvNo}: missing Cash/Bank line (101xxx/102xxx)`);

  console.log(`✅ DPO payment: ${dpoNo} -> PV ${pvNo} (${pv.totalDebit}/${pv.totalCredit})`);

  // ---------- C) Create Sales invoice + approve to trigger stock-out and cost posting ----------
  const unitPrice = typeof part.price_a === 'number' && part.price_a > 0 ? part.price_a : (purchasePrice * 2);
  const invQty = 1;
  const invTotal = round2(unitPrice * invQty);

  const invoiceCreate = await httpJson('POST', `${baseUrl}/api/sales/invoices`, {
    invoiceDate: new Date().toISOString(),
    customerId: customer.id,
    customerName: customer.name,
    customerType: 'registered',
    salesPerson: 'SmokeTest',
    cashAccountId: cashBankAccount.id,
    cashAmount: invTotal,
    bankAccountId: null,
    bankAmount: 0,
    subtotal: invTotal,
    overallDiscount: 0,
    tax: 0,
    grandTotal: invTotal,
    paidAmount: invTotal,
    items: [
      {
        partId: part.id,
        partNo: part.part_no || part.partNo || part.part_no_display || part.partNoDisplay || part.part_no,
        description: part.description || '',
        orderedQty: invQty,
        unitPrice,
        discount: 0,
        lineTotal: invTotal,
        brand: part.brand_name || '',
        grade: 'A',
      },
    ],
  });

  const invoiceId = invoiceCreate?.id;
  const invoiceNo = invoiceCreate?.invoiceNo;
  assert(invoiceId && invoiceNo, 'Invoice create did not return id/invoiceNo');

  // Approve (registered only) - this is where stock-out happens, and where we expect a cost JV to exist.
  await httpJson('POST', `${baseUrl}/api/sales/invoices/${encodeURIComponent(invoiceId)}/approve`, {
    approvedBy: 'SmokeTest',
  });

  const recentVouchers = await httpJson('GET', `${baseUrl}/api/vouchers?limit=50&page=1`);
  const vouchers: any[] = recentVouchers.data || [];

  const revenueJv = vouchers.find(v => v.type === 'journal' && (v.entries || []).some((e: any) => String(e.description || '').includes(`INV: ${invoiceNo} Sales Revenue`)));
  assert(revenueJv, `Missing Sales revenue JV voucher for invoice ${invoiceNo}`);
  assertBalanced(revenueJv, `Invoice revenue JV ${invoiceNo}`);

  const receiptVoucher = vouchers.find(v => v.type === 'receipt' && (v.entries || []).some((e: any) => String(e.description || '').includes(`Receipt for INV ${invoiceNo}`)));
  assert(receiptVoucher, `Missing receipt (RV) voucher for invoice ${invoiceNo}`);
  assertBalanced(receiptVoucher, `Invoice receipt voucher ${invoiceNo}`);

  const costJv = vouchers.find(v =>
    v.type === 'journal' &&
    (v.entries || []).some((e: any) => String(e.description || '').includes(`COGS for INV ${invoiceNo}`)) &&
    (v.entries || []).some((e: any) => String(e.account || '').includes('101001') && Number(e.credit) > 0)
  );
  assert(costJv, `Missing cost JV (COGS vs Inventory) for invoice ${invoiceNo}`);
  assertBalanced(costJv, `Invoice cost JV ${invoiceNo}`);

  console.log(`✅ Sales invoice: ${invoiceNo}`);
  console.log(`   - Revenue JV: ${revenueJv.voucherNumber} (${revenueJv.totalDebit}/${revenueJv.totalCredit})`);
  console.log(`   - Receipt:    ${receiptVoucher.voucherNumber} (${receiptVoucher.totalDebit}/${receiptVoucher.totalCredit})`);
  console.log(`   - Cost JV:    ${costJv.voucherNumber} (${costJv.totalDebit}/${costJv.totalCredit})`);

  console.log('✅ Smoke test passed');
}

main().catch((err) => {
  console.error('❌ Smoke test failed');
  console.error(err?.stack || err);
  process.exit(1);
});

