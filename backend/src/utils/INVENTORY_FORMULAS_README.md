# Inventory Formulas Implementation Guide

This README explains how to use the inventory formulas implemented in `inventoryFormulas.ts`.

## Overview

The `inventoryFormulas.ts` file implements all formulas documented in `/docs/ACCOUNTING_FORMULAS_WHEN_TO_RUN.md` as actual TypeScript functions.

## Quick Reference

### 1. Stock Quantity
```typescript
import { calculateStockQuantity } from './utils/inventoryFormulas';

const currentStock = await calculateStockQuantity(partId);
```

### 2. Average Cost Update (on Purchase Receive)
```typescript
import { calculateAverageCost } from './utils/inventoryFormulas';

const newAvgCost = calculateAverageCost(
  oldQty,      // 100 units
  oldAvgCost,  // Rs 10 per unit
  newQty,      // 50 units
  newUnitCost  // Rs 12 per unit
);
// Result: Rs 10.67 per unit
```

### 3. COGS Calculation (on Sales Post)
```typescript
import { calculateCOGS } from './utils/inventoryFormulas';

const cogs = calculateCOGS(
  soldQty,   // 20 units
  avgCost    // Rs 10.67 per unit
);
// Result: Rs 213.40
```

### 4. Purchase Receive with Expenses
```typescript
import { processPurchaseReceive } from './utils/inventoryFormulas';

const result = await processPurchaseReceive(
  [
    { partId: 'part1', quantity: 100, purchasePrice: 10 },
    { partId: 'part2', quantity: 150, purchasePrice: 15 },
  ],
  5000, // total expenses
  'value' // distribution method
);

// Result includes:
// - Distributed expenses per item
// - Landed cost per unit
// - Updated average costs
```

### 5. Sales Invoice Post with COGS
```typescript
import { processSalesPost } from './utils/inventoryFormulas';

const result = await processSalesPost(
  [
    { partId: 'part1', quantity: 20, salePrice: 15 },
    { partId: 'part2', quantity: 30, salePrice: 25 },
  ],
  false // allowNegativeStock
);

// Result includes:
// - COGS per item
// - Gross profit per item
// - Stock warnings if insufficient
// - Totals
```

## Integration Examples

### Example 1: Direct Purchase Order Receive

```typescript
// In your DPO receive route:
router.put('/direct-purchase-orders/:id/receive', async (req, res) => {
  const { items, expenses } = req.body;
  
  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  // Process receive with formula
  const receiveResult = await processPurchaseReceive(
    items.map(item => ({
      partId: item.partId,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
    })),
    totalExpenses,
    'value' // distribute by value
  );
  
  // Create stock movements
  for (const item of receiveResult.items) {
    await prisma.stockMovement.create({
      data: {
        partId: item.partId,
        quantity: item.quantity,
        type: 'in',
        referenceType: 'direct_purchase',
        referenceId: dpoId,
        cost: item.landedCost,
      },
    });
  }
  
  // Create Payment Voucher (PV)
  // DR Inventory (at landed cost)
  // CR Cash/Bank
  const inventoryTotal = receiveResult.items.reduce(
    (sum, item) => sum + (item.quantity * item.landedCost), 
    0
  );
  
  await createPaymentVoucher({
    debitAccountId: inventoryAccountId,
    creditAccountId: cashBankAccountId,
    amount: inventoryTotal,
    description: `DPO ${dpoNumber} - Inventory Purchase`,
  });
  
  res.json({ success: true, result: receiveResult });
});
```

### Example 2: Sales Invoice Post

```typescript
// In your sales invoice post route:
router.post('/sales-invoices/:id/post', async (req, res) => {
  const { items, customerId } = req.body;
  
  // Process sales with COGS calculation
  const salesResult = await processSalesPost(
    items.map(item => ({
      partId: item.partId,
      quantity: item.quantity,
      salePrice: item.salePrice,
    })),
    false // don't allow negative stock
  );
  
  // Check for stock warnings
  if (salesResult.stockWarnings.length > 0) {
    return res.status(400).json({
      error: 'Insufficient stock',
      warnings: salesResult.stockWarnings,
    });
  }
  
  // Create stock OUT movements
  for (const item of salesResult.items) {
    await prisma.stockMovement.create({
      data: {
        partId: item.partId,
        quantity: item.quantity,
        type: 'out',
        referenceType: 'sales_invoice',
        referenceId: invoiceId,
        cost: item.avgCost,
      },
    });
  }
  
  // Create Journal Entry 1: Revenue
  // DR Accounts Receivable
  // CR Sales Revenue
  await createJournalEntry({
    debitAccountId: receivablesAccountId,
    creditAccountId: salesRevenueAccountId,
    amount: salesResult.totalRevenue,
    description: `Invoice ${invoiceNumber} - Sales Revenue`,
  });
  
  // Create Journal Entry 2: COGS
  // DR Cost of Goods Sold (Expense)
  // CR Inventory (Asset)
  await createJournalEntry({
    debitAccountId: cogsAccountId,
    creditAccountId: inventoryAccountId,
    amount: salesResult.totalCOGS,
    description: `Invoice ${invoiceNumber} - COGS`,
  });
  
  res.json({
    success: true,
    result: salesResult,
    grossProfit: salesResult.totalGrossProfit,
  });
});
```

### Example 3: Inventory Adjustment IN

