-- CreateEnum
CREATE TYPE "KycIdType" AS ENUM ('TC', 'YKN', 'PASSPORT');

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'TR',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN     "defaultLanguage" TEXT NOT NULL DEFAULT 'tr',
ADD COLUMN     "idTypes" "KycIdType"[] DEFAULT ARRAY['TC', 'YKN', 'PASSPORT']::"KycIdType"[],
ADD COLUMN     "phoneCountryCode" TEXT NOT NULL DEFAULT '+90',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul';

-- AlterTable
ALTER TABLE "KycSubmission" ADD COLUMN     "idType" "KycIdType" NOT NULL DEFAULT 'TC',
ALTER COLUMN "idBackKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OceanQuestion" ADD COLUMN     "sectionTitleEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "textEn" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'tr',
ADD COLUMN     "speaksEnglish" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "speaksTurkish" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RegionWaitlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegionWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegionWaitlist_cityId_idx" ON "RegionWaitlist"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "RegionWaitlist_userId_cityId_key" ON "RegionWaitlist"("userId", "cityId");

-- AddForeignKey
ALTER TABLE "RegionWaitlist" ADD CONSTRAINT "RegionWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionWaitlist" ADD CONSTRAINT "RegionWaitlist_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Veri ──────────────────────────────────────────────────────────────
-- Türkiye bölgelerinin sırası (liste: İstanbul, Ankara, İzmir, Antalya); diğer şehirler sona
UPDATE "City" SET "sortOrder" = 1 WHERE "name" = 'İstanbul';
UPDATE "City" SET "sortOrder" = 2 WHERE "name" = 'Ankara';
UPDATE "City" SET "sortOrder" = 3 WHERE "name" = 'İzmir';
UPDATE "City" SET "sortOrder" = 4 WHERE "name" = 'Antalya';
UPDATE "City" SET "sortOrder" = 100 WHERE "name" NOT IN ('İstanbul', 'Ankara', 'İzmir', 'Antalya');

