-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'SERVICE', 'REPAIR', 'TYRES', 'BATTERY', 'MOD', 'INSURANCE', 'OTHER');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "odometerKm" INTEGER,
    "notes" TEXT,
    "workshopName" TEXT,
    "workPerformed" TEXT,
    "whatBroke" TEXT,
    "litres" DECIMAL(8,2),
    "fuelPricePerLitre" DECIMAL(8,2),
    "fuelStation" TEXT,
    "tyreBrand" TEXT,
    "tyreSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_carId_expenseDate_idx" ON "expenses"("carId", "expenseDate" DESC);

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

