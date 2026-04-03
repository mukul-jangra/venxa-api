-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "totalExperts" INTEGER NOT NULL,
    "cta" TEXT NOT NULL,
    "comingSoon" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyRef" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "searchAliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_code_key" ON "Agent"("code");
