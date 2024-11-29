import { prisma } from "@/lib/prisma";
import { sendEmail, refreshAccessToken } from "@/lib/email";
import type { SendEmailOptions } from "@/lib/email";
import { TEST_CONTACTS, getRandomTestRecipient } from "@/config/test";
import { EmailTrackingMetadata, EmailTracking } from "@/types/sequences";
import {
  createEmailTracking,
  addTrackingToEmail,
} from "@/lib/tracking-service";
import { trackEmailEvent } from "@/lib/email-events";
import type { EmailEventType } from "@prisma/client";

interface GoogleAccount {
  access_token: string;
  refresh_token: string;
  providerAccountId: string;
}

async function getGoogleAccount(userId: string): Promise<GoogleAccount | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId: userId,
      provider: "google",
    },
    select: {
      access_token: true,
      refresh_token: true,
      providerAccountId: true,
    },
  });

  if (
    !account?.access_token ||
    !account?.refresh_token ||
    !account?.providerAccountId
  ) {
    return null;
  }

  return {
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    providerAccountId: account.providerAccountId,
  };
}

function generateTrackingMetadata(
  email: string,
  sequenceId: string,
  contactId: string,
  stepId: string,
  userId: string
): EmailTrackingMetadata {
  console.log("Generating tracking metadata with:", {
    email,
    sequenceId,
    contactId,
    stepId,
    userId,
  });

  const metadata: EmailTrackingMetadata = {
    email,
    userId,
    sequenceId,
    stepId,
    contactId,
  };

  console.log("Generated metadata:", metadata);

  return metadata;
}

async function handleEmailSend(
  emailOptions: SendEmailOptions,
  tracking: EmailTracking,
  account: GoogleAccount
): Promise<string | undefined> {
  try {
    const trackedContent = await addTrackingToEmail(
      emailOptions.content,
      tracking
    );

    const result = await sendEmail({
      ...emailOptions,
      content: trackedContent,
      accessToken: account.access_token,
    });

    // Save both messageId and threadId
    if (result.messageId) {
      await prisma.emailTrackingEvent.update({
        where: { hash: tracking.hash },
        data: {
          messageId: result.messageId,
          gmailThreadId: result.threadId, // Add this field to track Gmail's thread ID
        },
      });

      // If this is a new thread, update the sequence contact
      if (result.threadId) {
        await prisma.sequenceContact.update({
          where: {
            sequenceId_contactId: {
              sequenceId: tracking.metadata.sequenceId,
              contactId: tracking.metadata.contactId,
            },
          },
          data: {
            threadId: result.threadId,
          },
        });

        // Also save to EmailThread model for better tracking
        const existingThread = await prisma.emailThread.findUnique({
          where: {
            gmailThreadId: result.threadId,
          },
        });

        if (!existingThread) {
          await prisma.emailThread.create({
            data: {
              gmailThreadId: result.threadId,
              sequenceId: tracking.metadata.sequenceId,
              contactId: tracking.metadata.contactId,
              userId: tracking.metadata.userId,
              subject: emailOptions.subject,
              firstMessageId: result.messageId,
            },
          });
        }
      }
    }

    await trackEmailEvent(
      tracking.hash,
      "SENT",
      {
        messageId: result.messageId,
        threadId: result.threadId,
      },
      tracking.metadata
    );

    console.log(`📊 Email sent with tracking:`, {
      email: emailOptions.to,
      messageId: result.messageId,
      threadId: result.threadId,
      type: tracking.type,
    });

    return result.threadId;
  } catch (error: any) {
    if (error.message === "TOKEN_EXPIRED") {
      console.log(`🔄 Refreshing access token...`);
      const newAccessToken = await refreshAccessToken(account.refresh_token);

      if (!newAccessToken) {
        throw new Error("Failed to refresh token");
      }

      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: newAccessToken,
        },
      });

      console.log(`🔄 Retrying with new token...`);
      const retryContent = await addTrackingToEmail(
        emailOptions.content,
        tracking
      );
      const retryResult = await sendEmail({
        ...emailOptions,
        content: retryContent,
        accessToken: newAccessToken,
      });

      if (retryResult.threadId) {
        console.log(
          `📧 Email sent successfully in thread: ${retryResult.threadId}`
        );
      } else {
        console.log(
          `📧 New email thread created with ID: ${retryResult.messageId}`
        );
      }

      return retryResult.threadId;
    } else {
      await trackEmailEvent(
        tracking.id,
        "BOUNCED" as EmailEventType,
        {
          bounceReason: error.message,
        },
        tracking.metadata
      );

      console.error(`❌ Error sending email:`, error);
      throw error;
    }
  }
}

