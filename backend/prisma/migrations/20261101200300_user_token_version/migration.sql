-- Varsayılanlı kolon: mevcut satırlar 0 alır, eski erişim token'ları 0 sayıldığı için kimse oturumdan düşmez
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