-- Dubai bölgeleri (pasif): AE, Asia/Dubai, USD, en, +971, yalnız pasaport
INSERT INTO "City" ("id", "name", "isActive", "countryCode", "timezone", "currency", "defaultLanguage", "phoneCountryCode", "idTypes", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('region_dubai_marina', 'Dubai Marina', false, 'AE', 'Asia/Dubai', 'USD', 'en', '+971', ARRAY['PASSPORT']::"KycIdType"[], 201, NOW(), NOW()),
  ('region_dubai_jlt', 'Jumeirah Lake Towers (JLT)', false, 'AE', 'Asia/Dubai', 'USD', 'en', '+971', ARRAY['PASSPORT']::"KycIdType"[], 202, NOW(), NOW()),
  ('region_dubai_downtown', 'Downtown Dubai', false, 'AE', 'Asia/Dubai', 'USD', 'en', '+971', ARRAY['PASSPORT']::"KycIdType"[], 203, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Telefonlar E.164: E.164 olmayan kayıtlar +90 varsayılarak dönüştürülür (5XXXXXXXXX, 05XXXXXXXXX, 905XXXXXXXXX)
UPDATE "User" SET "phone" = '+90' || regexp_replace("phone", '\D', '', 'g')
  WHERE "phone" IS NOT NULL AND "phone" !~ '^\+[1-9][0-9]{7,14}$' AND regexp_replace("phone", '\D', '', 'g') ~ '^5[0-9]{9}$';
UPDATE "User" SET "phone" = '+9' || regexp_replace("phone", '\D', '', 'g')
  WHERE "phone" IS NOT NULL AND "phone" !~ '^\+[1-9][0-9]{7,14}$' AND regexp_replace("phone", '\D', '', 'g') ~ '^05[0-9]{9}$';
UPDATE "User" SET "phone" = '+' || regexp_replace("phone", '\D', '', 'g')
  WHERE "phone" IS NOT NULL AND "phone" !~ '^\+[1-9][0-9]{7,14}$' AND regexp_replace("phone", '\D', '', 'g') ~ '^905[0-9]{9}$';
UPDATE "ContactBlock" SET "hashedPhone" = '+90' || regexp_replace("hashedPhone", '\D', '', 'g')
  WHERE "hashedPhone" !~ '^\+[1-9][0-9]{7,14}$' AND regexp_replace("hashedPhone", '\D', '', 'g') ~ '^5[0-9]{9}$';

-- Kişilik testi İngilizce metinleri (soru kimlikleri, sıra ve puanlama aynı)
UPDATE "OceanQuestion" SET "sectionTitleEn" = 'Curiosity & Openness' WHERE "section" = 1;
UPDATE "OceanQuestion" SET "sectionTitleEn" = 'Order & Responsibility' WHERE "section" = 2;
UPDATE "OceanQuestion" SET "sectionTitleEn" = 'Sociability & Energy' WHERE "section" = 3;
UPDATE "OceanQuestion" SET "sectionTitleEn" = 'Empathy & Harmony' WHERE "section" = 4;
UPDATE "OceanQuestion" SET "sectionTitleEn" = 'Emotional Balance' WHERE "section" = 5;
UPDATE "OceanQuestion" SET "textEn" = 'I''m drawn to new ideas and different points of view.' WHERE "orderNum" = 1;
UPDATE "OceanQuestion" SET "textEn" = 'Art, music or literature moves me deeply.' WHERE "orderNum" = 2;
UPDATE "OceanQuestion" SET "textEn" = 'I trust my imagination and like thinking outside the box.' WHERE "orderNum" = 3;
UPDATE "OceanQuestion" SET "textEn" = 'I enjoy discussing abstract ideas and philosophical questions.' WHERE "orderNum" = 4;
UPDATE "OceanQuestion" SET "textEn" = 'I get things done on time and see them through.' WHERE "orderNum" = 5;
UPDATE "OceanQuestion" SET "textEn" = 'I stick to my plans and routines.' WHERE "orderNum" = 6;
UPDATE "OceanQuestion" SET "textEn" = 'I pay attention to detail and double-check my work.' WHERE "orderNum" = 7;
UPDATE "OceanQuestion" SET "textEn" = 'I can give up instant pleasures for long-term goals.' WHERE "orderNum" = 8;
UPDATE "OceanQuestion" SET "textEn" = 'Social settings lift my energy; I love spending time with people.' WHERE "orderNum" = 9;
UPDATE "OceanQuestion" SET "textEn" = 'I don''t mind speaking up or being the center of attention in a group.' WHERE "orderNum" = 10;
UPDATE "OceanQuestion" SET "textEn" = 'Meeting new people excites me.' WHERE "orderNum" = 11;
UPDATE "OceanQuestion" SET "textEn" = 'Quiet, calm settings make me restless.' WHERE "orderNum" = 12;
UPDATE "OceanQuestion" SET "textEn" = 'I put other people''s needs ahead of my own.' WHERE "orderNum" = 13;
UPDATE "OceanQuestion" SET "textEn" = 'I avoid conflict and prefer finding common ground.' WHERE "orderNum" = 14;
UPDATE "OceanQuestion" SET "textEn" = 'I can easily sense how others feel.' WHERE "orderNum" = 15;
UPDATE "OceanQuestion" SET "textEn" = 'Trusting people comes naturally to me.' WHERE "orderNum" = 16;
UPDATE "OceanQuestion" SET "textEn" = 'I can stay calm and keep my cool in stressful situations.' WHERE "orderNum" = 17;
UPDATE "OceanQuestion" SET "textEn" = 'Even small things can bother me for a long time.' WHERE "orderNum" = 18;
UPDATE "OceanQuestion" SET "textEn" = 'Feeling anxious or tense isn''t unusual for me.' WHERE "orderNum" = 19;
