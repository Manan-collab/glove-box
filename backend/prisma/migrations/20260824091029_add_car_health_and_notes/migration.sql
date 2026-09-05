-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'PURCHASE';

-- AlterTable
ALTER TABLE "cars" ADD COLUMN     "insuranceExpiryDate" TIMESTAMP(3),
ADD COLUMN     "usageTag" TEXT;

-- CreateTable
CREATE TABLE "car_notes" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "car_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "car_notes_carId_createdAt_idx" ON "car_notes"("carId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "car_notes" ADD CONSTRAINT "car_notes_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
