// Set DATABASE_URL before importing Prisma
const path = require('path');
const dbPath = path.resolve(__dirname, 'prisma', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying PriceHistory migration...');
    
    const migrationSQL = `
      CREATE TABLE IF NOT EXISTS "PriceHistory" (
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

      CREATE INDEX IF NOT EXISTS "PriceHistory_partId_idx" ON "PriceHistory"("partId");
      CREATE INDEX IF NOT EXISTS "PriceHistory_createdAt_idx" ON "PriceHistory"("createdAt");
    `;

    await prisma.$executeRawUnsafe(migrationSQL);
    console.log('✅ PriceHistory table created successfully!');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  PriceHistory table already exists');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });

