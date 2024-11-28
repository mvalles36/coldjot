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
      historyTypes: ["messageAdded"],
    });

    console.log(
      "🚀 Processing history:",
      JSON.stringify(history.data, null, 2)
    );

    // Process new messages
    for (const record of history.data?.history || []) {
      for (const message of record.messagesAdded || []) {
        if (!message.message?.id) continue;

        const messageDetails = await gmail.users.messages.get({
          userId: "me",
          id: message.message.id,
        });

        // Check if this is a reply to one of our tracked emails
        const inReplyTo = messageDetails.data?.payload?.headers?.find(
          (h: MessagePartHeader) => h.name === "In-Reply-To" && h.value
        )?.value;

        if (inReplyTo) {
          // Find the original email in our tracking system
          const originalEmail = await prisma.emailTrackingEvent.findFirst({
            where: {
              hash: inReplyTo.replace(/[<>]/g, ""),
            },
          });

          if (originalEmail) {
            console.log("📨 Found reply to tracked email:", originalEmail.hash);
            const threadId = messageDetails.data?.threadId || undefined;

            // Track the reply event
            await trackEmailEvent(
              originalEmail.hash,
              "REPLIED",
              {
                replyMessageId: message.message.id,
                threadId: threadId,
              },
              {
                email: originalEmail.email,
                userId: user.id,
                sequenceId: originalEmail.sequenceId,
                stepId: originalEmail.stepId,
                contactId: originalEmail.contactId,
              }
            );

            console.log("✅ Tracked reply event");
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("🚀 Error processing Gmail notification:", error);
    return NextResponse.json(
      { error: "Failed to process notification" },
      { status: 500 }
    );
  }
}
