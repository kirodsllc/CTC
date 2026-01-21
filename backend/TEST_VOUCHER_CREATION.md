# 🧪 Test Automatic Voucher Creation

## ⚠️ IMPORTANT: Restart Backend First

**Step 1: Open a NEW terminal in Cursor and run:**

```bash
cd /var/www/Dev-Koncepts/backend
./restart-backend.sh
```

Wait for: `🚀 Server is running on http://localhost:3001`

---

## ✅ Test Supplier Opening Balance → Voucher Creation

**Step 2: In another terminal, test supplier creation:**

```bash
curl -X POST http://localhost:3001/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "VOUCHER TEST SUPPLIER",
    "name": "Test Supplier",
    "openingBalance": 250000,
    "date": "2026-01-13",
    "status": "active"
  }' | jq '.'
```

**Expected Output:** Supplier created with code like `SUP-007`

---

**Step 3: Check if voucher was auto-created:**

```bash
curl http://localhost:3001/api/vouchers | jq '.data[] | {voucherNumber, type, totalDebit, narration}'
```

**Expected Output:** You should see a new voucher like:
```json
{
  "voucherNumber": "JV-0001",
  "type": "journal",
  "totalDebit": 250000,
  "narration": "Supplier Opening Balance: Test Supplier (SUP-007)"
}
```

---

## ✅ Test Customer Opening Balance → Voucher Creation

**Step 4: Test customer creation:**

```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VOUCHER TEST CUSTOMER",
    "openingBalance": 180000,
    "date": "2026-01-13",
    "status": "active"
  }' | jq '.'
```

**Step 5: Check vouchers again:**

```bash
curl http://localhost:3001/api/vouchers | jq '.data[] | {voucherNumber, type, totalDebit, narration}'
```

**Expected Output:** You should see TWO vouchers now (supplier + customer)

---

## 🔍 Check Backend Logs

**In the terminal running the backend, you should see:**

```
🔍 DEBUG: parsedOpeningBalance = 250000, condition = true
✅ Opening balance > 0, creating voucher...
✅ Created supplier account 301XXX and JV voucher JV-0001 for opening balance
```

---

## 📊 Verify in Accounting Reports

**Step 6: Check General Journal:**

```bash
curl "http://localhost:3001/api/accounting/general-journal?from_date=2026-01-01&to_date=2026-01-31" | jq '.data[]'
```

**You should see:**
- Voucher entries for the supplier
- Voucher entries for the customer
- All with correct debits and credits

---

## ✅ Success Criteria

- ✅ Supplier created → Voucher auto-created
- ✅ Customer created → Voucher auto-created
- ✅ Vouchers appear in `/api/vouchers`
- ✅ Vouchers appear in General Journal
- ✅ Debug logs show voucher creation
- ✅ Owner Capital account (501003) created if needed
- ✅ Supplier/Customer accounts created under correct subgroups

---

## ❌ Troubleshooting

### No voucher created?

1. **Check backend logs** for errors
2. **Verify opening balance > 0** in request
3. **Check if Owner Capital account exists:**
   ```bash
   curl "http://localhost:3001/api/accounts?code=501003"
   ```
4. **Check if supplier/customer account was created:**
   ```bash
   curl "http://localhost:3001/api/accounts?code=301"
   curl "http://localhost:3001/api/accounts?code=103"
   ```

### Backend not starting?

1. Check port 3001 and 3002 are free:
   ```bash
   lsof -i :3001
   lsof -i :3002
   ```
2. Kill any processes on those ports:
   ```bash
   pkill -9 -f "tsx"
   pkill -9 -f "node.*server"
   ```
3. Try starting again

---

## 📝 Code Changes Made

**Files Modified:**
1. `/backend/src/routes/suppliers.ts` - Added auto-voucher creation
2. `/backend/src/routes/customers.ts` - Added auto-voucher creation
3. `/backend/src/routes/accounting.ts` - Updated all 4 reports to show vouchers

**See:** `VOUCHER_ACCOUNTING_INTEGRATION_COMPLETE.md` for full details.
