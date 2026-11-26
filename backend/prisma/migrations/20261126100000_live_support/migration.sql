-- Canlı destek: Temsilci rolü (SUPPORT), destek sohbeti, mesaj, iç not, devir, değerlendirme, hazır yanıt, Haiku sorgu kaydı, kısıtlama

-- CreateEnum
CREATE TYPE "SupportChatStatus" AS ENUM ('OPEN', 'QUEUED', 'ACTIVE', 'CLOSED', 'TICKET');

-- CreateEnum
CREATE TYPE "SupportTopic" AS ENUM ('ACCOUNT', 'PAYMENT', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportCloseReason" AS ENUM ('USER', 'AGENT', 'AUTO', 'ABUSE');

-- CreateEnum
CREATE TYPE "SupportAgentStatus" AS ENUM ('ONLINE', 'BREAK', 'OFFLINE');

-- CreateEnum
CREATE TYPE "SupportSender" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPPORT';

-- CreateTable
CREATE TABLE "SupportAgent" (
    "userId" TEXT NOT NULL,
    "agentNo" TEXT NOT NULL,
    "status" "SupportAgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAgent_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SupportChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "venueAccountId" TEXT,
    "requesterName" TEXT NOT NULL,
    "topic" "SupportTopic" NOT NULL,
    "status" "SupportChatStatus" NOT NULL DEFAULT 'QUEUED',
    "agentId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAssignedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "agentRepliedAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "lastAgentMessageAt" TIMESTAMP(3),
    "lastUserMessageAt" TIMESTAMP(3),
    "idleWarnedAt" TIMESTAMP(3),
    "queueAlertedAt" TIMESTAMP(3),
    "userReadAt" TIMESTAMP(3),
    "agentReadAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedBy" "SupportCloseReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "sender" "SupportSender" NOT NULL,
    "senderId" TEXT,
    "agentNo" TEXT,
    "content" TEXT NOT NULL,
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportNote" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "agentNo" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTransfer" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRating" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "helped" BOOLEAN NOT NULL,
    "stars" INTEGER NOT NULL,
    "tags" TEXT[],
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCannedReply" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCannedReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAiLog" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentNo" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "tools" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "venueAccountId" TEXT,
    "chatId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportAgent_agentNo_key" ON "SupportAgent"("agentNo");

-- CreateIndex
CREATE INDEX "SupportChat_status_queuedAt_idx" ON "SupportChat"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "SupportChat_agentId_status_idx" ON "SupportChat"("agentId", "status");

-- CreateIndex
CREATE INDEX "SupportChat_userId_idx" ON "SupportChat"("userId");

-- CreateIndex
CREATE INDEX "SupportChat_venueAccountId_idx" ON "SupportChat"("venueAccountId");

-- CreateIndex
CREATE INDEX "SupportChat_createdAt_idx" ON "SupportChat"("createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_chatId_createdAt_idx" ON "SupportMessage"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportNote_chatId_idx" ON "SupportNote"("chatId");

-- CreateIndex
CREATE INDEX "SupportTransfer_chatId_idx" ON "SupportTransfer"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRating_chatId_key" ON "SupportRating"("chatId");

-- CreateIndex
CREATE INDEX "SupportAiLog_createdAt_idx" ON "SupportAiLog"("createdAt");

-- CreateIndex
CREATE INDEX "SupportAiLog_chatId_idx" ON "SupportAiLog"("chatId");

-- CreateIndex
CREATE INDEX "SupportRestriction_userId_idx" ON "SupportRestriction"("userId");

-- CreateIndex
CREATE INDEX "SupportRestriction_venueAccountId_idx" ON "SupportRestriction"("venueAccountId");

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "SupportChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "SupportChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTransfer" ADD CONSTRAINT "SupportTransfer_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "SupportChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRating" ADD CONSTRAINT "SupportRating_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "SupportChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

