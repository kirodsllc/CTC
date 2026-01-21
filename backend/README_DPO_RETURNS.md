# DPO Returns - Implementation Summary

## What Was Created

### 1. Database Schema
- **DirectPurchaseOrderReturn** table: Stores return header information
- **DirectPurchaseOrderReturnItem** table: Stores individual return line items
- Migration file: `prisma/migrations/add_dpo_returns.sql`
- Updated Prisma schema with new models and relations

### 2. API Endpoints
File: `backend/src/routes/dpo-returns.ts`

- `GET /api/dpo-returns` - List all returns (with filters)
- `GET /api/dpo-returns/:id` - Get single return details
- `POST /api/dpo-returns` - Create new return
- `POST /api/dpo-returns/:id/approve` - Approve and process return
- `POST /api/dpo-returns/:id/reject` - Reject return
- `DELETE /api/dpo-returns/:id` - Delete pending return

### 3. Documentation
- `docs/DPO_RETURN_SYSTEM.md` - Complete system documentation
- `docs/DPO_RETURN_API_EXAMPLES.md` - API usage examples and testing guide
- `backend/README_DPO_RETURNS.md` - This file

## How It Works

### Return Creation Flow
1. User creates return request with items and quantities
2. System validates:
   - DPO exists and is completed
   - Return quantities don't exceed available quantities
   - All parts exist in original DPO
3. System generates unique return number (DPOR-YYYY-###)
4. Return status set to `pending`

### Return Approval Flow
1. User approves pending return
2. System creates:
   - **Stock Movements (OUT)**: Reduces inventory
   - **Accounting Voucher (JV)**: Reverses original DPO entry
     - DR Supplier Payable (decreases liability)
     - CR Inventory (decreases asset)
   - **Account Balance Updates**: Updates both accounts
3. Status changes to `completed`

### Accounting Impact
```
Original DPO (Purchase):
DR Inventory          1000
  CR Supplier Payable      1000

Return (Reversal):
DR Supplier Payable   1000
  CR Inventory              1000
```

## Installation Steps

### 1. Apply Database Migration
```bash
cd /var/www/Dev-Koncepts/backend
sqlite3 prisma/inventory.db < prisma/migrations/add_dpo_returns.sql
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Update Server (Already Done)
The route is registered in `src/server.ts`:
```typescript
import dpoReturnsRoutes from './routes/dpo-returns';
app.use('/api/dpo-returns', dpoReturnsRoutes);
```

### 4. Rebuild and Restart
```bash
npm run build
pm2 restart backend-dev-koncepts
```

## Testing

### Quick Test
```bash
# 1. Check endpoint is available
curl http://localhost:3002/api/dpo-returns

# 2. Get a completed DPO
curl "http://localhost:3002/api/inventory/direct-purchase-orders?status=Completed&limit=1"

# 3. Create a return (replace IDs with actual values)
curl -X POST http://localhost:3002/api/dpo-returns \
  -H "Content-Type: application/json" \
  -d '{
    "dpo_id": "your-dpo-id",
    "return_date": "2026-01-13",
    "reason": "Test return",
    "items": [
      {
        "part_id": "your-part-id",
        "return_quantity": 1
      }
    ]
  }'

