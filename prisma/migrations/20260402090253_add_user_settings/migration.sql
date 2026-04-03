-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "timeOfBirth" TEXT,
    "placeOfBirth" TEXT,
    "gender" TEXT,
    "relationshipStatus" TEXT,
    "birthDetailsVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "responseTone" TEXT NOT NULL DEFAULT 'Balanced',
    "responseDepth" TEXT NOT NULL DEFAULT 'Deep Dive',
    "astrologyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "psychologyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "legalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "focusAreas" TEXT[],
    "beliefSystem" TEXT NOT NULL DEFAULT 'Astrology + Psychology',
    "guidanceType" TEXT NOT NULL DEFAULT 'Advisory',
    "notifyDailyInsight" BOOLEAN NOT NULL DEFAULT true,
    "notifyWeeklyReport" BOOLEAN NOT NULL DEFAULT true,
    "notifyAlerts" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmailUpdates" BOOLEAN NOT NULL DEFAULT false,
    "notifySmartNudges" BOOLEAN NOT NULL DEFAULT true,
    "allowAiLearning" BOOLEAN NOT NULL DEFAULT true,
    "anonymousMode" BOOLEAN NOT NULL DEFAULT false,
    "storeChatHistory" BOOLEAN NOT NULL DEFAULT true,
    "autoDeleteAfter90Days" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "biometricLock" BOOLEAN NOT NULL DEFAULT true,
    "currentPlanLabel" TEXT NOT NULL DEFAULT 'Free Beta',
    "creditsRemaining" INTEGER NOT NULL DEFAULT 42,
    "usageChatsPercent" INTEGER NOT NULL DEFAULT 60,
    "usageCallsPercent" INTEGER NOT NULL DEFAULT 30,
    "usageConsultsPercent" INTEGER NOT NULL DEFAULT 10,
    "walletBalance" INTEGER NOT NULL DEFAULT 1250,
    "autoRecharge" BOOLEAN NOT NULL DEFAULT true,
    "autoRechargeThreshold" INTEGER NOT NULL DEFAULT 200,
    "autoRechargeAmount" INTEGER NOT NULL DEFAULT 500,
    "paymentMethod" TEXT NOT NULL DEFAULT 'UPI',
    "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT true,
    "appleHealthConnected" BOOLEAN NOT NULL DEFAULT false,
    "notesConnected" BOOLEAN NOT NULL DEFAULT true,
    "themeChoice" TEXT NOT NULL DEFAULT 'dark',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
