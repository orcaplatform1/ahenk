-- Ticari e-posta onayı kullanılmıyor: ConsentType enum'undan MARKETING_EMAIL kaldırıldı (kullanan kayıt yok)
ALTER TYPE "ConsentType" RENAME TO "ConsentType_old";
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'MARKETING_SMS');
ALTER TABLE "ConsentLog" ALTER COLUMN "type" TYPE "ConsentType" USING ("type"::text::"ConsentType");
DROP TYPE "ConsentType_old";
