-- CreateTable
CREATE TABLE "ParticipantLocation" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipantLocation_meetingId_userId_timestamp_idx" ON "ParticipantLocation"("meetingId", "userId", "timestamp");

-- CreateIndex
CREATE INDEX "ParticipantLocation_timestamp_idx" ON "ParticipantLocation"("timestamp");

-- AddForeignKey
ALTER TABLE "ParticipantLocation" ADD CONSTRAINT "ParticipantLocation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantLocation" ADD CONSTRAINT "ParticipantLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
