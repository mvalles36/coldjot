import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@mailjot/database";
// import { trackEmailEvent } from "@/lib/tracking/tracking-service";
import { verifyPubSubJwt } from "@/lib/auth/pubsub";
import { refreshAccessToken, oauth2Client } from "@/lib/google/google-account";
// import { updateSequenceStats } from "@/lib/stats/sequence-stats-service";
import type { gmail_v1 } from "googleapis";
import { GaxiosResponse } from "gaxios";
import {
  extractEmailFromHeader,
  isBounceMessage,
  isSenderSequenceOwner,
  shouldProcessMessage,
  extractPossibleMessageIds,
  validateAuthorization,
} from "@/utils";

// Types and Interfaces
import type {
  MessagePartHeader,
  Gmail,
  Message,
  SequenceContactStatusType,
} from "@mailjot/types";
import { SequenceContactStatusEnum } from "@mailjot/types";

interface NotificationData {
  emailAddress: string;
  historyId: string;
}

interface EmailThread {
  id: string;
  threadId: string;
  firstMessageId: string;
  userId: string;
  sequenceId: string;
  contactId: string;
  sequence: any;
  contact: {
    email: string;
  };
}

interface TrackingEvent {
  hash: string;
  email: string;
  userId: string;
  sequenceId: string;
  stepId: string;
  contactId: string;
}

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

