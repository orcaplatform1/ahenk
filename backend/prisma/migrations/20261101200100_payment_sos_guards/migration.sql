-- Yeni enum değeri ve boş başlayan kolon: mevcut satırlara dokunulmaz. Eski açık raporlarda openKey boş kalır
-- (NULL benzersizlik çakışması oluşturmaz), bu raporlar için uygulamadaki açık talep kontrolü geçerlidir.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'DUPLICATE';

ALTER TABLE "SosReport" ADD COLUMN "openKey" TEXT;
CREATE UNIQUE INDEX "SosReport_openKey_key" ON "SosReport"("openKey");
