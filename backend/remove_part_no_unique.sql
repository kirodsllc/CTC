-- Remove unique constraint from part_no in SQLite
-- SQLite requires recreating the table to remove unique constraints

BEGIN TRANSACTION;

-- Create new table without unique constraint on part_no
CREATE TABLE parts_new (
  id TEXT PRIMARY KEY,
  masterPartId TEXT,
  partNo TEXT NOT NULL,
  brandId TEXT,
  description TEXT,
  categoryId TEXT,
  subcategoryId TEXT,
  applicationId TEXT,
  hsCode TEXT,
  weight REAL,
  reorderLevel INTEGER NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'pcs',
  cost REAL,
  priceA REAL,
  priceB REAL,
  priceM REAL,
  smc TEXT,
  size TEXT,
  origin TEXT,
  imageP1 TEXT,
  imageP2 TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (masterPartId) REFERENCES master_parts(id) ON DELETE SET NULL,
  FOREIGN KEY (brandId) REFERENCES brands(id) ON DELETE SET NULL,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (subcategoryId) REFERENCES subcategories(id) ON DELETE SET NULL,
  FOREIGN KEY (applicationId) REFERENCES applications(id) ON DELETE SET NULL
);

-- Copy data from old table to new table
INSERT INTO parts_new SELECT * FROM parts;

-- Drop old table
DROP TABLE parts;

-- Rename new table to original name
ALTER TABLE parts_new RENAME TO parts;

-- Recreate indexes (excluding the unique index on partNo)
CREATE INDEX IF NOT EXISTS idx_parts_masterPartId ON parts(masterPartId);
CREATE INDEX IF NOT EXISTS idx_parts_brandId ON parts(brandId);
CREATE INDEX IF NOT EXISTS idx_parts_categoryId ON parts(categoryId);
CREATE INDEX IF NOT EXISTS idx_parts_subcategoryId ON parts(subcategoryId);
CREATE INDEX IF NOT EXISTS idx_parts_applicationId ON parts(applicationId);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);

COMMIT;

