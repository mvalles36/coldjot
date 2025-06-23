import { prisma } from "@coldjot/database";
import { StepTypeEnum } from "@coldjot/types";
import { CampaignContext } from "./mistral";

/**
 * Retrieves and formats campaign context for AI email generation
 * 
 * @param stepId The ID of the current step being edited
 * @returns Structured campaign context with all previous steps
 */
export async function getCampaignContext(stepId: string): Promise<CampaignContext> {
  // Get the step and its associated sequence
  const step = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    include: {
      sequence: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!step) {
    throw new Error(`Step with ID ${stepId} not found`);
  }

  const sequenceId = step.sequenceId;
  
  // Get all steps in the sequence, ordered by their position
  const allSteps = await prisma.sequenceStep.findMany({
    where: {
      sequenceId,
    },
    orderBy: {
      order: "asc",
    },
    include: {
      // Include call assistant data for call steps
      callAssistant: {
        select: {
          systemPrompt: true,
        },
      },
    },
  });

  // Format steps for the AI context
  const formattedSteps = allSteps.map(step => {
    if (step.stepType === StepTypeEnum.MANUAL_EMAIL || 
        step.stepType === StepTypeEnum.AUTOMATED_EMAIL) {
      return {
        type: 'email' as const,
        content: step.content || "No content",
      };
    } else if (step.stepType === StepTypeEnum.CALL) {
      return {
        type: 'call' as const,
        content: step.note || step.callAssistant?.systemPrompt || "Phone call",
      };
    } else if (step.stepType === StepTypeEnum.WAIT) {
      // Convert delay to days for simplicity
      let waitDays = 1;
      if (step.delayUnit === "days") {
        waitDays = step.delayAmount || 1;
      } else if (step.delayUnit === "hours") {
        waitDays = (step.delayAmount || 24) / 24;
      }
      
      return {
        type: 'wait' as const,
        content: `Wait for ${step.delayAmount} ${step.delayUnit}`,
        waitDays,
      };
    }
    
    // Default fallback
    return {
      type: 'email' as const,
      content: "Step content unavailable",
    };
  });

  return {
    campaignName: step.sequence.name,
    steps: formattedSteps,
  };
}

/**
 * Gets the current step number in the sequence
 * 
 * @param stepId The ID of the current step
 * @returns The step number (0-indexed)
 */
export async function getCurrentStepNumber(stepId: string): Promise<number> {
  const step = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    select: { order: true },
  });
  
  return step ? step.order - 1 : 0; // Convert to 0-indexed
}

/**
 * Gets all empty steps after the current step
 * This is used for filling in a sequence with AI-generated content
 * 
 * @param stepId The ID of the current step
 * @param limit Maximum number of steps to return
 * @returns Array of step IDs that can be filled with content
 */
export async function getEmptyFollowUpSteps(
  stepId: string,
  limit: number = 3
): Promise<string[]> {
  const currentStep = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    select: { 
      sequenceId: true,
      order: true,
    },
  });
  
  if (!currentStep) {
    return [];
  }
  
  // Find email steps after the current one that have no content
  const emptySteps = await prisma.sequenceStep.findMany({
    where: {
      sequenceId: currentStep.sequenceId,
      order: { gt: currentStep.order },
      stepType: {
        in: [StepTypeEnum.MANUAL_EMAIL, StepTypeEnum.AUTOMATED_EMAIL],
      },
      content: {
        equals: null,
      },
    },
    orderBy: {
      order: "asc",
    },
    take: limit,
    select: {
      id: true,
    },
  });
  
  return emptySteps.map(step => step.id);
}
