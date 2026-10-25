-- Acil yardım: talebi üstlenen admin ve çözen admin
-- AlterTable
ALTER TABLE "SosReport" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedById" TEXT,
ADD COLUMN     "resolvedById" TEXT;

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

