-- AlterTable
ALTER TABLE "UserSanction" ADD COLUMN     "meetingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserSanction_userId_meetingId_key" ON "UserSanction"("userId", "meetingId");

-- AddForeignKey
ALTER TABLE "UserSanction" ADD CONSTRAINT "UserSanction_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
