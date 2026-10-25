-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneHash" TEXT;

-- CreateTable
CREATE TABLE "ContactBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactBlock_userId_idx" ON "ContactBlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactBlock_userId_hashedPhone_key" ON "ContactBlock"("userId", "hashedPhone");

-- AddForeignKey
ALTER TABLE "ContactBlock" ADD CONSTRAINT "ContactBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
