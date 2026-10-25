-- CreateTable
CREATE TABLE "MeetingReview" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingReview_meetingId_idx" ON "MeetingReview"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingReview_meetingId_reviewerId_key" ON "MeetingReview"("meetingId", "reviewerId");

-- AddForeignKey
ALTER TABLE "MeetingReview" ADD CONSTRAINT "MeetingReview_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingReview" ADD CONSTRAINT "MeetingReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
