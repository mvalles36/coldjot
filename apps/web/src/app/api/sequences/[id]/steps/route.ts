import { auth } from "@/auth";
import { prisma } from "@coldjot/database";
import { NextResponse } from "next/server";
import { updateSequenceReadinessField } from "@/lib/metadata-utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
      select: {
        id: true,
        metadata: true,
        steps: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    const json = await req.json();
    const {
      type,
      timing,
      priority,
      delayAmount,
      delayUnit,
      subject,
      content,
      includeSignature,
      note,
      replyToThread,
      previousStepId,
      assistantConfig,
    } = json;

    // normalise step type
    const stepType = (type as string)?.toLowerCase();

    /* ----------------------------------------------------------------
     * If the step is a CALL step we need to make sure an assistant
     * configuration exists (create or update) for this sequence.
     * The assistantConfig shape is expected to come from the UI:
     * {
     *   vapiAssistantId, voiceId, systemPrompt,
     *   leaveVoicemail, voicemailText?, phoneNumberId
     * }
     * ---------------------------------------------------------------- */
    let callAssistantRecord = null;
    if (stepType === "call") {
      if (!assistantConfig) {
        return new NextResponse(
          "assistantConfig missing for call step",
          { status: 400 }
        );
      }

      callAssistantRecord = await prisma.callAssistant.upsert({
        where: {
          sequenceId_userId: {
            sequenceId: sequence.id,
            userId: session.user.id,
          },
        },
        update: {
          ...assistantConfig,
        },
        create: {
          sequenceId: sequence.id,
          userId: session.user.id,
          ...assistantConfig,
        },
      });
    }

    // Prepare common step data
    const stepData: any = {
      sequenceId: sequence.id,
      stepType: stepType,
      timing,
      priority,
      delayAmount,
      delayUnit,
      note,
      order: sequence.steps.length + 1,
      previousStepId,
    };

    if (stepType === "call") {
      // For call steps we don't store email-related fields
      stepData.includeSignature = false;
      stepData.replyToThread = false;
    } else {
      // Email step – retain original behaviour
      Object.assign(stepData, {
        subject,
        content,
        includeSignature,
        replyToThread,
      });
    }

    const step = await prisma.sequenceStep.create({ data: stepData });

    // Update the sequence metadata only if this is the first step
    // or if the metadata doesn't already indicate that steps exist
    const metadataObj = (sequence.metadata as Record<string, any>) || {};
    const readiness = metadataObj.readiness || {};

    if (sequence.steps.length === 0 || !readiness.hasSteps) {
      await updateSequenceReadinessField(sequence.id, "hasSteps", true);
    }

    return NextResponse.json({
      step,
      callAssistant: callAssistantRecord,
    });
  } catch (error) {
    console.error("[SEQUENCE_STEPS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { id } = await params;
    const steps = await prisma.sequenceStep.findMany({
      where: {
        sequenceId: id,
        sequence: {
          userId: session.user.id,
        },
      },
      orderBy: {
        order: "asc",
      },
    });

    return NextResponse.json(steps);
  } catch (error) {
    console.error("[SEQUENCE_STEPS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