async function getDevSettings(userId: string) {
  return await prisma.devSettings.findUnique({
    where: { userId },
    select: {
      disableSending: true,
      testEmails: true,
    },
  });
}

export async function processSequences() {
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
        await prisma.sequenceContact.update({
          where: { id: sequenceContact.id },
          data: {
            status: "completed",
            completedAt: new Date(),
          },
        });
        continue;
      }

      try {
        console.log(
          `\n📧 Processing email for contact: ${sequenceContact.contact.email}`
        );
        console.log(
          `📍 Step ${sequenceContact.currentStep + 1} of ${
            sequence.steps.length
          }`
        );

        const emailContent = sequence.testMode
          ? `[TEST MODE] Email intended for: ${sequenceContact.contact.email}\n\n${currentStep.content}`
          : currentStep.content;

        const recipientEmail =
          sequence.testMode && devSettings?.testEmails?.length
            ? devSettings.testEmails[
                Math.floor(Math.random() * devSettings.testEmails.length)
              ]
            : sequenceContact.contact.email;

        if (sequence.testMode) {
          console.log(`🎯 Test mode: Redirecting email to ${recipientEmail}`);
        }

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

        const emailOptions: SendEmailOptions = {
          to: recipientEmail,
          subject: sequence.testMode
            ? `[TEST] ${currentStep.subject}`
            : currentStep.subject || "",
          content: emailContent || "",
          threadId,
        };

        const shouldSend =
          !sequence.testMode || devSettings?.testEmails?.length;

        if (shouldSend) {
          console.log(`📤 Preparing to send email...`);
          console.log(
            `📧 Thread status: ${
              threadId ? "Continuing thread" : "Starting new thread"
            }`
          );

          const newThreadId = await handleEmailSend(
            emailOptions,
            tracking,
            googleAccount
          );

          await prisma.sequenceContact.update({
            where: {
              id: sequenceContact.id,
            },
            data: {
              threadId: newThreadId || sequenceContact.threadId,
              currentStep: sequenceContact.currentStep + 1,
              status:
                sequenceContact.currentStep + 1 >= sequence.steps.length
                  ? "completed"
                  : "in_progress",
              lastProcessedAt: new Date(),
              ...(sequenceContact.currentStep + 1 >= sequence.steps.length
                ? { completedAt: new Date() }
                : {}),
            },
          });

          console.log(
            `💾 Updated sequence contact with ${
              newThreadId ? "new" : "existing"
            } thread ID: ${newThreadId || sequenceContact.threadId}`
          );
        } else {
          console.log(
            `⏭️ Skipping email send (test mode without test emails configured)`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error processing sequence contact ${sequenceContact.id}:`,
          error
        );
      }
    }
  }
}

// {"bounceReason": "\nInvalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__[\"prisma\"].emailThread.create()` invocation in\n/Volumes/Data/zk-mail/.next/server/chunks/[root of the server]__68b887._.js:988:164\n\n  985     }\n  986 });\n  987 // Also save to EmailThread model for better tracking\n→ 988 await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__[\"prisma\"].emailThread.create(\nUnique constraint failed on the fields: (`gmailThreadId`)"}
