-- Giriş kaydı hesap türü (USER / VENUE / ADMIN); mekân girişlerinde "venue:<id>" öneki kaldırılır, kimlik venueAccountId'ye taşınır
CREATE TYPE "LoginAccountType" AS ENUM ('USER', 'VENUE', 'ADMIN');

ALTER TABLE "LoginLog" ADD COLUMN "accountType" "LoginAccountType",
ADD COLUMN "venueAccountId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

UPDATE "LoginLog" SET "accountType" = 'VENUE', "venueAccountId" = substring("userId" from 7), "userId" = NULL
WHERE "userId" LIKE 'venue:%';

UPDATE "LoginLog" l SET "accountType" = CASE WHEN u."role" IN ('ADMIN', 'SUPERADMIN') THEN 'ADMIN'::"LoginAccountType" ELSE 'USER'::"LoginAccountType" END
FROM "User" u WHERE l."accountType" IS NULL AND u."id" = l."userId";

UPDATE "LoginLog" SET "accountType" = 'USER' WHERE "accountType" IS NULL;

ALTER TABLE "LoginLog" ALTER COLUMN "accountType" SET NOT NULL;
