-- AlterTable: add status and voucherId to Adjustment (schema already had these; DB was missing them)
ALTER TABLE "Adjustment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Adjustment" ADD COLUMN "voucherId" TEXT;
