-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('INSURANCE_EXPIRY');

-- CreateTable
CREATE TABLE "sent_reminders" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "stage" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sent_reminders_carId_kind_dueDate_stage_key" ON "sent_reminders"("carId", "kind", "dueDate", "stage");

-- AddForeignKey
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

