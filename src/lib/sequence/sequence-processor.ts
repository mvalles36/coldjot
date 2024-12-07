import { prisma } from "@/lib/prisma";
import type { EmailTracking, SendEmailOptions } from "@/types";
import { TEST_CONTACTS, getRandomTestRecipient } from "@/config/test";
import {
  createEmailTracking,
  trackEmailEvent,
} from "@/lib/tracking/tracking-service";
import { getGoogleAccount } from "@/lib/google/google-account";
import { getDevSettings } from "@/lib/dev-settings";
import { handleEmailSend } from "@/lib/email/email-service";
import { generateTrackingMetadata } from "@/lib/tracking/helper";
import { updateSequenceStats } from "@/lib/stats/sequence-stats-service";
import type { Sequence, SequenceContact, SequenceStep } from "@prisma/client";
import { addTrackingToEmail } from "@/lib/tracking/tracking-service";
import { calculateNextSendTime, isWithinBusinessHours } from "./timing-service";
import type { BusinessHours } from "@/types/sequences";

// Types for better type safety
type SequenceWithRelations = Sequence & {
  contacts: (SequenceContact & {
    contact: { email: string };
  })[];
  steps: SequenceStep[];
  user: { id: string };
  businessHours?: BusinessHours;
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
          contact: {
            select: {
              email: true,
            },
          },
        },
      },
      steps: {
        orderBy: {
          order: "asc",
        },
      },
      user: {
        select: {
          id: true,
        },
      },
      businessHours: {
        select: {
          timezone: true,
          workDays: true,
          workHours: true,
          holidays: true,
        },
      },
    },
  });

  // Transform the business hours data to match the expected type
  return sequences.map((sequence) => ({
    ...sequence,
    businessHours: sequence.businessHours
      ? {
          timezone: sequence.businessHours.timezone,
          workDays: sequence.businessHours.workDays,
          workHours: sequence.businessHours.workHours as {
            start: string;
            end: string;
          },
          holidays: sequence.businessHours.holidays,
        }
      : undefined,
  }));
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

  // Check if we should process this step now based on timing
  if (
    currentStep.timing === "delay" &&
    currentStep.delayAmount &&
    currentStep.delayUnit
  ) {
    const nextSendTime = calculateNextSendTime(
      new Date(sequenceContact.lastProcessedAt || sequenceContact.startedAt),
      {
        amount: currentStep.delayAmount,
        unit: currentStep.delayUnit as "minutes" | "hours" | "days",
      },
      sequence.businessHours || {
        timezone: "UTC",
        workDays: [1, 2, 3, 4, 5],
        workHours: { start: "09:00", end: "17:00" },
        holidays: [],
      }
    );

    if (nextSendTime > new Date()) {
      console.log(`⏳ Step scheduled for later: ${nextSendTime}`);
      return;
    }
  }

  // Check if we're within business hours for this sequence
  if (sequence.scheduleType === "business" && sequence.businessHours) {
    if (!isWithinBusinessHours(new Date(), sequence.businessHours)) {
      console.log("⏰ Outside of business hours, skipping processing");
      return;
    }
  }

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
  tracking: EmailTracking,
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
        email: sequenceContact.contact.email,
        userId: sequence.user.id,
        sequenceId: sequence.id,
        stepId: tracking.metadata.stepId,
        contactId: sequenceContact.contactId,
      }
    );

    // Update sequence contact with new thread ID and step progress
    await updateSequenceContact(
      sequenceContact.id,
      sequenceContact.currentStep,
      sequence.steps.length,
      newThreadId,
      emailOptions.threadId
    );

    console.log(`✅ Email sent successfully`);
  } catch (error) {
    console.error(`❌ Failed to send email:`, error);
    throw error;
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
