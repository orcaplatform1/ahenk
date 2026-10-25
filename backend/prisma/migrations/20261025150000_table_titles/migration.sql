-- Masa adları: "Hafta 44 Grup Buluşması" yerine "İstanbul Grup 44" (şehirdeki o türden kaçıncı masa, oluşturulma sırasına göre)
UPDATE "Meeting" m
SET "title" = c."name" || ' ' || CASE WHEN m."type" = 'GROUP' THEN 'Grup' ELSE 'Başbaşa' END || ' ' || r.n
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "cityId", "type" ORDER BY "createdAt", "id") AS n
  FROM "Meeting"
  WHERE "cityId" IS NOT NULL
) r
JOIN "City" c ON TRUE
WHERE m."id" = r."id" AND c."id" = m."cityId";
