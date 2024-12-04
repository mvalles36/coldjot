import { prisma } from "@/lib/prisma";
import type { SendEmailOptions } from "@/lib/email/email";
import { TEST_CONTACTS, getRandomTestRecipient } from "@/config/test";
import { createEmailTracking } from "@/lib/tracking/tracking-service";
import { getGoogleAccount } from "@/lib/google/google-account";
import { getDevSettings } from "@/lib/dev-settings";
import { handleEmailSend } from "@/lib/email/email-handler";
import { generateTrackingMetadata } from "@/lib/tracking/tracking-metadata";
import { updateSequenceStats } from "@/lib/stats/sequence-stats-service";

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

          try {
            const newThreadId = await handleEmailSend(
              emailOptions,
              tracking,
              googleAccount
            );

            // Update sequence stats for successful send
            await updateSequenceStats(
              sequence.id,
              "sent",
              sequenceContact.contactId
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
          } catch (error) {
            console.error("Failed to send email:", error);
            // Update sequence stats for bounced email
            await updateSequenceStats(
              sequence.id,
              "bounced",
              sequenceContact.contactId
            );
          }
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
