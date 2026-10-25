-- Paket fiyatları SUPERADMIN tarafından yönetilir
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "listKurus" INTEGER;

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "netKurus" INTEGER NOT NULL,
    "webKurus" INTEGER NOT NULL,
    "mobileKurus" INTEGER NOT NULL,
    "webDiscountKurus" INTEGER NOT NULL,
    "mobileDiscountKurus" INTEGER NOT NULL,
    "iyzicoPlanRef" TEXT,
    "iyzicoDiscountPlanRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanPrice_plan_createdAt_idx" ON "PlanPrice"("plan", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanPrice" ADD CONSTRAINT "PlanPrice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- createdAt UTC yazılır (Prisma UTC tutar; veritabanı saat dilimi farklı olabilir)
-- Başlangıç fiyatları: mevcut 349 / 449 / 679 ₺ KDV dahil satış fiyatı (ham = fiyat ÷ 1,20)
INSERT INTO "PlanPrice" ("id","plan","netKurus","webKurus","mobileKurus","webDiscountKurus","mobileDiscountKurus","createdAt") VALUES ('initial-masada','MASADA',29083,34900,41100,31400,37000,(now() AT TIME ZONE 'UTC'));
INSERT INTO "PlanPrice" ("id","plan","netKurus","webKurus","mobileKurus","webDiscountKurus","mobileDiscountKurus","createdAt") VALUES ('initial-karsimda','KARSIMDA',37417,44900,52800,40400,47500,(now() AT TIME ZONE 'UTC'));
INSERT INTO "PlanPrice" ("id","plan","netKurus","webKurus","mobileKurus","webDiscountKurus","mobileDiscountKurus","createdAt") VALUES ('initial-icerde','ICERDE',56583,67900,79900,61100,71900,(now() AT TIME ZONE 'UTC'));
