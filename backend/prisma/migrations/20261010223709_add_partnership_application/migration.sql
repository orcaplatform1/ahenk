-- CreateEnum
CREATE TYPE "PartnershipStatus" AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PartnershipApplication" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "venueType" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "websiteOrSocial" TEXT,
    "status" "PartnershipStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnershipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnershipApplication_status_idx" ON "PartnershipApplication"("status");

-- CreateIndex
CREATE INDEX "PartnershipApplication_createdAt_idx" ON "PartnershipApplication"("createdAt");
