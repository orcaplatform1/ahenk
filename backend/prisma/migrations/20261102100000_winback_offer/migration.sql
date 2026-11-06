-- Geri kazanım indirimi
ALTER TYPE "PaymentDiscountType" ADD VALUE IF NOT EXISTS 'WINBACK';

CREATE TABLE "WinbackOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heldSeenAt" TIMESTAMP(3),
    "shownAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WinbackOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WinbackOffer_userId_key" ON "WinbackOffer"("userId");
CREATE INDEX "WinbackOffer_expiresAt_idx" ON "WinbackOffer"("expiresAt");
ALTER TABLE "WinbackOffer" ADD CONSTRAINT "WinbackOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Başlangıç ayarları: 100 TL, İçerde + Kankamla (admin panelinden değişir)
INSERT INTO "AppConfig" ("key", "value", "updatedAt") VALUES
  ('WINBACK_AMOUNT_TL', '100', CURRENT_TIMESTAMP),
  ('WINBACK_PLANS', 'ICERDE,KANKAMLA', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
