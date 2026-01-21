# Accounting Master Test System

**Complete accounting accuracy validation with controlled test transactions**

## Purpose

This test system creates isolated test transactions and validates all accounting formulas with strict checks:
- Voucher integrity (debits = credits)
- Ledger balances
- Trial balance equation
- Income statement calculations
- Balance sheet equation
- Document linkage

## How It Works

### 1. **Isolation with TEST_RUN_ID**
- Every test run generates a unique `TEST_RUN_ID = "TEST-{timestamp}"`
- All created records include this ID in description/notes fields
- Validations only use records containing the TEST_RUN_ID
- **No interference with existing data**

### 2. **Test Transactions Created**

| # | Transaction | Amount | Vouchers Created |
|---|-------------|--------|------------------|
| 1 | DPO Receive | Rs 1,000 | JV: DR Inventory, CR AP |
| 2 | DPO Payment (Partial) | Rs 500 | PV: DR AP, CR Cash |
| 3 | Sales Invoice CASH | Rs 7,500 | RV: DR Cash, CR Revenue<br>JV: DR COGS Rs 500, CR Inventory |
| 4 | Sales Invoice CREDIT | Rs 6,000 | JV: DR AR, CR Revenue<br>JV: DR COGS Rs 400, CR Inventory |

**Total Expected:**
- Revenue: Rs 13,500
- COGS: Rs 900
- Gross Profit: Rs 12,600
- Inventory Net: +Rs 100 (1000 - 500 - 400)
- Cash Net: +Rs 7,000 (7500 - 500)
- AP Balance: Rs 500 CR (1000 - 500)
- AR Balance: Rs 6,000 DR

### 3. **Strict Formula Validations**

#### Voucher Integrity
```
For each voucher:
  Sum(entries.debit) == Sum(entries.credit)
  Tolerance: ±0.01
```

#### Ledger Validation
```
For each account:
  Net Movement = Sum(debit) - Sum(credit)
  Assert: Actual Net ≈ Expected Net
```

#### Trial Balance
```
Total Debits = Sum(all debit entries)
Total Credits = Sum(all credit entries)
Assert: Total Debits == Total Credits
```

#### Income Statement
```
Revenue = Sum(revenue account credits - debits)
COGS = Sum(cogs account debits - credits)
Gross Profit = Revenue - COGS

Assert:
  Revenue == 13,500
  COGS == 900
  Gross Profit == 12,600
```

#### Balance Sheet
```
Assets = Inventory + Cash + AR + Opening Cash Balance
Liabilities = AP (supplier payable)
Equity = Net Income

Assert: Assets == Liabilities + Equity
```

#### Document Linkage
```
For each voucher:
  Assert: reference field contains document number (DPO/INV)
```

## Running the Test

### Prerequisites
1. Backend server running on PORT 3001
2. Database with schema migrated
3. Node.js and npm installed

### Execute

```bash
cd /var/www/Dev-Koncepts/backend
PORT=3001 npm run smoke:accounting:master
```

### Check Exit Code

```bash
echo "EXIT_CODE=$?"
```

- **Exit Code 0**: All tests passed ✅
- **Exit Code 1**: Some tests failed ❌

## Output

### Terminal Output

Real-time test execution with results:

