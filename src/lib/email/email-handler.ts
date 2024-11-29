import { prisma } from "@/lib/prisma";
import { sendEmail, refreshAccessToken } from "@/lib/email/email";
import type { SendEmailOptions } from "@/lib/email/email";
import { EmailTrackingMetadata, EmailTracking } from "@/types/sequences";
import { addTrackingToEmail } from "@/lib/tracking/tracking-service";
import { trackEmailEvent } from "@/lib/tracking/email-events";
import type { EmailEventType } from "@prisma/client";
import type { GoogleAccount } from "@/lib/google/google-account";

export async function handleEmailSend(
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
          gmailThreadId: result.threadId,
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

    console.log(` Email sent with tracking:`, {
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
