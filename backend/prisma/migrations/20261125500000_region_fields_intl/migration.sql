-- Türkiye dışı şehirlerin bölge alanları (Türkiye varsayılanları yerine): saat dilimi, para birimi, telefon ülke kodu.
-- Değerler packages/shared/src/countryRegion.ts COUNTRY_REGION ile aynı. TR şehirleri değişmez.
UPDATE "City" SET "timezone" = 'Asia/Dubai', "currency" = 'AED', "phoneCountryCode" = '+971' WHERE "countryCode" = 'AE';
UPDATE "City" SET "timezone" = 'Asia/Bangkok', "currency" = 'THB', "phoneCountryCode" = '+66' WHERE "countryCode" = 'TH';
UPDATE "City" SET "timezone" = 'Asia/Hong_Kong', "currency" = 'HKD', "phoneCountryCode" = '+852' WHERE "countryCode" = 'HK';
UPDATE "City" SET "timezone" = 'Asia/Singapore', "currency" = 'SGD', "phoneCountryCode" = '+65' WHERE "countryCode" = 'SG';
UPDATE "City" SET "timezone" = 'Asia/Tokyo', "currency" = 'JPY', "phoneCountryCode" = '+81' WHERE "countryCode" = 'JP';
