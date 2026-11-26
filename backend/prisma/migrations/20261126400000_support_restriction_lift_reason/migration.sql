-- Canlı destek: kısıtlama kaldırma sebebi (kaldırmada zorunlu, boşluklar hariç en az 5 karakter; eski kayıtlarda boş)
ALTER TABLE "SupportRestriction" ADD COLUMN "liftReason" TEXT;
