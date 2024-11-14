-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "domain" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "domain" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "title" TEXT;
