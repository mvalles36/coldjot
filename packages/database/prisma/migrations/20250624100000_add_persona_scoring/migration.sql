-- Add persona scoring fields to Contact model
ALTER TABLE "Contact" ADD COLUMN "personaTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Contact" ADD COLUMN "conversionScore" INTEGER;
ALTER TABLE "Contact" ADD COLUMN "lastMistralPersonaScoreAt" TIMESTAMP(3);

-- Add indexes for efficient querying
CREATE INDEX "Contact_personaTags_idx" ON "Contact" USING GIN ("personaTags");
CREATE INDEX "Contact_conversionScore_idx" ON "Contact" ("conversionScore");
CREATE INDEX "Contact_lastMistralPersonaScoreAt_idx" ON "Contact" ("lastMistralPersonaScoreAt");

-- Add comment to explain purpose
COMMENT ON COLUMN "Contact"."personaTags" IS 'AI-generated tags describing the contact persona';
COMMENT ON COLUMN "Contact"."conversionScore" IS 'AI-calculated likelihood of conversion (0-100)';
COMMENT ON COLUMN "Contact"."lastMistralPersonaScoreAt" IS 'Timestamp of the last Mistral persona scoring run';
