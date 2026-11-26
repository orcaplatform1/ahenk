-- Haiku sorgu kaydı: istek türü, sonuç ve hata türü (başarısız istekler de yazılır)
ALTER TABLE "SupportAiLog" ADD COLUMN "requestType" TEXT NOT NULL DEFAULT 'QUESTION';
ALTER TABLE "SupportAiLog" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SupportAiLog" ADD COLUMN "errorType" TEXT;
UPDATE "SupportAiLog" SET "requestType" = 'DRAFT' WHERE "question" = '[Taslak cevap]';
