-- Bölge bazlı belge filtresi: Türkiye bölgeleri dört tür; diğer bölgeler Pasaport, Oturma İzni, Ehliyet
ALTER TABLE "City" ALTER COLUMN "idTypes" SET DEFAULT ARRAY['ID_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'RESIDENCE_PERMIT']::"KycIdType"[];
UPDATE "City" SET "idTypes" = ARRAY['ID_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'RESIDENCE_PERMIT']::"KycIdType"[] WHERE "countryCode" = 'TR';
UPDATE "City" SET "idTypes" = ARRAY['PASSPORT', 'RESIDENCE_PERMIT', 'DRIVER_LICENSE']::"KycIdType"[] WHERE "countryCode" <> 'TR';