# 4. Approve the return (replace with actual return ID)
curl -X POST http://localhost:3002/api/dpo-returns/return-id/approve
```

## Validation Rules

1. **Return Quantity**: Cannot exceed (purchased - already returned)
2. **DPO Status**: Must be "Completed"
3. **Part Validation**: All parts must exist in original DPO
4. **Status Transitions**: Only pending → approved/rejected
5. **Deletion**: Only pending returns can be deleted

## Business Rules

1. **Stock Impact**: Returns reduce inventory (OUT movement)
2. **Accounting**: Creates reverse JV of original DPO
3. **Supplier Balance**: Reduces supplier payable
4. **Audit Trail**: Approved/completed returns cannot be deleted
5. **Multiple Returns**: Can create multiple returns for same DPO (up to purchased quantity)

## Integration Points

### With Inventory System
- Creates stock movements with `referenceType: 'dpo_return'`
- Links to original DPO via `referenceId`
- Updates part stock quantities

### With Accounting System
- Creates JV vouchers (type: 'journal')
- Updates account balances (Inventory, Supplier Payable)
- Maintains double-entry bookkeeping

### With Supplier Management
- Reduces supplier payable balance
- Tracks return history per supplier
- Affects supplier reconciliation

## Error Handling

### Common Errors
1. **DPO Not Found**: Verify DPO ID is correct
2. **Invalid Return Quantity**: Check available quantity
3. **Account Not Found**: Ensure Inventory (104) and Supplier (301) accounts exist
4. **Status Error**: Only pending returns can be approved/rejected/deleted

### Recovery
- Pending returns can be deleted and recreated
- Approved/completed returns cannot be modified
- Contact admin for corrections to completed returns

## Future Enhancements

1. **Refund Vouchers**: Auto-create refund vouchers (RV) when supplier issues refund
2. **Partial Returns**: Enhanced support for multiple partial returns
3. **Return Shipping**: Track and allocate return shipping costs
4. **Quality Inspection**: Add inspection workflow before approval
5. **Supplier Credit Notes**: Integration with supplier credit note system
6. **Analytics**: Dashboard for return rates, reasons, and trends
7. **Email Notifications**: Notify suppliers of returns
8. **Return Labels**: Generate return shipping labels

## Troubleshooting

### Issue: Tables not created
```bash
# Check if tables exist
sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Return%';"

# If not, apply migration
sqlite3 prisma/inventory.db < prisma/migrations/add_dpo_returns.sql
```

### Issue: TypeScript errors
```bash
# Regenerate Prisma client
npx prisma generate

# Rebuild
npm run build
```

### Issue: Endpoint not found
```bash
# Check server logs
pm2 logs backend-dev-koncepts

# Verify route is registered
grep -n "dpo-returns" src/server.ts
```

### Issue: Accounting voucher not created
- Check if Inventory account exists (subgroup 104)
- Check if Supplier account exists (subgroup 301)
- Review server logs for voucher creation errors

## API Response Examples

### Success Response
```json
{
  "id": "uuid",
  "returnNumber": "DPOR-2026-001",
  "status": "completed",
  "totalAmount": 1500.00,
  "items": [...]
}
```

### Error Response
```json
{
  "error": "Cannot return 15 units. Only 10 available for return."
}
```

## Database Schema

### DirectPurchaseOrderReturn
- `id`: UUID primary key
- `returnNumber`: Unique return number (DPOR-YYYY-###)
- `directPurchaseOrderId`: FK to DirectPurchaseOrder
- `returnDate`: Date of return
- `reason`: Return reason (optional)
- `status`: pending/approved/completed/rejected
- `totalAmount`: Total return amount
- `createdAt`, `updatedAt`: Timestamps

### DirectPurchaseOrderReturnItem
- `id`: UUID primary key
- `dpoReturnId`: FK to DirectPurchaseOrderReturn
- `partId`: FK to Part
- `returnQuantity`: Quantity being returned
- `originalPurchasePrice`: Price from original DPO
- `amount`: returnQuantity * originalPurchasePrice
- `createdAt`: Timestamp

## Related Files

- `backend/src/routes/dpo-returns.ts` - Main API routes
- `backend/prisma/schema.prisma` - Database schema
- `backend/prisma/migrations/add_dpo_returns.sql` - Migration file
- `docs/DPO_RETURN_SYSTEM.md` - System documentation
- `docs/DPO_RETURN_API_EXAMPLES.md` - API examples

## Support

For issues or questions:
1. Check server logs: `pm2 logs backend-dev-koncepts`
2. Review documentation in `docs/` folder
3. Check database state with SQL queries
4. Verify account setup (Inventory, Supplier Payable)

## Changelog

### Version 1.0.0 (2026-01-13)
- Initial implementation
- Basic CRUD operations
- Approval/rejection workflow
- Stock movement integration
- Accounting voucher creation
- Complete documentation