// Main POST handler
export async function POST(req: NextRequest) {
  try {
    console.log("🚀 Received Gmail notification...");

    // Authorization check
    const token = await validateAuthorization(req);
    if (!token) {
      return NextResponse.json(
        { error: "Invalid authorization header" },
        { status: 401 }
      );
    }

    // Verify JWT token
    const isValid = await verifyPubSubJwt(token);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse notification data
    const notificationData = await parseNotificationData(req);
    const { emailAddress, historyId } = notificationData;

    // Get user and Google account
    const { user, account } = await getUserAndAccount(emailAddress);
    if (!user || !account) {
      return NextResponse.json(
        { error: "Google account not found" },
        { status: 404 }
      );
    }

    // Handle access token refresh if needed
    const accessToken = await handleAccessTokenRefresh(user.id, account);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Token refresh failed" },
        { status: 401 }
      );
    }

    const refreshToken = account.refresh_token;
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token not found" },
        { status: 401 }
      );
    }
    // Initialize Gmail client
    const gmail = await initializeGmailClient(accessToken, refreshToken);

    // Process history
    const history = await getGmailHistory(gmail, historyId);

    // TOOD : uncomment this
    await processHistoryRecords(gmail, history, user.id);

    // Update history ID
    await updateHistoryId(account.id, history.data.historyId?.toString());

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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const parseNotificationData = async (
  req: NextRequest
): Promise<NotificationData> => {
  const body = await req.json();
  return JSON.parse(Buffer.from(body.message.data, "base64").toString());
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const getUserAndAccount = async (emailAddress: string) => {
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

  return { user, account: user?.accounts?.[0] };
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const handleAccessTokenRefresh = async (
  userId: string,
  account: any
): Promise<string | null> => {
  const now = Math.floor(Date.now() / 1000);
  let accessToken = account.access_token;

  if (account.expires_at && account.expires_at < now && account.refresh_token) {
    try {
      accessToken = await refreshAccessToken(userId, account.refresh_token);
      if (!accessToken) {
        throw new Error("Failed to refresh token");
      }
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return null;
    }
  }

  return accessToken;
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const initializeGmailClient = async (
  accessToken: string,
  refreshToken: string
): Promise<Gmail> => {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const getGmailHistory = async (gmail: Gmail, historyId: string) => {
  return gmail.users.history.list({
    userId: "me",
    startHistoryId: historyId,
    historyTypes: ["messageAdded", "labelAdded"],
  });
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const processHistoryRecords = async (
  gmail: Gmail,
  history: any,
  userId: string
) => {
  console.log("history", history.data);
  for (const record of history.data?.history || []) {
    for (const message of record.messages || []) {
      if (!message.id) continue;

      // await processMessageForOpens(gmail, message.id, userId);
      await processMessageForReplies(gmail, message.id, userId);
      // await processMessageForBounces(gmail, message.id, userId);
    }
  }
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

// Email Event Processing Functions
async function processMessageForOpens(
  gmail: Gmail,
  messageId: string,
  userId: string
) {
  try {
    console.log("📧 Processing message for opens:", messageId);
    const messageDetails = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = messageDetails.data.payload?.headers || [];
    const references = headers
      .find((h: MessagePartHeader) => h.name === "References")
      ?.value?.split(/\s+/);
    const originalMessageId = references?.[references.length - 1]?.replace(
      /[<>]/g,
      ""
    );

    if (!originalMessageId) return;

    const trackingEvent = await prisma.emailTracking.findFirst({
      where: { messageId: originalMessageId, userId },
    });

    if (trackingEvent) {
      // TODO: fix this
      // await trackEmailEvent(
      //   trackingEvent.hash,
      //   "opened",
      //   {
      //     messageId,
      //     threadId: messageDetails.data.threadId!,
      //   },
      //   {
      //     email: trackingEvent.email,
      //     userId: trackingEvent.userId,
      //     sequenceId: trackingEvent.sequenceId,
      //     stepId: trackingEvent.stepId,
      //     contactId: trackingEvent.contactId,
      //   }
      // );
      console.log(`✅ Tracked open event for email: ${trackingEvent.hash}`);
    }
  } catch (error) {
    console.error("Error processing message for opens:", error);
  }
}

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

async function processMessageForReplies(
  gmail: Gmail,
  messageId: string,
  userId: string
) {
  try {
    const messageDetails = await getMessageHeaders(gmail, messageId, [
      "From",
      "References",
      "In-Reply-To",
      "Subject",
      "To",
    ]);
    console.log("Message Details", messageDetails.data);

    const messageData = messageDetails.data;
    console.log("Message Data", messageData);
    const headers = messageData.payload?.headers || [];
    console.log("Headers", headers);
    const threadId = messageData.threadId;
    console.log("Thread Id", threadId);
    const labelIds = messageData.labelIds || [];
    console.log("Label Ids", labelIds);

    // Early return conditions
    if (!threadId || !shouldProcessMessage(labelIds)) {
      return;
    }

    const fromHeader =
      headers.find((h: MessagePartHeader) => h.name === "From")?.value || "";
    const senderEmail = extractEmailFromHeader(fromHeader);

    console.log("Sender Email", senderEmail);

    if (isSenderSequenceOwner(senderEmail, userId)) {
      return;
    }

    // Try thread-based reply first
    const threadBasedResult = await processThreadBasedReply(
      gmail,
      messageId,
      threadId,
      userId,
      headers,
      fromHeader,
      messageDetails
    );

    console.log("Thread Based Result", threadBasedResult);

    // Only try reference-based if thread-based didn't find anything
    if (!threadBasedResult) {
      await processReferenceBasedReply(
        gmail,
        messageId,
        userId,
        headers,
        fromHeader,
        threadId,
        messageDetails
      );
    }
  } catch (error) {
    console.error("Error processing message for replies:", error);
  }
}

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const getMessageHeaders = async (
  gmail: Gmail,
  messageId: string,
  headers: string[]
): Promise<GaxiosResponse<Message>> => {
  return gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: headers,
  });
};

// -----------------------------------------

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const findEmailThread = async (threadId: string, userId: string) => {
  return prisma.emailThread.findFirst({
    where: {
      threadId: threadId,
      userId,
    },
    include: {
      sequence: true,
      contact: true,
    },
  });
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const hasBounceEvent = async (emailThread: any) => {
  const existingBounceEvent = await prisma.emailEvent.findFirst({
    where: {
      sequenceId: emailThread.sequenceId,
      contactId: emailThread.contactId,
      type: "BOUNCED",
    },
  });
  return !!existingBounceEvent;
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const findTrackingEvent = async (messageId: string, userId: string) => {
  return prisma.emailTracking.findFirst({
    where: {
      messageId,
      userId,
    },
  });
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const processBounceEvent = async (
  trackingEvent: any,
  emailThread: any,
  messageId: string,
  headers: MessagePartHeader[]
) => {
  const failedRecipient = headers.find(
    (h) => h.name === "X-Failed-Recipients"
  )?.value;

  console.log(
    "✅ Tracked first bounce event for sequence:",
    emailThread.sequenceId
  );
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const processThreadBasedReply = async (
  gmail: Gmail,
  messageId: string,
  threadId: string,
  userId: string,
  headers: MessagePartHeader[],
  fromHeader: string,
  messageDetails: GaxiosResponse<Message>
) => {
  const emailThread = await prisma.emailThread.findUnique({
    where: { threadId: threadId },
    include: {
      sequence: true,
      contact: true,
    },
  });

  if (!emailThread) return false;

  const trackingEvent = await findTrackingEvent(
    emailThread.firstMessageId,
    userId
  );
  if (!trackingEvent) return false;

  const existingReplyEvent = await hasExistingReplyEvent(
    emailThread.sequenceId,
    emailThread.contactId
  );
  if (existingReplyEvent) return false;

  // TODO: fix this
  // await processReplyEvent(
  //   trackingEvent,
  //   messageId,
  //   threadId,
  //   fromHeader,
  //   messageDetails,
  //   emailThread
  // );

  return true;
};
// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const processReferenceBasedReply = async (
  gmail: Gmail,
  messageId: string,
  userId: string,
  headers: MessagePartHeader[],
  fromHeader: string,
  threadId: string,
  messageDetails: GaxiosResponse<Message>
) => {
  const possibleMessageIds = extractPossibleMessageIds(headers);
  if (possibleMessageIds.length === 0) return;

  const trackingEvent = await prisma.emailTracking.findFirst({
    where: {
      messageId: { in: possibleMessageIds },
      userId,
    },
  });

  if (!trackingEvent) return;

  const existingReply = await hasExistingReply(trackingEvent.hash, messageId);
  if (existingReply) return;

  console.log("📨 Found reply through message references");

  // TODO: fix this
  // await trackReplyEvent(
  //   trackingEvent,
  //   messageId,
  //   threadId,
  //   fromHeader,
  //   messageDetails
  // );
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const hasExistingReplyEvent = async (sequenceId: string, contactId: string) => {
  return prisma.emailEvent.findFirst({
    where: {
      sequenceId,
      contactId,
      type: "REPLIED",
    },
  });
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const hasExistingReply = async (trackingId: string, messageId: string) => {
  return prisma.emailEvent.findFirst({
    where: {
      trackingId: trackingId,
      type: "REPLIED",
      metadata: {
        path: ["replyMessageId"],
        equals: messageId,
      },
    },
  });
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const processReplyEvent = async (
  trackingEvent: TrackingEvent,
  messageId: string,
  threadId: string,
  fromHeader: string,
  messageDetails: GaxiosResponse<Message>,
  emailThread: EmailThread
) => {
  const snippet = messageDetails.data.snippet || undefined;

  console.log("✅ Tracked reply event for sequence:", emailThread.sequenceId);
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const trackReplyEvent = async (
  trackingEvent: TrackingEvent,
  messageId: string,
  threadId: string,
  fromHeader: string,
  messageDetails: GaxiosResponse<Message>
) => {
  const snippet = messageDetails.data.snippet || undefined;

  // TODO: fix this
  // await trackEmailEvent(
  //   trackingEvent.hash,
  //   "replied",
  //   {
  //     replyMessageId: messageId,
  //     threadId,
  //     from: fromHeader,
  //     ...(snippet && { snippet }),
  //     timestamp: new Date().toISOString(),
  //   },
  //   {
  //     email: trackingEvent.email,
  //     userId: trackingEvent.userId,
  //     sequenceId: trackingEvent.sequenceId,
  //     stepId: trackingEvent.stepId,
  //     contactId: trackingEvent.contactId,
  //   }
  // );

  console.log("✅ Tracked reply event through references");
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

const updateHistoryId = async (accountId: string, historyId?: string) => {
  if (historyId) {
    await prisma.account.update({
      where: { id: accountId },
      data: { watchHistoryId: historyId },
    });
  }
};

// For future reference
// async function processMessageForReplies(gmail: Gmail, messageId: string, userId: string) {
//   try {
//     const messageDetails = await getMessageHeaders(gmail, messageId, [
//       "From",
//       "References",
//       "In-Reply-To",
//       "Subject",
//       "To",
//       "Date",  // Add date header
//     ]);

//     // ... existing validation ...

//     // Add subject-based validation
//     const subject = headers.find(h => h.name === "Subject")?.value || "";
//     const isReplySubject = subject.toLowerCase().startsWith("re:") ||
//                           subject.toLowerCase().startsWith("reply:");

//     // Add participant validation
//     const to = headers.find(h => h.name === "To")?.value || "";
//     const toEmails = extractEmailFromHeader(to);

//     if (!isReplySubject && !references && !inReplyTo) {
//       console.log("Not a reply - missing reply indicators");
//       return;
//     }

//     // Continue with existing logic...
//   } catch (error) {
//     console.error("Error processing message for replies:", error);
//   }
// }
