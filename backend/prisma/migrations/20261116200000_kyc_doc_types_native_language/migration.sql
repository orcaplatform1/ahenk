-- KYC belge türleri: Kimlik Kartı, Ehliyet, Oturma İzni (Pasaport zaten var; TC / YKN eski kayıtlar için durur)
ALTER TYPE "KycIdType" ADD VALUE IF NOT EXISTS 'ID_CARD';
ALTER TYPE "KycIdType" ADD VALUE IF NOT EXISTS 'DRIVER_LICENSE';
ALTER TYPE "KycIdType" ADD VALUE IF NOT EXISTS 'RESIDENCE_PERMIT';

-- Ana dil: mevcut kullanıcılarda uygulamada şu an seçili dil (User.language)
ALTER TABLE "User" ADD COLUMN "nativeLanguage" TEXT NOT NULL DEFAULT 'tr';
UPDATE "User" SET "nativeLanguage" = CASE WHEN "language" = 'en' THEN 'en' ELSE 'tr' END;

-- Ana dilin konuşma alanı her zaman true
UPDATE "User" SET "speaksTurkish" = true WHERE "nativeLanguage" = 'tr' AND "speaksTurkish" = false;
UPDATE "User" SET "speaksEnglish" = true WHERE "nativeLanguage" = 'en' AND "speaksEnglish" = false;
