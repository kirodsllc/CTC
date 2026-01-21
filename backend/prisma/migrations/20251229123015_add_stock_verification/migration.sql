-- CreateTable
CREATE TABLE "StockVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockVerificationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verificationId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "storeId" TEXT,
    "rackId" TEXT,
    "shelfId" TEXT,
    "systemQty" INTEGER NOT NULL,
    "physicalQty" INTEGER,
    "variance" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockVerificationItem_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "StockVerification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockVerificationItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockVerificationItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockVerificationItem_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockVerificationItem_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TransferItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "fromStoreId" TEXT,
    "fromRackId" TEXT,
    "fromShelfId" TEXT,
    "toStoreId" TEXT,
    "toRackId" TEXT,
    "toShelfId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferItem_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferItem_fromRackId_fkey" FOREIGN KEY ("fromRackId") REFERENCES "Rack" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferItem_fromShelfId_fkey" FOREIGN KEY ("fromShelfId") REFERENCES "Shelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferItem_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferItem_toRackId_fkey" FOREIGN KEY ("toRackId") REFERENCES "Rack" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferItem_toShelfId_fkey" FOREIGN KEY ("toShelfId") REFERENCES "Shelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TransferItem" ("createdAt", "fromRackId", "fromShelfId", "fromStoreId", "id", "partId", "quantity", "toRackId", "toShelfId", "toStoreId", "transferId") SELECT "createdAt", "fromRackId", "fromShelfId", "fromStoreId", "id", "partId", "quantity", "toRackId", "toShelfId", "toStoreId", "transferId" FROM "TransferItem";
DROP TABLE "TransferItem";
ALTER TABLE "new_TransferItem" RENAME TO "TransferItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
