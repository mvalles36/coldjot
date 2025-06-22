import { auth } from "@/auth";
import { prisma } from "@coldjot/database";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET handler for /api/sequences/[id]/steps/[stepId]
 * Retrieves a specific sequence step
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id, stepId } = params;

    // Check if the user has access to this sequence
    const sequence = await prisma.sequence.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!sequence) {
      return new NextResponse("Sequence not found", { status: 404 });
    }

    // Get the step
    const step = await prisma.sequenceStep.findUnique({
      where: {
        id: stepId,
        sequenceId: id,
      },
    });

    if (!step) {
      return new NextResponse("Step not found", { status: 404 });
    }

    // If it's a call step, also fetch the call assistant configuration
    if (step.stepType === "call" || step.stepType === "CALL") {
      const callAssistant = await prisma.callAssistant.findFirst({
        where: {
          sequenceId: id,
          userId: session.user.id,
        },
      });

      if (callAssistant) {
        // Merge call assistant config with step data
        return NextResponse.json({
          ...step,
          assistantConfig: {
            vapiAssistantId: callAssistant.vapiAssistantId,
            voiceId: callAssistant.voiceId,
            systemPrompt: callAssistant.systemPrompt,
            leaveVoicemail: callAssistant.leaveVoicemail,
            voicemailText: callAssistant.voicemailText,
            phoneNumberId: callAssistant.phoneNumberId,
          },
        });
      }
    }

    return NextResponse.json(step);
  } catch (error) {
    console.error("[SEQUENCE_STEP_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * PUT handler for /api/sequences/[id]/steps/[stepId]
 * Updates a sequence step, handling both email and call types
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id, stepId } = params;
    const json = await req.json();

    // Check if the user has access to this sequence
    const sequence = await prisma.sequence.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!sequence) {
      return new NextResponse("Sequence not found", { status: 404 });
    }

    // Get the step to determine its type
    const existingStep = await prisma.sequenceStep.findUnique({
      where: {
        id: stepId,
        sequenceId: id,
      },
    });

    if (!existingStep) {
      return new NextResponse("Step not found", { status: 404 });
    }

    // Determine if this is a call step
    const isCallStep = 
      existingStep.stepType === "call" || 
      existingStep.stepType === "CALL";

    // Extract common step data
    const {
      timing,
      priority,
      delayAmount,
      delayUnit,
      note,
      order,
      previousStepId,
      assistantConfig,
      ...otherData
    } = json;

    // Prepare update data based on step type
    const stepUpdateData: any = {
      timing,
      priority,
      delayAmount,
      delayUnit,
      note,
      order,
      previousStepId,
    };

    // For email steps, include email-specific fields
    if (!isCallStep) {
      const { subject, content, includeSignature, replyToThread, templateId } = otherData;
      Object.assign(stepUpdateData, {
        subject,
        content,
        includeSignature,
        replyToThread,
        templateId,
      });
    }

    // Update the step
    const updatedStep = await prisma.sequenceStep.update({
      where: {
        id: stepId,
      },
      data: stepUpdateData,
    });

    // If it's a call step and we have assistant config, update that too
    if (isCallStep && assistantConfig) {
      await prisma.callAssistant.upsert({
        where: {
          sequenceId_userId: {
            sequenceId: id,
            userId: session.user.id,
          },
        },
        update: assistantConfig,
        create: {
          sequenceId: id,
          userId: session.user.id,
          ...assistantConfig,
        },
      });

      // Return the updated step with assistant config
      return NextResponse.json({
        ...updatedStep,
        assistantConfig,
      });
    }

    return NextResponse.json(updatedStep);
  } catch (error) {
    console.error("[SEQUENCE_STEP_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * DELETE handler for /api/sequences/[id]/steps/[stepId]
 * Deletes a sequence step
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id, stepId } = params;

    // Check if the user has access to this sequence
    const sequence = await prisma.sequence.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!sequence) {
      return new NextResponse("Sequence not found", { status: 404 });
    }

    // Delete the step
    await prisma.sequenceStep.delete({
      where: {
        id: stepId,
        sequenceId: id,
      },
    });

    // Get remaining steps to reorder them
    const remainingSteps = await prisma.sequenceStep.findMany({
      where: {
        sequenceId: id,
      },
      orderBy: {
        order: "asc",
      },
    });

    // Reorder remaining steps
    if (remainingSteps.length > 0) {
      await Promise.all(
        remainingSteps.map((step, index) =>
          prisma.sequenceStep.update({
            where: {
              id: step.id,
            },
            data: {
              order: index,
              previousStepId: index > 0 ? remainingSteps[index - 1].id : null,
            },
          })
        )
      );
    }

    // Update sequence metadata if no steps remain
    if (remainingSteps.length === 0) {
      await prisma.sequence.update({
        where: {
          id,
        },
        data: {
          metadata: {
            readiness: {
              hasSteps: false,
            },
          },
        },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[SEQUENCE_STEP_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
