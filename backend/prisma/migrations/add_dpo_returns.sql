-- Migration: Add Direct Purchase Order Returns
-- This migration adds support for returning items from Direct Purchase Orders

-- Create DPO Return table
CREATE TABLE IF NOT EXISTS "DirectPurchaseOrderReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnNumber" TEXT NOT NULL UNIQUE,
    "directPurchaseOrderId" TEXT NOT NULL,
    "returnDate" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("directPurchaseOrderId") REFERENCES "DirectPurchaseOrder"("id") ON DELETE CASCADE
);

-- Create DPO Return Items table
CREATE TABLE IF NOT EXISTS "DirectPurchaseOrderReturnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dpoReturnId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "returnQuantity" INT NOT NULL,
    "originalPurchasePrice" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("dpoReturnId") REFERENCES "DirectPurchaseOrderReturn"("id") ON DELETE CASCADE,
    FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_dpo_return_dpo_id" ON "DirectPurchaseOrderReturn"("directPurchaseOrderId");
CREATE INDEX IF NOT EXISTS "idx_dpo_return_status" ON "DirectPurchaseOrderReturn"("status");
CREATE INDEX IF NOT EXISTS "idx_dpo_return_item_dpo_return_id" ON "DirectPurchaseOrderReturnItem"("dpoReturnId");
CREATE INDEX IF NOT EXISTS "idx_dpo_return_item_part_id" ON "DirectPurchaseOrderReturnItem"("partId");
