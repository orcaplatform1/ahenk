-- CreateEnum
CREATE TYPE "PaymentDiscountType" AS ENUM ('REFERRER', 'INVITEE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "discountType" "PaymentDiscountType";

