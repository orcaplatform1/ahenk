-- Mobil mekân oturumu (cihaz başına çıkış)
CREATE TABLE "VenueSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenueSession_accountId_idx" ON "VenueSession"("accountId");

ALTER TABLE "VenueSession" ADD CONSTRAINT "VenueSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "VenueAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
