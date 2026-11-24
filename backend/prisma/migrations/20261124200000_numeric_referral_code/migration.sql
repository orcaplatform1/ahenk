-- Kişisel davet kodu yalnız rakamdan oluşan tam sayı: eski 8 karakterlik kodlar kaldırılır.
-- Numaralar 1'den başlar; mevcut (bot olmayan) kullanıcılara kayıt tarihine göre (eşitlikte id) eskiden yeniye verilir.
-- Yeni kullanıcılar uygulamada nextval('"User_referralCode_seq"') ile sıradaki numarayı alır; dizi geri sarılmaz, silinen hesabın
-- numarası tekrar verilmez. Botlara numara verilmez.
UPDATE "User" SET "referralCode" = NULL;
ALTER TABLE "User" ALTER COLUMN "referralCode" TYPE INTEGER USING NULL;

CREATE SEQUENCE "User_referralCode_seq" AS INTEGER START WITH 1 INCREMENT BY 1 NO CYCLE;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY "createdAt" ASC, id ASC) AS n
  FROM "User"
  WHERE "isBot" = false
)
UPDATE "User" u SET "referralCode" = ordered.n FROM ordered WHERE u.id = ordered.id;

SELECT setval('"User_referralCode_seq"', COALESCE((SELECT MAX("referralCode") FROM "User"), 0) + 1, false);
