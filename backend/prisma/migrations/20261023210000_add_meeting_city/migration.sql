-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "cityId" TEXT;

-- CreateIndex
CREATE INDEX "Meeting_cityId_idx" ON "Meeting"("cityId");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
