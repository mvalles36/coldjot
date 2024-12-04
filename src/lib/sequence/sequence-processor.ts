import { prisma } from "@/lib/prisma";
import type { SendEmailOptions } from "@/lib/email/email";
import { TEST_CONTACTS, getRandomTestRecipient } from "@/config/test";
import {
  createEmailTracking,
  trackEmailEvent,
} from "@/lib/tracking/tracking-service";
import { getGoogleAccount } from "@/lib/google/google-account";
import { getDevSettings } from "@/lib/dev-settings";
import { handleEmailSend } from "@/lib/email/email-handler";
import { generateTrackingMetadata } from "@/lib/tracking/tracking-metadata";
import { updateSequenceStats } from "@/lib/stats/sequence-stats-service";
import type { Sequence, SequenceContact, SequenceStep } from "@prisma/client";

// Types for better type safety
type SequenceWithRelations = Sequence & {
  contacts: (SequenceContact & {
    contact: { email: string };
  })[];
  steps: SequenceStep[];
  user: { id: string };
};

// Define DevSettings type based on what getDevSettings returns
type DevSettingsType = {
  disableSending: boolean;
  testEmails: string[];
} | null;

// Fetch active sequences with their related data
async function fetchActiveSequences(): Promise<SequenceWithRelations[]> {
  console.log("🔄 Starting sequence processing...");

  const sequences = await prisma.sequence.findMany({
    where: {
      status: "active",
    },
    include: {
      contacts: {
        where: {
          status: {
            in: ["not_sent", "in_progress"],
          },
        },
        include: {
          contact: true,
        },
      },
      steps: {
        orderBy: {
          order: "asc",
        },
      },
      user: true,
    },
  });

  console.log(`📋 Found ${sequences.length} active sequences to process`);
  return sequences;
}

// Mark a sequence contact as completed
async function markContactCompleted(sequenceContactId: string): Promise<void> {
  await prisma.sequenceContact.update({
    where: { id: sequenceContactId },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });
}

// Prepare email content and recipient
function prepareEmailContent(
  isTestMode: boolean,
  contactEmail: string,
  stepContent: string | null,
  stepSubject: string | null
): { content: string; subject: string } {
  const content = isTestMode
    ? `[TEST MODE] Email intended for: ${contactEmail}\n\n${stepContent}`
    : stepContent || "";

  const subject = isTestMode ? `[TEST] ${stepSubject}` : stepSubject || "";

  return { content, subject };
}

// Get recipient email based on mode and settings
function getRecipientEmail(
  isTestMode: boolean,
  contactEmail: string,
  devSettings: DevSettingsType
): string {
  if (isTestMode && devSettings?.testEmails?.length) {
    const testEmail =
      devSettings.testEmails[
        Math.floor(Math.random() * devSettings.testEmails.length)
      ];
    console.log(`🎯 Test mode: Redirecting email to ${testEmail}`);
    return testEmail;
  }
  return contactEmail;
}

// Prepare email options for sending
function prepareEmailOptions(
  recipientEmail: string,
  content: string,
  subject: string,
  threadId?: string
): SendEmailOptions {
  return {
    to: recipientEmail,
    subject,
    content,
    threadId,
  };
}

// Update sequence contact after successful email send
async function updateSequenceContact(
  sequenceContactId: string,
  currentStep: number,
  totalSteps: number,
  threadId: string | undefined,
  existingThreadId: string | undefined
): Promise<void> {
  const isLastStep = currentStep + 1 >= totalSteps;

  await prisma.sequenceContact.update({
    where: {
      id: sequenceContactId,
    },
    data: {
      threadId: threadId || existingThreadId,
      currentStep: currentStep + 1,
      status: isLastStep ? "completed" : "in_progress",
      lastProcessedAt: new Date(),
      ...(isLastStep ? { completedAt: new Date() } : {}),
    },
  });

  console.log(
    `💾 Updated sequence contact with ${
      threadId ? "new" : "existing"
    } thread ID: ${threadId || existingThreadId}`
  );
}

