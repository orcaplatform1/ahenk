-- Acil durum kişisi en fazla 2: mevcut tek kişi (emergencyContactName/Phone) 1. kişi olarak korunur
ALTER TABLE "User" ADD COLUMN "emergencyContact2Name" TEXT,
ADD COLUMN "emergencyContact2Phone" TEXT;
