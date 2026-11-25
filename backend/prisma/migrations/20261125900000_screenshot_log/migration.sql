-- Büyütülmüş profil fotoğrafı ekran görüntüsü kaydı + admin uyarı türü
ALTER TYPE "AdminAlertType" ADD VALUE 'SCREENSHOT_VIOLATION';

CREATE TABLE "ScreenshotLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminAction" TEXT,
    "adminActionAt" TIMESTAMP(3),
    "adminId" TEXT,
    CONSTRAINT "ScreenshotLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScreenshotLog_userId_idx" ON "ScreenshotLog"("userId");
CREATE INDEX "ScreenshotLog_createdAt_idx" ON "ScreenshotLog"("createdAt");
