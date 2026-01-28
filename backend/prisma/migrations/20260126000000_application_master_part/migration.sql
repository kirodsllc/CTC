-- AlterTable
ALTER TABLE "Application" ADD COLUMN "masterPartId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Application_masterPartId_name_key" ON "Application"("masterPartId", "name");

-- CreateIndex
CREATE INDEX "Application_masterPartId_idx" ON "Application"("masterPartId");

-- AddForeignKey (SQLite requires table recreate for FK; optional - Prisma often adds via migration)
-- For SQLite, we add the column only; FK can be enforced by app logic or a future migration.
