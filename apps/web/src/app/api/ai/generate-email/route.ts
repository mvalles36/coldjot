import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coldjot/database";
import { generateEmailContent } from "@/lib/ai/mistral";
import { getCampaignContext, getCurrentStepNumber } from "@/lib/ai/campaign-context";

export async function POST(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { campaignId, stepId, mode, userPrompt, tone } = body;

    // Validate required parameters
    if (!campaignId || !stepId) {
      return new NextResponse("Missing required parameters", { status: 400 });
    }

    if (mode !== "single" && mode !== "sequence") {
      return new NextResponse("Invalid mode parameter", { status: 400 });
    }

    // Verify the user has access to this sequence
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: campaignId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!sequence) {
      return new NextResponse("Sequence not found or access denied", { status: 404 });
    }

    // Verify the step exists and belongs to the sequence
    const step = await prisma.sequenceStep.findUnique({
      where: {
        id: stepId,
        sequenceId: campaignId,
      },
      select: { id: true },
    });

    if (!step) {
      return new NextResponse("Step not found", { status: 404 });
    }

    // Get campaign context for AI generation
    const campaignContext = await getCampaignContext(stepId);
    const currentStepNumber = await getCurrentStepNumber(stepId);

    // Generate email content using Mistral
    const generatedContent = await generateEmailContent(
      campaignContext,
      {
        mode,
        userPrompt,
        tone,
        currentStepNumber,
      }
    );

    if (!generatedContent) {
      return new NextResponse("Failed to generate content", { status: 500 });
    }

    // Store the generated content in the database for analytics (optional)
    const aiEmailDraft = await prisma.aiEmailDraft.create({
      data: {
        campaignId,
        stepId,
        content: Array.isArray(generatedContent) 
          ? generatedContent.join("\n\n---\n\n") 
          : generatedContent,
        tone: tone || null,
        mode,
      },
    });

    // Return the generated content
    return NextResponse.json({
      content: generatedContent,
      draftId: aiEmailDraft.id,
    });
  } catch (error) {
    console.error("[AI_GENERATE_EMAIL]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