// Process a single sequence contact
async function processSequenceContact(
  sequence: SequenceWithRelations,
  sequenceContact: SequenceWithRelations["contacts"][0],
  currentStep: SequenceStep,
  googleAccount: any,
  devSettings: DevSettingsType
): Promise<void> {
  console.log(
    `\n📧 Processing email for contact: ${sequenceContact.contact.email}`
  );
  console.log(
    `📍 Step ${sequenceContact.currentStep + 1} of ${sequence.steps.length}`
  );

  const { content, subject } = prepareEmailContent(
    sequence.testMode,
    sequenceContact.contact.email,
    currentStep.content,
    currentStep.subject
  );

  const recipientEmail = getRecipientEmail(
    sequence.testMode,
    sequenceContact.contact.email,
    devSettings
  );

  const threadId =
    currentStep.replyToThread && sequenceContact.threadId
      ? sequenceContact.threadId
      : undefined;

  const trackingMetadata = generateTrackingMetadata(
    recipientEmail,
    sequence.id,
    sequenceContact.contactId,
    currentStep.id,
    sequence.userId
  );
  console.log("Tracking Metadata:", trackingMetadata);

  const tracking = await createEmailTracking(trackingMetadata);
  const emailOptions = prepareEmailOptions(
    recipientEmail,
    content,
    subject,
    threadId
  );

  const shouldSend = !sequence.testMode || devSettings?.testEmails?.length;

  if (shouldSend) {
    await sendEmailAndUpdateStatus(
      sequence,
      sequenceContact,
      emailOptions,
      tracking,
      googleAccount
    );
  } else {
    console.log(
      `⏭️ Skipping email send (test mode without test emails configured)`
    );
  }
}

// Send email and handle status updates
async function sendEmailAndUpdateStatus(
  sequence: SequenceWithRelations,
  sequenceContact: SequenceWithRelations["contacts"][0],
  emailOptions: SendEmailOptions,
  tracking: any,
  googleAccount: any
): Promise<void> {
  console.log(`📤 Preparing to send email...`);
  console.log(
    `📧 Thread status: ${
      emailOptions.threadId ? "Continuing thread" : "Starting new thread"
    }`
  );

  try {
    const newThreadId = await handleEmailSend(
      emailOptions,
      tracking,
      googleAccount
    );

    // Update sequence stats for successful send
    await trackEmailEvent(
      tracking.id,
      "sent",
      {
        messageId: newThreadId,
        threadId: newThreadId,
      },
      {
        sequenceId: sequence.id,
        contactId: sequenceContact.contactId,
        email: sequenceContact.contact.email,
        userId: sequence.userId,
        stepId: tracking.stepId,
      }
    );

    await updateSequenceContact(
      sequenceContact.id,
      sequenceContact.currentStep,
      sequence.steps.length,
      newThreadId || undefined,
      sequenceContact.threadId || undefined
    );
  } catch (error) {
    console.error("Failed to send email:", error);
    // Update sequence stats for bounced email
    await trackEmailEvent(
      tracking.id,
      "bounced",
      {
        bounceReason: error instanceof Error ? error.message : "Unknown error",
      },
      {
        sequenceId: sequence.id,
        contactId: sequenceContact.contactId,
        email: sequenceContact.contact.email,
        userId: sequence.userId,
        stepId: tracking.stepId,
      }
    );
  }
}

// Main sequence processing function
export async function processSequences() {
  const sequences = await fetchActiveSequences();

  for (const sequence of sequences) {
    console.log(
      `\n🔍 Processing sequence: ${sequence.name} (ID: ${sequence.id})`
    );
    console.log(`📝 Mode: ${sequence.testMode ? "Test" : "Live"}`);

    const googleAccount = await getGoogleAccount(sequence.userId);
    if (!googleAccount) {
      console.error(
        `❌ No valid Google account found for user ${sequence.userId}`
      );

      //TODOD : check if we need to skip to the next sequence if no Google account is found
      continue;
    }

    const devSettings = sequence.testMode
      ? await getDevSettings(sequence.userId)
      : null;

    for (const sequenceContact of sequence.contacts) {
      const currentStep = sequence.steps[sequenceContact.currentStep];

      if (!currentStep) {
        console.log(
          `✅ All steps completed for contact: ${sequenceContact.contact.email}`
        );
        await markContactCompleted(sequenceContact.id);
        continue;
      }

      try {
        await processSequenceContact(
          sequence,
          sequenceContact,
          currentStep,
          googleAccount,
          devSettings
        );
      } catch (error) {
        console.error(
          `❌ Error processing sequence contact ${sequenceContact.id}:`,
          error
        );
      }
    }
  }
}