```typescript
// In your inventory adjustment route:
router.post('/inventory/adjust-in', async (req, res) => {
  const { partId, quantity, unitCost, reason } = req.body;
  
  // Process adjustment with formula
  const adjustResult = await processInventoryAdjustmentIn(
    partId,
    quantity,
    unitCost // optional - updates avg cost if provided
  );
  
  // Create stock movement
  await prisma.stockMovement.create({
    data: {
      partId,
      quantity,
      type: 'in',
      referenceType: 'adjustment',
      reason,
      cost: adjustResult.newAvgCost,
    },
  });
  
  // Create Journal Entry
  // DR Inventory (Asset)
  // CR Inventory Adjustment Gain (Income/Contra)
  const adjustmentValue = quantity * adjustResult.newAvgCost;
  
  await createJournalEntry({
    debitAccountId: inventoryAccountId,
    creditAccountId: adjustmentGainAccountId,
    amount: adjustmentValue,
    description: `Inventory Adjustment IN - ${reason}`,
  });
  
  res.json({ success: true, result: adjustResult });
});
```

### Example 4: Inventory Adjustment OUT

```typescript
// In your inventory adjustment route:
router.post('/inventory/adjust-out', async (req, res) => {
  const { partId, quantity, reason } = req.body;
  
  // Process adjustment with COGS
  const adjustResult = await processInventoryAdjustmentOut(
    partId,
    quantity
  );
  
  // Check if sufficient stock
  if (adjustResult.oldQty < quantity) {
    return res.status(400).json({
      error: 'Insufficient stock',
      available: adjustResult.oldQty,
      requested: quantity,
    });
  }
  
  // Create stock movement
  await prisma.stockMovement.create({
    data: {
      partId,
      quantity,
      type: 'out',
      referenceType: 'adjustment',
      reason,
      cost: adjustResult.avgCost,
    },
  });
  
  // Create Journal Entry
  // DR Inventory Adjustment Loss (Expense)
  // CR Inventory (Asset)
  await createJournalEntry({
    debitAccountId: adjustmentLossAccountId,
    creditAccountId: inventoryAccountId,
    amount: adjustResult.cogs,
    description: `Inventory Adjustment OUT - ${reason}`,
  });
  
  res.json({ success: true, result: adjustResult });
});
```

## Formula Testing

### Test Average Cost Calculation
```typescript
// Test Case 1: Basic weighted average
const result1 = calculateAverageCost(100, 10, 50, 12);
console.assert(result1 === 10.666666666666666, 'Basic avg cost');

// Test Case 2: Zero old quantity
const result2 = calculateAverageCost(0, 0, 50, 12);
console.assert(result2 === 12, 'Zero old qty');

// Test Case 3: Zero new cost
const result3 = calculateAverageCost(100, 10, 50, 0);
console.assert(result3 === 10, 'Zero new cost');
```

### Test COGS Calculation
```typescript
const cogs = calculateCOGS(20, 10.67);
console.assert(Math.abs(cogs - 213.4) < 0.01, 'COGS calculation');
```

### Test Expense Distribution
```typescript
const items = [
  { quantity: 100, price: 10 }, // Value: 1000
  { quantity: 150, price: 15 }, // Value: 2250
];
const totalExpenses = 650;

const distributed = distributeExpensesByValue(items, totalExpenses);
// Item 1: (1000/3250) * 650 = 200
// Item 2: (2250/3250) * 650 = 450

console.assert(Math.abs(distributed[0] - 200) < 0.01, 'Item 1 expense');
console.assert(Math.abs(distributed[1] - 450) < 0.01, 'Item 2 expense');
```

## Important Notes

### When to Update Average Cost
✅ **DO update** on:
- Purchase Order receive
- Direct Purchase Order receive
- Inventory Adjustment IN (with cost)

❌ **DON'T update** on:
- Sales
- Inventory Adjustment OUT
- Stock transfers

### COGS Timing
- Calculate COGS **at invoice post time**
- COGS uses **avg cost at time of sale** (snapshot)
- If avg cost changes later, COGS is NOT recalculated

### Stock Warnings
- Always check `stockWarnings` in `processSalesPost` result
- Decide whether to allow negative stock or reject sale
- Log warnings for review

### Voucher Creation
- Purchase receive → Payment Voucher (PV) or Journal Voucher (JV)
- Sales post → Two Journal Vouchers (Revenue + COGS)
- Adjustments → Journal Voucher

## Performance Tips

1. **Batch Operations**: When processing multiple items, use the batch functions like `processPurchaseReceive` and `processSalesPost`

2. **Cache Stock Quantities**: For read-heavy operations, consider caching stock quantities

3. **Transaction Wrapping**: Always wrap formula applications in database transactions

4. **Async/Await**: All formula functions that touch the database are async

## Error Handling

```typescript
try {
  const result = await processSalesPost(items, false);
  // Success
} catch (error) {
  if (error.message.includes('Stock validation failed')) {
    // Handle insufficient stock
  } else {
    // Other errors
  }
}
```

## Related Documentation

- `/docs/ACCOUNTING_FORMULAS_WHEN_TO_RUN.md` - Complete formula documentation
- `/docs/ACCOUNTING_MODULE_GUIDE.md` - Accounting module overview
- `/backend/src/routes/inventory.ts` - Inventory routes implementation
- `/backend/src/routes/sales.ts` - Sales routes implementation
