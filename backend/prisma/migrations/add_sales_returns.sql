-- Sales Return System Migration
-- Created: 2026-01-13
-- Purpose: Add tables for handling sales invoice returns

-- Table: SalesReturn
-- Stores header information for each sales return
CREATE TABLE IF NOT EXISTS "SalesReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnNumber" TEXT NOT NULL UNIQUE,
    "salesInvoiceId" TEXT NOT NULL,
    "returnDate" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE
);

-- Table: SalesReturnItem
-- Stores line items for each sales return
CREATE TABLE IF NOT EXISTS "SalesReturnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesReturnId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "returnQuantity" INT NOT NULL,
    "originalSalePrice" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("salesReturnId") REFERENCES "SalesReturn"("id") ON DELETE CASCADE,
    FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_sales_return_invoice" ON "SalesReturn"("salesInvoiceId");
CREATE INDEX IF NOT EXISTS "idx_sales_return_status" ON "SalesReturn"("status");
CREATE INDEX IF NOT EXISTS "idx_sales_return_date" ON "SalesReturn"("returnDate");
CREATE INDEX IF NOT EXISTS "idx_sales_return_number" ON "SalesReturn"("returnNumber");

CREATE INDEX IF NOT EXISTS "idx_sales_return_item_return" ON "SalesReturnItem"("salesReturnId");
CREATE INDEX IF NOT EXISTS "idx_sales_return_item_part" ON "SalesReturnItem"("partId");

-- Comments
-- Status values: 'pending', 'approved', 'rejected', 'completed'
-- When approved, system will:
-- 1. Create stock movement IN (increases inventory)
-- 2. Create accounting vouchers:
--    - JV to reverse revenue: DR Sales Revenue, CR AR/Cash
--    - JV to reverse COGS: DR Inventory, CR COGS
-- 3. Update customer account balance (if credit sale)
-- 4. Update part average cost if needed
