# Dev-Koncepts Backend

## Smoke test: accounting posting

Run (backend must be running on `http://localhost:3001`):

```bash
npm run smoke:accounting
```

What it verifies:

- DPO create posts a **journal** voucher (JV) and it is **balanced** (totalDebit == totalCredit)
  - Includes **DR Inventory** (account code `101001`)
  - Includes **CR Supplier Payable** (account code prefix `301`)
- DPO payment posts a **payment** voucher (PV) and it is **balanced**
- Sales invoice posts:
  - A **revenue JV** (Receivable vs Sales Revenue) and it is **balanced**
  - A **receipt RV** (Cash/Bank vs Receivable) and it is **balanced**
  - A **COGS JV** (COGS vs Inventory) at approval time and it is **balanced**

## Final End-to-End Accounting Workflow Verification

Run the comprehensive accounting workflow test:

```bash
npm run smoke:accounting:final
```

### What it validates

This test provides complete end-to-end verification of the accounting system by validating:

1. **SCENARIO A: DPO creates JOURNAL voucher**
   - Creates a Direct Purchase Order (DPO) with supplier and inventory
   - Triggers the same posting path used by the real system
   - Validates:
     - A new voucher exists with `type="journal"` and voucherNumber prefix "JV"
     - Voucher has at least 2 entries
     - `totalDebit == totalCredit` (voucher is balanced)
     - Contains Inventory entry (account code `101001`)
     - Contains Supplier payable entry (account code prefix `301`)
     - Voucher numbering increments correctly
     - DPO exists in database

2. **SCENARIO B: DPO Payment creates PAYMENT voucher**
   - Triggers DPO payment logic
   - Validates:
     - New voucher with `type="payment"` and prefix "PV"
     - Voucher is balanced (`totalDebit == totalCredit`)
     - Entries include supplier payable DR and cash/bank CR
     - Voucher numbering increments correctly

3. **SCENARIO C: Sales Invoice posting**
   - Creates sales invoice with customer and parts
   - Triggers the sales invoice creation path
   - Validates:
     - Creates cost-out voucher `type="journal"` (Inventory vs COGS) - balanced
     - Creates receipt/revenue voucher `type="receipt"` (Sales vs Cash/Bank/Customer) - balanced
     - Creates revenue voucher `type="journal"` (Receivable vs Sales Revenue) - balanced
     - Voucher numbers increment per type (no duplicates)
     - Invoice exists in database

4. **SCENARIO D: API filter correctness**
   - Tests voucher type filtering
   - Validates:
     - `GET /api/vouchers?type=3` returns only journals
     - `GET /api/vouchers?type=1` returns only payments
     - `GET /api/vouchers?type=2` returns only receipts
     - String filters (`type=journal`, `type=payment`, `type=receipt`) still work
     - `/api/getVouchers` alias behaves identically

### Expected output format

The test prints:
- Detailed PASS/FAIL status for each scenario
- Created voucher numbers in order
- Final summary: `TOTAL PASS / TOTAL FAIL`
- Exit code: `0` if all pass, `1` if any fail

Example output:
```
═══════════════════════════════════════════════════════════
  FINAL ACCOUNTING WORKFLOW VERIFICATION
═══════════════════════════════════════════════════════════

📋 SCENARIO A: DPO creates JOURNAL voucher
  ✓ PASS: Voucher type is 'journal'
  ✓ PASS: Voucher number starts with 'JV'
  ...

✅ PASS: A: DPO creates JOURNAL voucher
    Created DPO: DPO-2026-001
    Created voucher: JV0001
    ...

═══════════════════════════════════════════════════════════
  SUMMARY
═══════════════════════════════════════════════════════════

✅ PASS: A: DPO creates JOURNAL voucher
✅ PASS: B: DPO Payment creates PAYMENT voucher
✅ PASS: C: Sales Invoice posting
✅ PASS: D: API filter correctness

═══════════════════════════════════════════════════════════
TOTAL PASS: 4
TOTAL FAIL: 0
═══════════════════════════════════════════════════════════

Created Voucher Numbers (in order):
  1. JV0001
  2. PV0001
  3. JV0002
  4. RV0001
  5. JV0003
```

### Notes

- The test uses Prisma client directly and calls the same service/helper functions used by routes
- Test data is created in transactions and cleaned up automatically
- Tests are deterministic and self-contained
- No frontend/UI changes required
- Voucher type compatibility: Supports both numeric (`type=1/2/3`) and string (`type=payment/receipt/journal`) filters

## Final Financial Reports & Ledgers Verification (STRICT MODE)

Run the comprehensive financial reports and ledgers test with **STRICT** assertions:

```bash
npm run smoke:accounting:reports
```

### What it validates (STRICT - Test-Run Only)

This test provides **STRICT** end-to-end verification of the accounting system. It uses a unique `TEST_RUN_ID` to isolate test data from existing system data and validates **ONLY** transactions created in this test run.

**Key Features:**
- **Deterministic and Isolated**: Uses `TEST_RUN_ID` to filter all validations to test-run transactions only
- **No Historical Data Pollution**: Computes balances ONLY from test-run vouchers/journal entries
- **STRICT Assertions**: Exact amount matching (tolerance ≤ 0.01) - no relaxed checks
- **Fail Fast**: Exit code 1 if ANY assertion fails

### Test Transactions (Fixed Amounts)

The test creates these transactions with fixed amounts:

