-- Acil yardım talebi çözülünce: son konumun açık adresi ve zamanı saklanır (koordinat ve konum geçmişi silinir)
ALTER TABLE "SosReport" ADD COLUMN "lastAddress" TEXT;
ALTER TABLE "SosReport" ADD COLUMN "lastLocationAt" TIMESTAMP(3);
