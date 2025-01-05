/*
  Warnings:

  - You are about to drop the column `notificationId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueueAlert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueueError` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueueMetrics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_notificationId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "notificationId";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "QueueAlert";

-- DropTable
DROP TABLE "QueueError";

-- DropTable
DROP TABLE "QueueMetrics";