```
🚀 Starting Accounting Master Test System...
Test Run ID: TEST-1705123456789

📋 Setting up test accounts...
✅ Test accounts created

📦 Creating test data...
✅ Test data created

💰 Transaction 1: DPO Receive...
✅ DPO Created: DPO-2026-001, Voucher: JV-2026-001

💳 Transaction 2: DPO Payment (Partial)...
✅ Payment Created: PV-2026-001

... (more transactions)

🔍 Validating Voucher Integrity...
  ✅ Voucher JV-2026-001 Balance: 1000.00 ≈ 1000.00
  ✅ Voucher PV-2026-001 Balance: 500.00 ≈ 500.00
  ...

📊 Validating Ledgers...
  ✅ Inventory Net Movement: 100.00 ≈ 100.00
  ✅ Supplier AP Net Movement: -500.00 ≈ -500.00
  ...

⚖️ Validating Trial Balance...
  ✅ Trial Balance (Debits = Credits): 27900.00 ≈ 27900.00

💵 Validating Income Statement...
  ✅ Revenue Total: 13500.00 ≈ 13500.00
  ✅ COGS Total: 900.00 ≈ 900.00
  ✅ Gross Profit: 12600.00 ≈ 12600.00

🏦 Validating Balance Sheet...
  ✅ Balance Sheet Equation: 114100.00 ≈ 114100.00

================================================================================
📋 ACCOUNTING MASTER TEST REPORT
================================================================================
Overall Status: ✅ PASS
Summary: 15/15 tests passed
================================================================================

Final Result: ✅ ALL TESTS PASSED

Exiting with code: 0
```

### File Outputs

Two files are generated in `backend/scripts/output/`:

#### 1. `accounting_master_test_RESULT.json`
Complete test results in JSON format for programmatic analysis:

```json
{
  "testRunId": "TEST-1705123456789",
  "timestamp": "2026-01-13T10:30:00.000Z",
  "overallStatus": "PASS",
  "summary": {
    "totalTests": 15,
    "passed": 15,
    "failed": 0
  },
  "createdData": {
    "suppliers": ["supplier-id-1"],
    "customers": ["customer-id-1"],
    "parts": ["part-id-1", "part-id-2"],
    "dpos": ["dpo-id-1"],
    "salesInvoices": ["invoice-id-1", "invoice-id-2"],
    "vouchers": ["voucher-id-1", "voucher-id-2", ...]
  },
  "tests": {
    "voucherIntegrity": [...],
    "ledgerValidation": [...],
    "trialBalance": {...},
    "incomeStatement": {...},
    "balanceSheet": {...},
    "documentLinkage": [...]
  }
}
```

#### 2. `accounting_master_test_RESULT.md`
Human-readable Markdown report with formatted results.

## Interpreting Results

### ✅ All Tests Pass

```
Overall Status: ✅ PASS
Summary: 15/15 tests passed
Final Result: ✅ ALL TESTS PASSED
```

**Meaning:**
- All vouchers are balanced (debits = credits)
- All ledgers have correct net movements
- Trial balance is balanced
- Income statement calculations are correct
- Balance sheet equation holds
- All vouchers link to source documents

**Action:** ✅ Accounting system is working correctly!

### ❌ Some Tests Fail

```
Overall Status: ❌ FAIL
Summary: 13/15 tests passed

❌ COGS Total: Expected 900.00, got 1000.00 (diff: 100.00)
❌ Voucher JV-2026-005 has document reference: MISSING
```

**Meaning:**
- Specific tests failed
- Accounting formulas or voucher creation has issues

**Action:**
1. Review failed test messages
2. Check the specific voucher/account mentioned
3. Verify formula implementation
4. Fix the issue
5. Re-run the test

## Common Failure Scenarios

### 1. Voucher Imbalance
```
❌ Voucher JV-2026-001 Balance: Expected 1000.00, got 1050.00 (diff: 50.00)
```

**Cause:** Debit and credit entries don't match
**Fix:** Check voucher creation logic, ensure DR = CR

### 2. Ledger Mismatch
```
❌ Inventory Net Movement: Expected 100.00, got 200.00 (diff: 100.00)
```

**Cause:** Stock movements or COGS calculation incorrect
**Fix:** Verify COGS formula, check stock movement creation

### 3. Trial Balance Imbalance
```
❌ Trial Balance (Debits = Credits): 27900.00 != 28000.00 (diff: 100.00)
```

**Cause:** Some voucher has imbalanced entries
**Fix:** Check all vouchers for debit/credit balance

### 4. Income Statement Error
```
❌ Revenue Total: Expected 13500.00, got 12000.00 (diff: 1500.00)
```

**Cause:** Missing revenue voucher or incorrect account
**Fix:** Verify sales invoice posting creates revenue voucher

