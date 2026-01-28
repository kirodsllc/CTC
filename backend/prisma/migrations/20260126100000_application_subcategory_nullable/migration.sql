-- SQLite: make Application.subcategoryId nullable and drop unique (subcategoryId, name).
-- Application is recreated so subcategoryId can be NULL when linked by master part only.

-- Disable foreign key checks during table recreation
PRAGMA foreign_keys=OFF;

CREATE TABLE "Application_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subcategoryId" TEXT,
    "masterPartId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Application_new" ("id", "subcategoryId", "masterPartId", "name", "status", "createdAt", "updatedAt")
SELECT "id", "subcategoryId", "masterPartId", "name", "status", "createdAt", "updatedAt" FROM "Application";

DROP TABLE "Application";

ALTER TABLE "Application_new" RENAME TO "Application";

CREATE INDEX "Application_subcategoryId_idx" ON "Application"("subcategoryId");
CREATE INDEX "Application_masterPartId_idx" ON "Application"("masterPartId");
CREATE UNIQUE INDEX "Application_masterPartId_name_key" ON "Application"("masterPartId", "name");

PRAGMA foreign_keys=ON;
