-- Engellenen numaralar (ContactBlock.hashedPhone) E.164 saklanır. "+" ile başlamayan eski kayıtlar Türkiye (+90) varsayılarak
-- son 10 hanesiyle dönüştürülür. Dönüşüm sonucu aynı kullanıcıda zaten olan numara çıkarsa eski (E.164 olmayan) kayıt silinir.
-- 10 haneden kısa (dönüştürülemeyen) kayıtlar olduğu gibi kalır.
WITH n AS (
  SELECT id, "userId",
    CASE WHEN "hashedPhone" ~ '^\+[1-9][0-9]{6,14}$' THEN "hashedPhone"
         ELSE '+90' || right(regexp_replace("hashedPhone", '\D', '', 'g'), 10) END AS e164,
    ("hashedPhone" ~ '^\+[1-9][0-9]{6,14}$') AS ok
  FROM "ContactBlock"
  WHERE "hashedPhone" ~ '^\+[1-9][0-9]{6,14}$' OR length(regexp_replace("hashedPhone", '\D', '', 'g')) >= 10
), r AS (
  SELECT id, ok, row_number() OVER (PARTITION BY "userId", e164 ORDER BY ok DESC, id) AS rn FROM n
)
DELETE FROM "ContactBlock" WHERE id IN (SELECT id FROM r WHERE rn > 1 AND NOT ok);

UPDATE "ContactBlock"
SET "hashedPhone" = '+90' || right(regexp_replace("hashedPhone", '\D', '', 'g'), 10)
WHERE "hashedPhone" !~ '^\+[1-9][0-9]{6,14}$' AND length(regexp_replace("hashedPhone", '\D', '', 'g')) >= 10;
