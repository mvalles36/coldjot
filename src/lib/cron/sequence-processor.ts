import { prisma } from "@/lib/prisma";
import { sendEmail, refreshAccessToken } from "@/lib/email";
import type { SendEmailOptions } from "@/lib/email";
import { TEST_CONTACTS, getRandomTestRecipient } from "@/config/test";

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

async function handleEmailSend(
  emailOptions: SendEmailOptions,
  account: GoogleAccount
): Promise<string | undefined> {
  try {
    const result = await sendEmail({
      ...emailOptions,
      accessToken: account.access_token,
    });

    return result.threadId;
  } catch (error: any) {
    if (error.message === "TOKEN_EXPIRED") {
      console.log(`🔄 Refreshing access token...`);
      const newAccessToken = await refreshAccessToken(account.refresh_token);

      if (!newAccessToken) {
        throw new Error("Failed to refresh token");
      }

      // Update the token in database
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

      // Retry with new token
      console.log(`🔄 Retrying with new token...`);
      const retryResult = await sendEmail({
        ...emailOptions,
        accessToken: newAccessToken,
      });
      return retryResult.threadId;
    } else {
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

    // Get user's Google account
    const googleAccount = await getGoogleAccount(sequence.userId);
    if (!googleAccount) {
      console.error(
        `❌ No valid Google account found for user ${sequence.userId}`
      );
      continue;
    }

    // Only fetch dev settings if sequence is in test mode
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

      const previousStep =
        sequenceContact.currentStep > 0
          ? sequence.steps[sequenceContact.currentStep - 1]
          : null;

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

        // Use dev settings test emails if in test mode and test emails exist
        const recipientEmail =
          sequence.testMode && devSettings?.testEmails?.length
            ? devSettings.testEmails[
                Math.floor(Math.random() * devSettings.testEmails.length)
              ]
            : sequenceContact.contact.email;

        if (sequence.testMode) {
          console.log(`🎯 Test mode: Redirecting email to ${recipientEmail}`);
        }

        // Get thread ID based on replyToThread setting
        const threadId = currentStep.replyToThread
          ? sequenceContact.threadId
          : undefined;

        const emailOptions: SendEmailOptions = {
          to: recipientEmail,
          subject: sequence.testMode
            ? `[TEST] ${currentStep.subject}`
            : currentStep.subject || "",
          content: emailContent || "",
          threadId: threadId || undefined,
        };
        console.log(
          `💌 Sending email options: ${JSON.stringify(emailOptions)}`
        );

        const shouldSend =
          !sequence.testMode || devSettings?.testEmails?.length;

        if (shouldSend) {
          console.log(`📤 Sending email...`);
          const threadId = await handleEmailSend(emailOptions, googleAccount);

          // Save the thread ID to the sequence contact
          if (threadId) {
            await prisma.sequenceContact.update({
              where: {
                id: sequenceContact.id,
              },
              data: {
                threadId,
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
            console.log(`💾 Saved thread ID to contact: ${threadId}`);
          } else {
            // Update other fields without thread ID
            await prisma.sequenceContact.update({
              where: {
                id: sequenceContact.id,
              },
              data: {
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
          }

          console.log(`✅ Email sent successfully`);
        } else {
          console.log(`⏭️ Skipping email send (test mode)`);
        }
      } catch (error) {
        console.error(
          `❌ Error processing sequence contact ${sequenceContact.id}:`,
          error
        );

        await prisma.sequenceContact.update({
          where: {
            id: sequenceContact.id,
          },
          data: {
            status: "failed",
          },
        });
      }
    }
  }

  console.log("\n✨ Sequence processing completed");
}
