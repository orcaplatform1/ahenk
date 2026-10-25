-- Yeni enum değeri (KANKAMLA) ayrı migration'da kullanılabilir
-- Kankamla fiyatı: ham 480 TL (web 576, mobil 678, indirimli 518 / 610) — createdAt UTC (DB saat dilimi Europe/Berlin)
INSERT INTO "PlanPrice" ("id", "plan", "netKurus", "webKurus", "mobileKurus", "webDiscountKurus", "mobileDiscountKurus", "createdAt")
VALUES ('plan_price_kankamla_initial', 'KANKAMLA', 48000, 57600, 67800, 51800, 61000, (now() AT TIME ZONE 'UTC'));
