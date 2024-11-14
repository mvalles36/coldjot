-- CreateTable
CREATE TABLE "PlaceholderFallback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceholderFallback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceholderFallback_userId_name_key" ON "PlaceholderFallback"("userId", "name");

-- AddForeignKey
ALTER TABLE "PlaceholderFallback" ADD CONSTRAINT "PlaceholderFallback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
