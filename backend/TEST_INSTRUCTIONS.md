# Voucher Auto-Creation Test Instructions

## ⚠️ IMPORTANT: Backend Server Must Be Restarted

The code has been fixed and built, but **the backend server needs to be restarted** to load the new code.

## Steps to Test:

### 1. Restart Backend Server

Stop the current backend server (if running) and start it again:

```bash
cd /var/www/nextapp/backend
npm run dev
```

Or if using PM2 or another process manager:
```bash
pm2 restart backend
# or
systemctl restart your-backend-service
```

### 2. Run the Test

After restarting the server, run the test:

```bash
cd /var/www/nextapp/backend
node test-voucher-api-endpoint.js
```

### 3. Expected Result

After restarting the server, the test should show:
- ✅ Voucher was automatically created via API!
- Voucher Number: JV####
- Status: posted
- Total Debit/Credit matching the PO amount

## What Was Fixed

The issue was that `grandTotal` was calculated from request items BEFORE the order update, but we needed to use the updated order items. The fix:

1. Recalculates `grandTotal` from updated order items after the update
2. Uses `updatedGrandTotal` for voucher creation
3. Filters items to only include those with `receivedQty > 0`

## Manual Testing in Application

1. Open the application
2. Go to Purchase Orders
3. Create a new purchase order
4. Mark it as "Received"
5. Go to Vouchers page
6. You should see a new voucher automatically created with:
   - Voucher Number: JV####
   - Type: Journal
   - Narration: "Purchase Order Number: {PO Number}"
   - Status: Approved/Posted

## Troubleshooting

If vouchers are still not created after restarting:

1. Check backend server logs for errors
2. Verify the inventory account exists (code: 101001)
3. Verify supplier accounts can be created/found
4. Check that the PO has `receivedQty > 0` for at least one item
5. Verify the PO status is changing from non-"Received" to "Received"

