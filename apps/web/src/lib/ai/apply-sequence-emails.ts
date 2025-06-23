import { prisma } from "@coldjot/database";
import { StepTypeEnum } from "@coldjot/types";
import { getEmptyFollowUpSteps } from "./campaign-context";

/**
 * Interface representing the result of applying sequence emails
 */
export interface ApplySequenceEmailsResult {
  /** Number of emails successfully applied */
  appliedCount: number;
  /** IDs of steps that were updated */
  updatedStepIds: string[];
  /** Any emails that couldn't be applied (e.g., not enough empty steps) */
  unusedEmails: string[];
}

/**
 * Applies an array of AI-generated emails to empty steps in a sequence
 * 
 * @param emailContents Array of email content strings to apply
 * @param currentStepId ID of the current step being edited
 * @param skipFirst Whether to skip applying to the first step (if it's being handled separately)
 * @returns Result object with information about applied emails
 */
export async function applySequenceEmails(
  emailContents: string[],
  currentStepId: string,
  skipFirst: boolean = false
): Promise<ApplySequenceEmailsResult> {
  try {
    // Skip the first email if requested (it might be handled separately in the UI)
    const emailsToApply = skipFirst ? emailContents.slice(1) : emailContents;
    
    // If no emails to apply, return early
    if (!emailsToApply.length) {
      return {
        appliedCount: 0,
        updatedStepIds: [],
        unusedEmails: [],
      };
    }

    // Get empty steps after the current step
    const limit = emailsToApply.length;
    const emptyStepIds = await getEmptyFollowUpSteps(currentStepId, limit);
    
    // If no empty steps found, return all emails as unused
    if (!emptyStepIds.length) {
      return {
        appliedCount: 0,
        updatedStepIds: [],
        unusedEmails: emailsToApply,
      };
    }

    // Prepare updates for each step
    const updates = [];
    const updatedStepIds: string[] = [];
    let appliedCount = 0;

    // Apply emails to steps (limited by available empty steps)
    for (let i = 0; i < Math.min(emptyStepIds.length, emailsToApply.length); i++) {
      const stepId = emptyStepIds[i];
      const content = emailsToApply[i];
      
      updates.push(
        prisma.sequenceStep.update({
          where: { id: stepId },
          data: { content },
        })
      );
      
      updatedStepIds.push(stepId);
      appliedCount++;
    }

    // Execute all updates in parallel
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    // Determine if any emails weren't used
    const unusedEmails = emailsToApply.slice(appliedCount);

    return {
      appliedCount,
      updatedStepIds,
      unusedEmails,
    };
  } catch (error) {
    console.error("Error applying sequence emails:", error);
    throw new Error(`Failed to apply sequence emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Checks if a step has empty content
 * 
 * @param stepId ID of the step to check
 * @returns True if the step exists and has no content
 */
export async function isStepEmpty(stepId: string): Promise<boolean> {
  try {
    const step = await prisma.sequenceStep.findUnique({
      where: { id: stepId },
      select: { content: true, stepType: true },
    });
    
    if (!step) {
      return false;
    }
    
    // Only consider email steps
    if (step.stepType !== StepTypeEnum.MANUAL_EMAIL && 
        step.stepType !== StepTypeEnum.AUTOMATED_EMAIL) {
      return false;
    }
    
    return step.content === null || step.content === undefined || step.content.trim() === '';
  } catch (error) {
    console.error("Error checking if step is empty:", error);
    return false;
  }
}

/**
 * Updates the sequence-email-editor.tsx component to apply generated emails to multiple steps
 * This function should be called after generating content in sequence mode
 * 
 * @param sequenceId ID of the sequence
 * @param currentStepId ID of the current step
 * @param emailContents Array of generated email contents
 * @returns Information about which steps were updated
 */
export async function applyGeneratedSequence(
  sequenceId: string,
  currentStepId: string,
  emailContents: string[]
): Promise<ApplySequenceEmailsResult> {
  // Apply first email to current step (handled by the UI)
  // and the rest to subsequent empty steps
  return applySequenceEmails(emailContents, currentStepId, true);
}
