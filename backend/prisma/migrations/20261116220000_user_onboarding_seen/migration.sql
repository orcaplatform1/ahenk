-- Tanıtım akışı ("Nasıl Çalışır"): kullanıcı başına bir kez otomatik açılır
ALTER TABLE "User" ADD COLUMN "onboardingSeenAt" TIMESTAMP(3);

-- Tanıtım yalnız bundan sonraki kayıtlarda otomatik açılır: mevcut hesaplar görmüş sayılır
UPDATE "User" SET "onboardingSeenAt" = NOW();
