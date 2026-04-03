-- CreateEnum
CREATE TYPE "ExpertChatSender" AS ENUM ('USER', 'EXPERT');

-- CreateTable
CREATE TABLE "ExpertConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "ExpertChatSender" NOT NULL,
    "text" TEXT,
    "imageUri" TEXT,
    "audioUri" TEXT,
    "audioDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpertConversation_userId_expertId_key" ON "ExpertConversation"("userId", "expertId");

-- AddForeignKey
ALTER TABLE "ExpertConversation" ADD CONSTRAINT "ExpertConversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertConversation" ADD CONSTRAINT "ExpertConversation_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertConversation" ADD CONSTRAINT "ExpertConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertChatMessage" ADD CONSTRAINT "ExpertChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ExpertConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