- **A) DPO receive**: Inventory +1000, Supplier Payable +1000
- **B) DPO payment**: Supplier Payable -500, Cash/Bank -500
- **C) Sales invoice CASH**: Revenue +7500, COGS -5000, Cash +7500, Inventory -5000
- **D) Sales invoice CREDIT**: Revenue +6000, COGS -4000, AR +6000, Inventory -4000
- **E) Adjust inventory**: Add +200, Remove -100 (no vouchers created, expected)

### Expected Totals (Test-Run Only)

From the test transactions:
- **Total Revenue**: 13,500 (7,500 + 6,000)
- **Total COGS**: 9,000 (5,000 + 4,000)
- **Gross Profit**: 4,500 (13,500 - 9,000)
- **Net Inventory change**: -8,000 (+1,000 - 5,000 - 4,000)
- **Supplier Payable net**: +500 (+1,000 - 500)
- **AR net**: +6,000
- **Cash/Bank net**: +7,000 (-500 + 7,500)

### Validation Steps

This test validates:

1. **STEP 1: Identify endpoints**
   - Lists all report/ledger endpoints
   - Lists all posting endpoints
   - Confirms endpoint availability

2. **STEP 2: Setup test data**
   - Creates Store, Supplier, Customer
   - Creates/verifies required accounts (Inventory, Cash, AP, AR, Sales Revenue, COGS)
   - Creates test parts with initial stock

3. **STEP 3: Execute business transactions**
   - Transaction 1: DPO receive (creates JV: Inventory DR, AP CR)
   - Transaction 2: DPO payment (creates PV: AP DR, Cash/Bank CR)
   - Transaction 3: Sales invoice CASH (creates RV + cost JV)
   - Transaction 4: Sales invoice CREDIT (creates revenue posting + AR entry + cost JV)
   - Transaction 5: Adjust inventory (increase and decrease)

4. **STEP 4: Validate voucher integrity (STRICT)**
   - Every test-run voucher is **exactly balanced**: `totalDebit == totalCredit` (tolerance ≤ 0.01)
   - Voucher entry sums match voucher totals exactly
   - Voucher numbers are unique and increment correctly by type
   - All vouchers contain `TEST_RUN_ID` in narration

5. **STEP 5: Validate ledger integrity (STRICT - Test-Run Only)**
   - Computes balances **ONLY** from test-run vouchers/journal entries (filtered by `TEST_RUN_ID`)
   - **Inventory ledger**: Net = -8,000 (exact match)
   - **Supplier AP ledger**: Net = +500 (exact match)
   - **AR ledger**: Net = +6,000 (exact match)
   - **Cash/Bank ledger**: Net = +7,000 (exact match)

6. **STEP 6: Validate Trial Balance (STRICT)**
   - Computes trial balance from test-run transactions only
   - **MUST balance exactly**: `totalDebit == totalCredit` (tolerance ≤ 0.01)
   - Fails if equation does not hold

7. **STEP 7: Validate Balance Sheet (STRICT)**
   - Computes balance sheet from test-run transactions only
   - **MUST satisfy equation**: `Assets == Liabilities + Equity` (tolerance ≤ 0.01)
   - Key account balances match expected amounts exactly (Inventory, Cash, AP, AR)

8. **STEP 8: Validate Income Statement (STRICT)**
   - Computes income statement from test-run transactions only
   - **Revenue**: Exactly 13,500 (tolerance ≤ 0.01)
   - **COGS**: Exactly 9,000 (tolerance ≤ 0.01)
   - **Gross Profit**: Exactly 4,500 (tolerance ≤ 0.01)

9. **STEP 9: Validate General Journal (STRICT)**
   - Computes general journal from test-run transactions only
   - **ALL** created voucher numbers MUST appear in the journal
   - Fails if any voucher is missing

10. **STEP 10: Validate document linkages**
    - Verifies voucher records include references to DPO/PO/Invoice id/number
    - Confirms linkages via explicit fields or reliable narration/reference mapping
    - All linkages must contain `TEST_RUN_ID`

### Expected output format

The test prints:
- **TEST_RUN_ID** (unique identifier for this test run)
- Detailed PASS/FAIL status for each step with **STRICT** assertions
- Created document IDs (DPO/PO/Invoice)
- Created voucher numbers in order
- Report totals with exact expected vs actual comparisons
- Final summary: `TOTAL PASS / TOTAL FAIL`
- Exit code: `0` if all pass, `1` if any fail

Example output:
```
═══════════════════════════════════════════════════════════
  FINAL FINANCIAL REPORTS & LEDGERS VERIFICATION
═══════════════════════════════════════════════════════════

📋 STEP 1: Identifying Report/Ledger Endpoints
  ✓ PASS: All endpoints identified

📋 STEP 2: Setting up test data
  ✓ PASS: Test data setup completed

📋 STEP 3: Executing business transactions
  ✓ PASS: All transactions executed

...

═══════════════════════════════════════════════════════════
  SUMMARY
═══════════════════════════════════════════════════════════

✅ PASS: 1: Identify endpoints
✅ PASS: 2: Setup test data
✅ PASS: 3: Execute transactions
...

═══════════════════════════════════════════════════════════
TOTAL PASS: 10
TOTAL FAIL: 0
═══════════════════════════════════════════════════════════
```

### Notes

- **STRICT MODE**: All assertions use exact amount matching (tolerance ≤ 0.01)
- **Test-Run Isolation**: Uses `TEST_RUN_ID` to filter all validations to test-run transactions only
- **No Historical Data**: Does NOT use `currentBalance` - computes balances only from test-run transactions
- **Fail Fast**: Exit code 1 if ANY assertion fails
- **Deterministic**: Test data is self-contained and cleaned up automatically
- **Comprehensive**: Validates vouchers, ledgers, trial balance, balance sheet, income statement, general journal, and document linkages
