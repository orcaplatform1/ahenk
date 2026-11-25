-- E-posta bildirimi yok: NotificationType enum'undan EMAIL kaldırıldı (kullanan kayıt yok)
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('PUSH', 'SMS', 'IN_APP', 'WHATSAPP');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType" USING ("type"::text::"NotificationType");
DROP TYPE "NotificationType_old";
