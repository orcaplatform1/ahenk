-- Mekân kayıt akışı ve mekân paneli
CREATE TYPE "VenueAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'DEACTIVATED');

ALTER TABLE "PartnershipApplication"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "locationUrl" TEXT,
  ADD COLUMN "alcoholStatus" "VenueType",
  ADD COLUMN "referenceCode" TEXT,
  ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Venue"
  ADD COLUMN "locationUrl" TEXT,
  ADD COLUMN "websiteOrSocial" TEXT,
  ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "capacity" INTEGER;

ALTER TABLE "Meeting" ADD COLUMN "venueId" TEXT;
CREATE INDEX "Meeting_venueId_scheduledAt_idx" ON "Meeting"("venueId", "scheduledAt");
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VenueWeeklyCapacity" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueWeeklyCapacity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueWeeklyCapacity_venueId_weekStart_key" ON "VenueWeeklyCapacity"("venueId", "weekStart");
ALTER TABLE "VenueWeeklyCapacity" ADD CONSTRAINT "VenueWeeklyCapacity_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VenueAccount" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "venueId" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" "VenueAccountStatus" NOT NULL DEFAULT 'PENDING',
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueAccount_applicationId_key" ON "VenueAccount"("applicationId");
CREATE UNIQUE INDEX "VenueAccount_venueId_key" ON "VenueAccount"("venueId");
CREATE UNIQUE INDEX "VenueAccount_email_key" ON "VenueAccount"("email");
CREATE INDEX "VenueAccount_phone_idx" ON "VenueAccount"("phone");
CREATE INDEX "VenueAccount_status_idx" ON "VenueAccount"("status");
ALTER TABLE "VenueAccount" ADD CONSTRAINT "VenueAccount_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueAccount" ADD CONSTRAINT "VenueAccount_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
