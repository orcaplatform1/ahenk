-- Mesafeli satış / ön bilgilendirme / biyometrik açık rıza onay kaydı (3 yıl) ve giriş IP kaydı (5651, 2 yıl)
CREATE TABLE "AgreementConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "platform" TEXT NOT NULL,
    "packageId" TEXT,
    CONSTRAINT "AgreementConsent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgreementConsent_userId_documentType_idx" ON "AgreementConsent"("userId", "documentType");
CREATE INDEX "AgreementConsent_acceptedAt_idx" ON "AgreementConsent"("acceptedAt");

CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "platform" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginLog_userId_idx" ON "LoginLog"("userId");
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");
