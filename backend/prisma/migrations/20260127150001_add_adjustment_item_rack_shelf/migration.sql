-- AlterTable: add rackId and shelfId to AdjustmentItem (schema had these; DB was missing them)
ALTER TABLE "AdjustmentItem" ADD COLUMN "rackId" TEXT;
ALTER TABLE "AdjustmentItem" ADD COLUMN "shelfId" TEXT;
