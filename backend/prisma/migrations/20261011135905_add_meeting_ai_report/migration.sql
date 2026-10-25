-- CreateTable
CREATE TABLE "MeetingAiReport" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "uyumSkoru" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAiReport_meetingId_key" ON "MeetingAiReport"("meetingId");

-- AddForeignKey
ALTER TABLE "MeetingAiReport" ADD CONSTRAINT "MeetingAiReport_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
