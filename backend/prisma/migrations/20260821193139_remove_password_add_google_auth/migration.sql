ALTER TABLE "users" DROP COLUMN "passwordHash",
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "googleId" TEXT NOT NULL;

CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
