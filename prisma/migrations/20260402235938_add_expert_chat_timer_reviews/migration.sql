-- AlterTable
ALTER TABLE "ExpertSession" ADD COLUMN     "purchasedMinutes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "reviewComment" TEXT,
ADD COLUMN     "reviewRating" INTEGER,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
