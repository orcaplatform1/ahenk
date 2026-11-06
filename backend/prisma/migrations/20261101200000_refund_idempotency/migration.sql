-- Yeni enum değerleri ve boş başlayan kolon: mevcut satırlara dokunulmaz
ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "AdminAlertType" ADD VALUE IF NOT EXISTS 'PAYMENT_ISSUE';

ALTER TABLE "RefundRequest" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "RefundRequest_idempotencyKey_key" ON "RefundRequest"("idempotencyKey");
