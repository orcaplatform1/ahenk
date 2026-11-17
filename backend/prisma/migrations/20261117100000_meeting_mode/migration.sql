-- Yarın Buluşma: buluşma türü (PLANNED / TOMORROW) masaya ve katılım kaydına eklenir
CREATE TYPE "MeetingMode" AS ENUM ('PLANNED', 'TOMORROW');

-- Mevcut masalar ve kayıtlar Planlı (DEFAULT ile PLANNED atanır)
ALTER TABLE "Meeting" ADD COLUMN "mode" "MeetingMode" NOT NULL DEFAULT 'PLANNED';
CREATE INDEX "Meeting_mode_scheduledAt_idx" ON "Meeting"("mode", "scheduledAt");

ALTER TABLE "WeeklySelection" ADD COLUMN "mode" "MeetingMode" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN "meetingDate" TIMESTAMP(3),
ADD COLUMN "transferredAt" TIMESTAMP(3);

-- Aynı hafta aynı türde birden fazla kayıt olabilir (Yarın kayıtları her gün); tekillik kodda (tür başına tek açık kayıt)
DROP INDEX "WeeklySelection_userId_year_weekNumber_type_key";
CREATE INDEX "WeeklySelection_userId_type_idx" ON "WeeklySelection"("userId", "type");
CREATE INDEX "WeeklySelection_mode_meetingDate_type_idx" ON "WeeklySelection"("mode", "meetingDate", "type");
