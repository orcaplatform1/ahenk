-- CreateEnum
CREATE TYPE "ProblemReportPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ProblemReportPlatform" NOT NULL,
    "screen" TEXT NOT NULL,
    "appVersion" TEXT,
    "description" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemReport_createdAt_idx" ON "ProblemReport"("createdAt");

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
