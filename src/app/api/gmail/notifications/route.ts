import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { trackEmailEvent } from "@/lib/email-events";
import { verifyPubSubJwt } from "@/lib/auth/pubsub";
import { refreshAccessToken } from "@/lib/email";
import type { gmail_v1 } from "googleapis";

type MessagePartHeader = gmail_v1.Schema$MessagePartHeader;

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.AUTH_URL}/api/auth/callback/google`
);

async function processMessageForOpens(
  gmail: gmail_v1.Gmail,
  messageId: string,
  userId: string
) {
  try {
    const messageDetails = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = messageDetails.data.payload?.headers || [];

    // Get the References header to find the original message
    const references = headers
      .find((h) => h.name === "References")
      ?.value?.split(/\s+/);

    // Get the original message ID (last in references chain)
    const originalMessageId = references?.[references.length - 1]?.replace(
      /[<>]/g,
      ""
    );

    if (originalMessageId) {
      // Find our tracking record for this email
      const trackingEvent = await prisma.emailTrackingEvent.findFirst({
        where: {
          messageId: originalMessageId,
          userId,
        },
      });

      if (trackingEvent) {
        // Record the open event
        await trackEmailEvent(
          trackingEvent.hash,
          "OPENED",
          {
            messageId: messageId,
            threadId: messageDetails.data.threadId!,
          },
          {
            email: trackingEvent.email,
            userId: trackingEvent.userId,
            sequenceId: trackingEvent.sequenceId,
            stepId: trackingEvent.stepId,
            contactId: trackingEvent.contactId,
          }
        );

        console.log(`✅ Tracked open event for email: ${trackingEvent.hash}`);
      }
    }
  } catch (error) {
    console.error("Error processing message for opens:", error);
  }
}

async function processMessageForReplies(
  gmail: gmail_v1.Gmail,
  messageId: string,
  userId: string
) {
  try {
    const messageDetails = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    console.log("🚀 Message details:", messageDetails.data);

    const headers = messageDetails.data.payload?.headers || [];
    const threadId = messageDetails.data.threadId;

    console.log("🚀 Thread ID:", threadId);

    if (!threadId) {
      console.log("No thread ID found for message:", messageId);
      return;
    }

    console.log("🚀 Finding email thread...");

    // First try to find the thread in our EmailThread model
    const emailThread = await prisma.emailThread.findUnique({
      where: { gmailThreadId: threadId },
      include: {
        sequence: true,
        contact: true,
      },
    });

    if (emailThread) {
      console.log("📨 Found matching thread:", emailThread.id);

      // Find the original tracking event using firstMessageId
      const trackingEvent = await prisma.emailTrackingEvent.findFirst({
        where: {
          messageId: emailThread.firstMessageId,
          userId,
        },
      });

      if (trackingEvent) {
        // Get email content and metadata
        const snippet = messageDetails.data.snippet || undefined;
        const from = headers.find((h) => h.name === "From")?.value || undefined;
        const subject = headers.find((h) => h.name === "Subject")?.value;

        console.log("📧 Processing reply in thread:", {
          threadId,
          from,
          subject,
        });

        // Track the reply event
        await trackEmailEvent(
          trackingEvent.hash,
          "REPLIED",
          {
            replyMessageId: messageId,
            threadId,
            ...(from && { from }),
            ...(snippet && { snippet }),
            timestamp: new Date().toISOString(),
          },
          {
            email: emailThread.contact.email,
            userId: emailThread.userId,
            sequenceId: emailThread.sequenceId,
            stepId: trackingEvent.stepId,
            contactId: emailThread.contactId,
          }
        );

        // Update sequence contact status if needed
        await prisma.sequenceContact.updateMany({
          where: {
            sequenceId: emailThread.sequenceId,
            contactId: emailThread.contactId,
            status: {
              notIn: ["completed", "replied", "opted_out"],
            },
          },
          data: {
            status: "replied",
            updatedAt: new Date(),
          },
        });

        console.log(
          "✅ Tracked reply event for sequence:",
          emailThread.sequenceId
        );
      }
    } else {
      // Fallback to checking References and In-Reply-To headers
      const inReplyTo = headers
        .find((h) => h.name === "In-Reply-To")
        ?.value?.replace(/[<>]/g, "");
      const references = headers
        .find((h) => h.name === "References")
        ?.value?.split(/\s+/)
        .map((ref) => ref.replace(/[<>]/g, ""));

      const possibleMessageIds = [inReplyTo, ...(references || [])].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      );

      if (possibleMessageIds.length > 0) {
        const trackingEvent = await prisma.emailTrackingEvent.findFirst({
          where: {
            messageId: { in: possibleMessageIds },
            userId,
          },
        });

        if (trackingEvent) {
          console.log("📨 Found reply through message references");
          // Process reply using existing code...
          const snippet = messageDetails.data.snippet || undefined;
          const from =
            headers.find((h) => h.name === "From")?.value || undefined;

          await trackEmailEvent(
            trackingEvent.hash,
            "REPLIED",
            {
              replyMessageId: messageId,
              threadId,
              ...(from && { from }),
              ...(snippet && { snippet }),
              timestamp: new Date().toISOString(),
            },
            {
              email: trackingEvent.email,
              userId: trackingEvent.userId,
              sequenceId: trackingEvent.sequenceId,
              stepId: trackingEvent.stepId,
              contactId: trackingEvent.contactId,
            }
          );

          console.log("✅ Tracked reply event through references");
        }
      }
    }
  } catch (error) {
    console.error("Error processing message for replies:", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 Received Gmail notification...");

    // Improve authorization check
    console.log("🚀 Checking authorization...");
    const authorization = req.headers.get("Authorization");
    console.log("🚀 Authorization:", authorization?.slice(0, 50));
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authorization.replace("Bearer ", "");
    const isValid = await verifyPubSubJwt(token);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse notification data
    const body = await req.json();
    const data = JSON.parse(
      Buffer.from(body.message.data, "base64").toString()
    );
    console.log("🚀 Parsed data:", data);

    const { emailAddress, historyId } = data;

    // Find user and their Google account
    const user = await prisma.user.findUnique({
      where: { email: emailAddress },
      include: {
        accounts: {
          where: { provider: "google" },
          select: {
            id: true,
            providerAccountId: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
          },
        },
      },
    });

    if (!user?.accounts?.[0]) {
      console.error("No Google account found for user:", emailAddress);
      return NextResponse.json(
        { error: "Google account not found" },
        { status: 404 }
      );
    }

    const account = user.accounts[0];

    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000);
    let accessToken = account.access_token;

    if (
      account.expires_at &&
      account.expires_at < now &&
      account.refresh_token
    ) {
      console.log("🔄 Refreshing access token...");
      try {
        accessToken = await refreshAccessToken(account.refresh_token);
        if (!accessToken) {
          throw new Error("Failed to refresh token");
        }

        // Update the token in database
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: accessToken,
            expires_at: Math.floor(Date.now() / 1000 + 3600),
          },
        });
      } catch (error) {
        console.error("Failed to refresh token:", error);
        return NextResponse.json(
          { error: "Token refresh failed" },
          { status: 401 }
        );
      }
    }

    // Set up Gmail API client
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: account.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get history changes
    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: historyId,
      historyTypes: ["messageAdded", "labelAdded"],
    });

    console.log("🚀 Processing history:", history.data);
    // console.log("🚀 Processing history:", JSON.stringify(history, null, 2));

    // Process messages for opens and replies
    for (const record of history.data?.history || []) {
      // Process messages in history
      for (const message of record.messages || []) {
        if (!message.id) continue;

        // Process for opens
        await processMessageForOpens(gmail, message.id, user.id);

        // Process for replies
        await processMessageForReplies(gmail, message.id, user.id);
      }
    }

    // Update the historyId in the account
    await prisma.account.update({
      where: { id: account.id },
      data: {
        watchHistoryId: history.data.historyId?.toString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("🚀 Error processing Gmail notification:", error);
    return NextResponse.json(
      { error: "Failed to process notification" },
      { status: 500 }
    );
  }
}

// 🚀 Processing history: {
//   "history": [
//     {
//       "id": "5414717",
//       "messages": [
//         {
//           "id": "193743f5359a3c56",
//           "threadId": "193742e193b91bb8"
//         }
//       ]
//     }
//   ],
//   "historyId": "5414717"
// }

// 🚀 Processing history: {
//   "history": [
//     {
//       "id": "5414780",
//       "messages": [
//         {
//           "id": "1937444c276ab7f0",
//           "threadId": "193742e193b91bb8"
//         }
//       ]
//     }
//   ],
//   "historyId": "5414780"
// }
