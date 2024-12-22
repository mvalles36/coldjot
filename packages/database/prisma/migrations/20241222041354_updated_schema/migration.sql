-- DropForeignKey
ALTER TABLE "EmailEvent" DROP CONSTRAINT "EmailEvent_trackingId_fkey";

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "EmailTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