### 5. Balance Sheet Equation Failure
```
❌ Balance Sheet Equation: 114100.00 != 113600.00 (diff: 500.00)
Assets: 114100.00
Liabilities: 500.00
Equity: 113100.00
```

**Cause:** Assets don't equal Liabilities + Equity
**Fix:** Check all asset/liability/equity account movements

### 6. Missing Document Reference
```
❌ Voucher PV-2026-001 has document reference: MISSING
```

**Cause:** Voucher reference field not populated
**Fix:** Ensure vouchers include DPO/Invoice number in reference field

## Test Data Cleanup

**Important:** Test data is **NOT automatically deleted**.

To clean up test data:

```sql
-- Find all test records
SELECT * FROM Voucher WHERE narration LIKE '%TEST-%';
SELECT * FROM DirectPurchaseOrder WHERE description LIKE '%TEST-%';
SELECT * FROM SalesInvoice WHERE remarks LIKE '%TEST-%';
SELECT * FROM StockMovement WHERE notes LIKE '%TEST-%';

-- Delete test records (be careful!)
DELETE FROM VoucherEntry WHERE description LIKE '%TEST-%';
DELETE FROM Voucher WHERE narration LIKE '%TEST-%';
-- ... etc for other tables
```

Or run a cleanup script (create if needed):

```bash
npm run cleanup:test-data
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Accounting Tests

on: [push, pull_request]

jobs:
  test-accounting:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd backend && npm install
      - run: cd backend && npx prisma migrate deploy
      - run: cd backend && PORT=3001 npm start & sleep 5
      - run: cd backend && PORT=3001 npm run smoke:accounting:master
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: accounting-test-results
          path: backend/scripts/output/
```

## Troubleshooting

### Test hangs or doesn't exit

**Cause:** Database connection not closed properly
**Fix:** Ensure `prisma.$disconnect()` is called in finally block

### Port 3001 not available

**Cause:** Backend not running or port conflict
**Fix:** 
```bash
# Check if backend is running
lsof -i :3001

# Start backend
cd /var/www/Dev-Koncepts/backend
PORT=3001 npm run dev
```

### Prisma errors

**Cause:** Schema not migrated or database not accessible
**Fix:**
```bash
cd /var/www/Dev-Koncepts/backend
npx prisma migrate deploy
npx prisma generate
```

### Test fails immediately

**Cause:** Database schema mismatch or missing tables
**Fix:** Check prisma schema, run migrations

## Extending the Tests

### Adding New Transactions

Edit `accounting_master_test.ts` and add new transaction functions:

```typescript
async function transaction5_PurchaseReturn(testData: any, accounts: any) {
  // Create return transaction
  // Create reversal voucher
}

// Then call in main():
await transaction5_PurchaseReturn(testData, accounts);
```

### Adding New Validations

```typescript
async function validateCustomCheck() {
  console.log('\n🔍 Validating Custom Check...');
  
  // Your validation logic
  const result = assert(condition, 'Custom Check Description');
  report.tests.customCheck = result;
}

// Then call in main():
await validateCustomCheck();
```

## References

- **Formula Documentation:** `/docs/ACCOUNTING_FORMULAS_WHEN_TO_RUN.md`
- **Formula Implementation:** `/backend/src/utils/inventoryFormulas.ts`
- **Integration Guide:** `/backend/src/utils/INVENTORY_FORMULAS_README.md`
- **Implementation Summary:** `/FORMULAS_IMPLEMENTATION_SUMMARY.md`

## Support

If tests fail:
1. Read the failure message carefully
2. Check the JSON/Markdown output files
3. Review the specific voucher/account mentioned
4. Verify formula implementation
5. Check prisma schema for field mismatches

For questions:
- Review `/docs/ACCOUNTING_FORMULAS_WHEN_TO_RUN.md`
- Check test source code in `accounting_master_test.ts`
- Look at created vouchers in database directly

---

**Last Updated:** January 2026  
**Version:** 1.0
