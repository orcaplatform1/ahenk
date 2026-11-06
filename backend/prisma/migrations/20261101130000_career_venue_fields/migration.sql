-- Mekân türü tanımı, not yazan admin, gerçek son güncelleme
ALTER TABLE "PartnershipApplication"
  ADD COLUMN "venueTypeOther" TEXT,
  ADD COLUMN "adminNoteById" TEXT,
  ADD COLUMN "adminNoteByName" TEXT,
  ADD COLUMN "lastEditedAt" TIMESTAMP(3),
  ADD COLUMN "lastEditedByName" TEXT;

ALTER TABLE "Venue" ADD COLUMN "venueKind" TEXT;

-- Kariyer başvurusu yeni alanları
ALTER TABLE "CareerApplication"
  ADD COLUMN "education" TEXT,
  ADD COLUMN "languages" JSONB,
  ADD COLUMN "workType" TEXT,
  ADD COLUMN "salaryExpectation" TEXT,
  ADD COLUMN "birthDate" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "hearFromOther" TEXT,
  ADD COLUMN "cvFile" TEXT,
  ADD COLUMN "cvOriginalName" TEXT;

-- Elle eklenmiş kayıtlarda createdAt sunucu yerel saatiyle yazılmıştı (updatedAt'ten sonra görünüyordu): UTC'ye çevrilir
UPDATE "PartnershipApplication"
SET "createdAt" = "createdAt" AT TIME ZONE 'Europe/Berlin' AT TIME ZONE 'UTC'
WHERE "createdAt" > "updatedAt";
UPDATE "CareerApplication"
SET "createdAt" = "createdAt" AT TIME ZONE 'Europe/Berlin' AT TIME ZONE 'UTC'
WHERE "createdAt" > "updatedAt";
