-- Add new fields to Contact model for data source tracking and enrichment
ALTER TABLE "Contact" ADD COLUMN "source" TEXT;
ALTER TABLE "Contact" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "domainData" JSONB DEFAULT '{}';
ALTER TABLE "Contact" ADD COLUMN "addressData" JSONB DEFAULT '{}';
ALTER TABLE "Contact" ADD COLUMN "phoneData" JSONB DEFAULT '{}';
ALTER TABLE "Contact" ADD COLUMN "locationData" JSONB DEFAULT '{}';
ALTER TABLE "Contact" ADD COLUMN "metadata" JSONB DEFAULT '{}';
ALTER TABLE "Contact" ADD COLUMN "enrichmentStatus" TEXT DEFAULT 'pending';
ALTER TABLE "Contact" ADD COLUMN "dataQualityScore" INTEGER DEFAULT 0;

-- Create indexes for new Contact fields
CREATE INDEX "Contact_source_idx" ON "Contact"("source");
CREATE INDEX "Contact_sourceId_idx" ON "Contact"("sourceId");
CREATE INDEX "Contact_enrichmentStatus_idx" ON "Contact"("enrichmentStatus");
CREATE INDEX "Contact_dataQualityScore_idx" ON "Contact"("dataQualityScore");

-- Enhance EmailList model to support dynamic lists
ALTER TABLE "EmailList" ADD COLUMN "isDynamic" BOOLEAN DEFAULT false;
ALTER TABLE "EmailList" ADD COLUMN "refreshFrequency" TEXT;
ALTER TABLE "EmailList" ADD COLUMN "lastRefreshed" TIMESTAMP;
ALTER TABLE "EmailList" ADD COLUMN "nextRefreshDue" TIMESTAMP;
ALTER TABLE "EmailList" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "EmailList" ADD COLUMN "sourceConfigId" TEXT;

-- Create indexes for dynamic list fields
CREATE INDEX "EmailList_isDynamic_idx" ON "EmailList"("isDynamic");
CREATE INDEX "EmailList_nextRefreshDue_idx" ON "EmailList"("nextRefreshDue");
CREATE INDEX "EmailList_sourceType_idx" ON "EmailList"("sourceType");
CREATE INDEX "EmailList_sourceConfigId_idx" ON "EmailList"("sourceConfigId");

-- Create ListBuilderJob model
CREATE TABLE "ListBuilderJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "listId" TEXT,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sourceParams" JSONB NOT NULL DEFAULT '{}',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalItems" INTEGER,
  "processedItems" INTEGER DEFAULT 0,
  "results" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListBuilderJob_pkey" PRIMARY KEY ("id")
);

-- Create relations for ListBuilderJob
ALTER TABLE "ListBuilderJob" ADD CONSTRAINT "ListBuilderJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListBuilderJob" ADD CONSTRAINT "ListBuilderJob_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "EmailList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for ListBuilderJob
CREATE INDEX "ListBuilderJob_userId_idx" ON "ListBuilderJob"("userId");
CREATE INDEX "ListBuilderJob_listId_idx" ON "ListBuilderJob"("listId");
CREATE INDEX "ListBuilderJob_jobType_idx" ON "ListBuilderJob"("jobType");
CREATE INDEX "ListBuilderJob_status_idx" ON "ListBuilderJob"("status");
CREATE INDEX "ListBuilderJob_createdAt_idx" ON "ListBuilderJob"("createdAt");

-- Create ListBuilderSourceConfig model
CREATE TABLE "ListBuilderSourceConfig" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "configType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mapArea" JSONB,
  "keywords" TEXT[],
  "weatherConfig" JSONB,
  "csvConfig" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListBuilderSourceConfig_pkey" PRIMARY KEY ("id")
);

-- Create relations for ListBuilderSourceConfig
ALTER TABLE "ListBuilderSourceConfig" ADD CONSTRAINT "ListBuilderSourceConfig_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListBuilderSourceConfig" ADD CONSTRAINT "ListBuilderSourceConfig_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "EmailList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for ListBuilderSourceConfig
CREATE INDEX "ListBuilderSourceConfig_userId_idx" ON "ListBuilderSourceConfig"("userId");
CREATE INDEX "ListBuilderSourceConfig_listId_idx" ON "ListBuilderSourceConfig"("listId");
CREATE INDEX "ListBuilderSourceConfig_configType_idx" ON "ListBuilderSourceConfig"("configType");

-- Add relation between EmailList and ListBuilderSourceConfig
ALTER TABLE "EmailList" ADD CONSTRAINT "EmailList_sourceConfigId_fkey"
  FOREIGN KEY ("sourceConfigId") REFERENCES "ListBuilderSourceConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
