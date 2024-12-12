import { google } from "googleapis";
import { prisma } from "@mailjot/database";
import { randomUUID } from "crypto";
import { logger } from "../log/logger";
import { addTrackingToEmail } from "../track/tracking-service";
import type { EmailJob, GoogleAccount } from "../../types/queue";
import type { EmailTracking, EmailTrackingMetadata } from "@mailjot/types";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  threadId?: string;
  tracking: EmailTracking;
  account: GoogleAccount;
  userId: string;
  sequenceId: string;
  contactId: string;
  stepId: string;
}

export class EmailService {
  private async getGmailClient(account: {
    accessToken: string;
    refreshToken: string;
    email?: string;
    expiryDate?: number;
  }) {
    try {
      logger.info(
        {
          email: account.email || "unknown",
          expiryDate: account.expiryDate
            ? new Date(account.expiryDate).toISOString()
            : "unknown",
        },
        "🔄 Initializing Gmail client"
      );

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      logger.info("✓ OAuth2 client created");

      // Check if we have valid credentials
      if (!account.accessToken || !account.refreshToken) {
        logger.error(
          {
            hasAccessToken: !!account.accessToken,
            hasRefreshToken: !!account.refreshToken,
          },
          "❌ Missing required tokens"
        );
        throw new Error("Missing required tokens");
      }

      // Set credentials
      const credentials: any = {
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
      };

      if (account.expiryDate) {
        credentials.expiry_date = account.expiryDate;
      }

      oauth2Client.setCredentials(credentials);
      logger.info("✓ Credentials set on OAuth2 client");

      // Check if token needs refresh
      if (account.expiryDate && account.expiryDate < Date.now()) {
        logger.info(
          {
            expiryDate: new Date(account.expiryDate).toISOString(),
            currentTime: new Date().toISOString(),
          },
          "🔄 Token expired, refreshing..."
        );

        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          logger.info("✓ Token refreshed successfully");

          // Update credentials
          oauth2Client.setCredentials(credentials);
          logger.info("✓ Updated credentials on OAuth2 client");
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : "Unknown error",
              stack: error instanceof Error ? error.stack : undefined,
            },
            "❌ Failed to refresh token"
          );
          throw error;
        }
      }

      logger.info("🔄 Creating Gmail API client");
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      logger.info("✓ Gmail API client created successfully");

      return gmail;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          account: {
            email: account.email || "unknown",
            hasAccessToken: !!account.accessToken,
            hasRefreshToken: !!account.refreshToken,
            expiryDate: account.expiryDate
              ? new Date(account.expiryDate).toISOString()
              : "unknown",
          },
        },
        "❌ Failed to initialize Gmail client"
      );
      throw error;
    }
  }

  async sendEmail(
    options: SendEmailOptions
  ): Promise<{ success: boolean; messageId?: string; threadId?: string }> {
    try {
      logger.info(
        {
          to: options.to,
          subject: options.subject,
          threadId: options.threadId,
          account: {
            email: options.account.email,
            expiryDate: new Date(options.account.expiryDate).toISOString(),
          },
        },
        "📧 Starting email send process"
      );

      // Get Gmail client
      logger.info(
        {
          email: options.account.email,
        },
        "🔄 Getting Gmail client"
      );

      const gmail = await this.getGmailClient(options.account);

      // Send tracked version to recipient
      const trackingId = randomUUID();
      const trackingHash = randomUUID();

      logger.info(
        {
          trackingId,
          trackingHash,
          to: options.to,
        },
        "📝 Creating tracking metadata"
      );

      const trackingMetadata: EmailTrackingMetadata = {
        email: options.to,
        userId: options.userId,
        sequenceId: options.sequenceId,
        contactId: options.contactId,
        stepId: options.stepId,
      };

      const tracking: EmailTracking = {
        id: trackingId,
        hash: trackingHash,
        type: "tracked",
        wrappedLinks: true,
        metadata: trackingMetadata,
      };

      logger.info(
        {
          tracking,
        },
        "📊 Created tracking object"
      );

      logger.info("🔄 Adding tracking to email content");
      const trackedContent = await addTrackingToEmail(options.html, tracking);

      // Prepare tracked email
      logger.info("📝 Preparing tracked email");
      const trackedEmail = [
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        "Content-Type: text/html; charset=utf-8",
        options.replyTo ? `Reply-To: ${options.replyTo}` : "",
        "",
        trackedContent,
      ].join("\n");

      const encodedTrackedEmail = Buffer.from(trackedEmail)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send tracked email
      logger.info(
        {
          to: options.to,
          subject: options.subject,
          threadId: options.threadId,
        },
        "📤 Sending tracked email"
      );

      const trackedResponse = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedTrackedEmail,
          threadId: options.threadId,
        },
      });

      logger.info(
        {
          messageId: trackedResponse.data.id,
          threadId: trackedResponse.data.threadId,
        },
        "✅ Tracked email sent successfully"
      );

      // Send untracked version to sender's mailbox
      logger.info("📝 Preparing untracked copy for sender");
      const untrackedEmail = [
        `To: ${options.account.email}`,
        `Subject: ${options.subject} (Sent)`,
        "Content-Type: text/html; charset=utf-8",
        "",
        options.html,
      ].join("\n");

      const encodedUntrackedEmail = Buffer.from(untrackedEmail)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send untracked email
      logger.info(
        {
          to: options.account.email,
          subject: `${options.subject} (Sent)`,
        },
        "📤 Sending untracked copy to sender"
      );

      const untrackedResponse = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedUntrackedEmail,
          labelIds: ["SENT"],
        },
      });

      logger.info(
        {
          messageId: untrackedResponse.data.id,
        },
        "✅ Untracked copy sent successfully"
      );

      // Create email tracking record
      const emailId = randomUUID();
      logger.info(
        {
          emailId,
          messageId: trackedResponse.data.id,
          threadId: options.threadId,
        },
        "📝 Creating email tracking record"
      );

      await prisma.emailTracking.create({
        data: {
          id: emailId,
          messageId: trackedResponse.data.id || undefined,
          threadId: options.threadId || undefined,
          hash: emailId,
          status: "sent",
          metadata: {
            email: options.to,
            userId: options.userId,
            sequenceId: options.sequenceId,
            contactId: options.contactId,
            stepId: options.stepId,
          },
          sentAt: new Date(),
        },
      });

      logger.info("✅ Email tracking record created");

      // Create email event
      logger.info("📝 Creating email event");
      await prisma.emailEvent.create({
        data: {
          emailId,
          type: "sent",
          sequenceId: options.sequenceId,
          contactId: options.contactId,
          metadata: {
            stepId: options.stepId,
            messageId: trackedResponse.data.id || "",
            userId: options.userId,
          },
        },
      });

      logger.info("✅ Email event created");

      logger.info(
        {
          messageId: trackedResponse.data.id,
          threadId: trackedResponse.data.threadId,
        },
        "✨ Email sending process completed successfully"
      );

      return {
        success: true,
        messageId: trackedResponse.data.id || undefined,
        threadId: trackedResponse.data.threadId || undefined,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          options: {
            to: options.to,
            subject: options.subject,
            threadId: options.threadId,
            account: {
              email: options.account.email,
              expiryDate: new Date(options.account.expiryDate).toISOString(),
            },
          },
        },
        "❌ Error sending email"
      );
      throw error;
    }
  }

  async checkBounceStatus(
    messageId: string
  ): Promise<{ bounced: boolean; details?: any }> {
    try {
      // Get message details from database
      const emailTracking = await prisma.emailTracking.findFirst({
        where: { messageId },
      });

      if (!emailTracking || !emailTracking.metadata) {
        throw new Error("Email tracking record not found");
      }

      const metadata = emailTracking.metadata as {
        email: string;
        userId: string;
        sequenceId: string;
        contactId: string;
        stepId: string;
      };

      // Get Gmail client using the user's account
      const account = await prisma.user.findUnique({
        where: { id: metadata.userId },
        include: {
          accounts: {
            where: { provider: "google" },
            take: 1,
          },
        },
      });

      if (!account?.accounts[0]) {
        throw new Error("User's Google account not found");
      }

      const gmail = await this.getGmailClient({
        accessToken: account.accounts[0].access_token || "",
        refreshToken: account.accounts[0].refresh_token || "",
      });

      // Get message details
      const message = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      // Check for bounce headers
      const headers = message.data.payload?.headers || [];
      const bounceHeader = headers.find(
        (h) => h.name?.toLowerCase() === "x-failed-recipients"
      );

      if (bounceHeader) {
        logger.warn(`Email bounced: ${messageId}`);

        // Update tracking record
        await prisma.emailTracking.update({
          where: { messageId },
          data: {
            status: "bounced",
            bounceInfo: {
              recipients: bounceHeader.value,
              timestamp: new Date(),
            },
          },
        });

        // Create bounce event
        await prisma.emailEvent.create({
          data: {
            emailId: emailTracking.id,
            type: "bounce",
            sequenceId: metadata.sequenceId,
            contactId: metadata.contactId,
            metadata: {
              stepId: metadata.stepId,
              messageId,
              userId: metadata.userId,
            },
          },
        });

        return {
          bounced: true,
          details: {
            recipients: bounceHeader.value,
            timestamp: new Date(),
          },
        };
      }

      return { bounced: false };
    } catch (error) {
      logger.error("Error checking bounce status:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
