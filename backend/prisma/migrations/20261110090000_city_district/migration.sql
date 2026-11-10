-- CreateTable
CREATE TABLE "CityDistrict" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityDistrict_cityId_name_key" ON "CityDistrict"("cityId", "name");

-- CreateIndex
CREATE INDEX "CityDistrict_cityId_level_idx" ON "CityDistrict"("cityId", "level");

-- AddForeignKey
ALTER TABLE "CityDistrict" ADD CONSTRAINT "CityDistrict_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Taramada görünen mevcut sabit ilçe listeleri (İstanbul, Ankara, İzmir, Antalya); eklenme sırası listedeki sırayı korur
INSERT INTO "CityDistrict" ("id", "cityId", "name", "level", "createdAt")
SELECT md5(random()::text || v.ord::text), c."id", v.name, v.level, CURRENT_TIMESTAMP + (v.ord * interval '1 millisecond')
FROM (VALUES
  ('İstanbul', 'Beşiktaş', 1, 0),
  ('İstanbul', 'Şişli', 1, 1),
  ('İstanbul', 'Kadıköy', 1, 2),
  ('İstanbul', 'Üsküdar', 1, 3),
  ('İstanbul', 'Bakırköy', 2, 4),
  ('İstanbul', 'Sarıyer', 2, 5),
  ('İstanbul', 'Ataşehir', 2, 6),
  ('İstanbul', 'Maltepe', 2, 7),
  ('İstanbul', 'Ümraniye', 2, 8),
  ('İstanbul', 'Başakşehir', 3, 9),
  ('İstanbul', 'Kartal', 3, 10),
  ('İstanbul', 'Beylikdüzü', 4, 11),
  ('İstanbul', 'Avcılar', 4, 12),
  ('İstanbul', 'Pendik', 4, 13),
  ('İstanbul', 'Beykoz', 4, 14),
  ('Ankara', 'Çankaya', 1, 15),
  ('Ankara', 'Yenimahalle', 1, 16),
  ('Ankara', 'Etimesgut', 2, 17),
  ('Ankara', 'Gölbaşı', 2, 18),
  ('Ankara', 'Altındağ', 3, 19),
  ('Ankara', 'Keçiören', 3, 20),
  ('Ankara', 'Mamak', 4, 21),
  ('Ankara', 'Polatlı', 4, 22),
  ('İzmir', 'Karşıyaka', 1, 23),
  ('İzmir', 'Buca', 1, 24),
  ('İzmir', 'Bornova', 1, 25),
  ('İzmir', 'Konak', 2, 26),
  ('İzmir', 'Gaziemir', 2, 27),
  ('İzmir', 'Bayraklı', 3, 28),
  ('İzmir', 'Karabağlar', 3, 29),
  ('İzmir', 'Çiğli', 3, 30),
  ('İzmir', 'Güzelbahçe', 4, 31),
  ('İzmir', 'Urla', 4, 32),
  ('İzmir', 'Çeşme', 4, 33),
  ('Antalya', 'Muratpaşa', 1, 34),
  ('Antalya', 'Konyaaltı', 1, 35),
  ('Antalya', 'Kepez', 1, 36),
  ('Antalya', 'Döşemealtı', 2, 37),
  ('Antalya', 'Aksu', 2, 38),
  ('Antalya', 'Serik', 3, 39),
  ('Antalya', 'Kemer', 3, 40),
  ('Antalya', 'Manavgat', 4, 41),
  ('Antalya', 'Alanya', 4, 42)
) AS v(city, name, level, ord)
JOIN "City" c ON c."name" = v.city;
