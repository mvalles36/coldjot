import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { trackEmailEvent } from "@/lib/tracking/email-events";
import { verifyPubSubJwt } from "@/lib/auth/pubsub";
import { refreshAccessToken, oauth2Client } from "@/lib/google/google-account";
import type { gmail_v1 } from "googleapis";

type MessagePartHeader = gmail_v1.Schema$MessagePartHeader;

// const oauth2Client = new OAuth2Client(
//   process.env.GOOGLE_CLIENT_ID,
//   process.env.GOOGLE_CLIENT_SECRET,
//   `${process.env.AUTH_URL}/api/auth/callback/google`
// );

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
    // Get message details with minimal fields
    const messageDetails = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["From", "References", "In-Reply-To", "Subject", "To"],
    });

    const messageData = messageDetails.data;
    const headers = messageData.payload?.headers || [];
    const threadId = messageData.threadId;
    const labelIds = messageData.labelIds || [];

    // Early return conditions
    if (!threadId) {
      console.log("No thread ID found for message:", messageId);
      return;
    }

    // Skip if message is in SENT or DRAFT
    if (
      labelIds.includes("SENT") ||
      labelIds.includes("DRAFT") ||
      !labelIds.includes("INBOX")
    ) {
      console.log("Skipping non-received message:", messageId);
      return;
    }

    // Get the sender's email
    const fromHeader = headers.find((h) => h.name === "From")?.value || "";
    const senderEmail = fromHeader.match(/<(.+?)>|(.+)/)?.[1] || fromHeader;

    // First try to find the thread in our EmailThread model
    const emailThread = await prisma.emailThread.findUnique({
      where: { gmailThreadId: threadId },
      include: {
        sequence: true,
        contact: true,
      },
    });

    if (emailThread) {
      // Skip if the sender is the same as the sequence sender (our user)
      if (senderEmail.toLowerCase() === userId.toLowerCase()) {
        console.log("Skipping - sender is the sequence owner");
        return;
      }

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
        const subject = headers.find((h) => h.name === "Subject")?.value;

        console.log("📧 Processing reply in thread:", {
          threadId,
          from: fromHeader,
          subject,
        });
        //TODO :  Rename emailId to trackingHash
        // Check if we've already tracked this reply
        const existingReply = await prisma.emailEvent.findFirst({
          where: {
            emailId: trackingEvent.hash,
            type: "REPLIED",
            metadata: {
              path: ["replyMessageId"],
              equals: messageId,
            },
          },
        });

        if (existingReply) {
          console.log("Skip - Reply already tracked for this message");
          return;
        }

        // Track the reply event
        await trackEmailEvent(
          trackingEvent.hash,
          "REPLIED",
          {
            replyMessageId: messageId,
            threadId,
            from: fromHeader,
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
        // Skip if the sender is the sequence owner
        if (senderEmail.toLowerCase() === userId.toLowerCase()) {
          console.log("Skipping - sender is the sequence owner");
          return;
        }

        const trackingEvent = await prisma.emailTrackingEvent.findFirst({
          where: {
            messageId: { in: possibleMessageIds },
            userId,
          },
        });

        if (trackingEvent) {
          //TODO :  Rename emailId to trackingHash
          // Check if we've already tracked this reply
          const existingReply = await prisma.emailEvent.findFirst({
            where: {
              emailId: trackingEvent.hash,
              type: "REPLIED",
              metadata: {
                path: ["replyMessageId"],
                equals: messageId,
              },
            },
          });

          if (existingReply) {
            console.log("Skip - Reply already tracked for this message");
            return;
          }

          console.log("📨 Found reply through message references");
          const snippet = messageDetails.data.snippet || undefined;

          await trackEmailEvent(
            trackingEvent.hash,
            "REPLIED",
            {
              replyMessageId: messageId,
              threadId,
              from: fromHeader,
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

async function processMessageForBounces(
  gmail: gmail_v1.Gmail,
  messageId: string,
  userId: string
) {
  try {
    const messageDetails = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: [
        "From",
        "To",
        "Subject",
        "X-Failed-Recipients",
        "Content-Type",
        "Message-ID",
      ],
    });

    const messageData = messageDetails.data;
    const headers = messageData.payload?.headers || [];
    const labelIds = messageData.labelIds || [];
    const threadId = messageData.threadId;

    // More specific bounce detection
    const isBounce =
      (labelIds.includes("UNDELIVERABLE") &&
        headers.some(
          (h) => h.name === "From" && h.value?.includes("mailer-daemon")
        )) || // Gmail's bounce from daemon
      headers.some((h) => h.name === "X-Failed-Recipients") || // Direct bounce header
      headers.some(
        (h) =>
          h.name === "Content-Type" &&
          h.value?.includes("report-type=delivery-status")
      ); // DSN

    if (!isBounce) {
      return;
    }

    console.log("📨 Potential bounced email detected:", messageId);

    // Find the email thread first
    const emailThread = await prisma.emailThread.findFirst({
      where: {
        gmailThreadId: threadId!,
        userId,
      },
      include: {
        sequence: true,
        contact: true,
      },
    });

    if (!emailThread) {
      console.log("No matching email thread found for bounce");
      return;
    }

    // Check if we already have a bounce event for this thread
    const existingBounceEvent = await prisma.emailEvent.findFirst({
      where: {
        AND: [
          {
            type: "BOUNCED",
          },
          {
            // TODO: Rename emailId to trackingHash
            emailId: {
              in: await prisma.emailTrackingEvent
                .findMany({
                  where: {
                    messageId: emailThread.firstMessageId,
                    userId,
                  },
                  select: {
                    hash: true,
                  },
                })
                .then((events) => events.map((e) => e.hash)),
            },
          },
        ],
      },
    });

    if (existingBounceEvent) {
      console.log("Bounce already recorded for this thread, skipping");
      return;
    }

    // Get the tracking event for the original email
    const trackingEvent = await prisma.emailTrackingEvent.findFirst({
      where: {
        messageId: emailThread.firstMessageId,
        userId,
      },
    });

    if (!trackingEvent) {
      console.log("No tracking event found for bounce");
      return;
    }

    // Extract bounce details
    const failedRecipient = headers.find(
      (h) => h.name === "X-Failed-Recipients"
    )?.value;
    const subject = headers.find((h) => h.name === "Subject")?.value;
    const snippet = messageDetails.data.snippet;

    // Use a transaction to ensure all updates happen together
    await prisma.$transaction(async (prisma) => {
      // Track the bounce event
      await trackEmailEvent(
        trackingEvent.hash,
        "BOUNCED",
        {
          messageId: messageId,
          threadId: threadId!,
          bounceReason: failedRecipient!,
          ...(subject && { subject }),
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

      // Update sequence contact status
      await prisma.sequenceContact.updateMany({
        where: {
          sequenceId: emailThread.sequenceId,
          contactId: emailThread.contactId,
          status: {
            notIn: ["completed", "bounced", "opted_out"],
          },
        },
        data: {
          status: "bounced",
          updatedAt: new Date(),
        },
      });

      // Update contact's email status
      // await prisma.contact.update({
      //   where: {
      //     id: emailThread.contactId,
      //   },
      //   data: {
      //     emailStatus: "bounced",
      //     updatedAt: new Date(),
      //   },
      // });
    });

    console.log(
      "✅ Tracked bounce event for sequence:",
      emailThread.sequenceId
    );
  } catch (error) {
    console.error("Error processing message for bounces:", error);
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

    console.log("🚀 Email headers:", req.headers);

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
        console.log(`3️⃣ Refreshing access token point`);
        accessToken = await refreshAccessToken(user.id, account.refresh_token);
        if (!accessToken) {
          throw new Error("Failed to refresh token");
        }

        // Update the token in database
        // await prisma.account.update({
        //   where: { id: account.id },
        //   data: {
        //     access_token: accessToken,
        //     expires_at: Math.floor(Date.now() / 1000 + 3600),
        //   },
        // });
      } catch (error) {
        console.error("Failed to refresh token:", error);
        return NextResponse.json(
          { error: "Token refresh failed" },
          { status: 401 }
        );
      }
    }

    // TODO: check if we need a local variable or not
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

    // Process messages for opens, replies, and bounces
    for (const record of history.data?.history || []) {
      for (const message of record.messages || []) {
        if (!message.id) continue;

        // Process for opens
        await processMessageForOpens(gmail, message.id, user.id);

        // Process for replies
        await processMessageForReplies(gmail, message.id, user.id);

        // Process for bounces
        await processMessageForBounces(gmail, message.id, user.id);
      }
    }

    // Update the historyId in the account
    await prisma.account.update({
      where: { id: account.id },
      data: {
        watchHistoryId: history.data.historyId?.toString(),
      },
    });

    console.log("🚀 Successfully processed Gmail notification\n\n\n");
    return NextResponse.json(null, { status: 200 });
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
