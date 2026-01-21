-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT,
    "partNo" TEXT NOT NULL,
    "description" TEXT,
    "priceField" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "oldValue" REAL,
    "newValue" REAL,
    "updateValue" REAL,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PriceHistory_partId_idx" ON "PriceHistory"("partId");

-- CreateIndex
CREATE INDEX "PriceHistory_createdAt_idx" ON "PriceHistory"("createdAt");

