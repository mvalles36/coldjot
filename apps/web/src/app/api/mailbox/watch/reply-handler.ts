/**
 * Gmail Reply Handler
 * 
 * This module processes Gmail notifications, detects campaign replies,
 * performs sentiment analysis, and updates contact status accordingly.
 */

import { prisma } from "@/lib/prisma";
import { getGmailEmail } from "@/lib/google/gmail";
import { CallStatus } from "@coldjot/types";
import {
  analyzeEmailSentiment as mistralAnalyze,
} from "@/lib/ai/mistral";

// Sentiment categories
export enum ReplySentiment {
  POSITIVE = "positive",
  NEGATIVE = "negative",
  NEUTRAL = "neutral",
  INTERESTED = "interested",
  NOT_INTERESTED = "not_interested",
  APPOINTMENT_REQUEST = "appointment_request",
  QUESTION = "question",
  SPAM_COMPLAINT = "spam_complaint",
  UNSUBSCRIBE = "unsubscribe",
}

// Interface for reply analysis result
interface ReplyAnalysis {
  sentiment: ReplySentiment;
  intentScore: number; // 0-100 score of likelihood to convert
  summary: string;
  appointmentRequested: boolean;
  doNotContact: boolean;
}

/**
 * Process a Gmail notification for a reply
 * 
 * @param userId User ID who owns the mailbox
 * @param historyId Gmail history ID
 * @param messageId Gmail message ID
 * @param threadId Gmail thread ID
 */
export async function processReply(
  userId: string,
  historyId: string,
  messageId: string,
  threadId: string
): Promise<boolean> {
  try {
    // Check if this message has already been processed
    const existingProcessed = await prisma.processedMessage.findUnique({
      where: { messageId },
    });

    if (existingProcessed) {
      console.log(`Message ${messageId} already processed, skipping`);
      return true;
    }

    // Find the email thread in our database
    const emailThread = await prisma.emailThread.findUnique({
      where: { threadId },
      include: {
        sequence: true,
        contact: true,
      },
    });

    // If no thread found, this isn't a campaign reply
    if (!emailThread) {
      console.log(`No email thread found for threadId: ${threadId}`);
      
      // Mark as processed to avoid reprocessing
      await prisma.processedMessage.create({
        data: {
          messageId,
          threadId,
          type: "non_campaign_reply",
          processed: true,
        },
      });
      
      return false;
    }

    // Get the full message content from Gmail API
    const message = await getGmailEmail(userId, messageId);
    
    if (!message || !message.payload) {
      console.error(`Failed to fetch message content for ${messageId}`);
      return false;
    }

    // Extract message content
    const messageContent = extractMessageContent(message);
    
    // Analyze reply with AI
    const analysis = await analyzeReply(messageContent);
    
    // Update contact status based on analysis
    await updateContactStatus(
      emailThread.contactId,
      emailThread.sequenceId,
      analysis
    );
    
    // Store reply information in contact record
    await updateContactWithReply(
      emailThread.contactId,
      messageId,
      threadId,
      analysis
    );
    
    // Mark message as processed
    await prisma.processedMessage.create({
      data: {
        messageId,
        threadId,
        type: "campaign_reply",
        processed: true,
      },
    });
    
    // Create an email event for the reply
    await prisma.emailEvent.create({
      data: {
        type: "replied",
        trackingId: emailThread.id,
        contactId: emailThread.contactId,
        sequenceId: emailThread.sequenceId,
        metadata: {
          sentiment: analysis.sentiment,
          intentScore: analysis.intentScore,
          summary: analysis.summary,
          appointmentRequested: analysis.appointmentRequested,
        },
      },
    });
    
    return true;
  } catch (error) {
    console.error("Error processing reply:", error);
    return false;
  }
}

/**
 * Extract plain text content from Gmail message
 */
function extractMessageContent(message: any): string {
  try {
    // Try to get plain text part first
    const parts = message.payload.parts || [];
    const textPart = parts.find(
      (part: any) => part.mimeType === "text/plain"
    );
    
    if (textPart && textPart.body && textPart.body.data) {
      const buff = Buffer.from(textPart.body.data, "base64");
      return buff.toString("utf-8");
    }
    
    // If no plain text, try HTML part and convert to text
    const htmlPart = parts.find(
      (part: any) => part.mimeType === "text/html"
    );
    
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      const buff = Buffer.from(htmlPart.body.data, "base64");
      const html = buff.toString("utf-8");
      // Simple HTML to text conversion
      return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
    
    // If no parts, try the body directly
    if (message.payload.body && message.payload.body.data) {
      const buff = Buffer.from(message.payload.body.data, "base64");
      return buff.toString("utf-8");
    }
    
    return "";
  } catch (error) {
    console.error("Error extracting message content:", error);
    return "";
  }
}

/**
 * Analyze reply content using OpenAI to determine sentiment and intent
 */
async function analyzeReply(content: string): Promise<ReplyAnalysis> {
  const fallback: ReplyAnalysis = {
    sentiment: ReplySentiment.NEUTRAL,
    intentScore: 50,
    summary: "No sentiment analysis available",
    appointmentRequested: false,
    doNotContact: false,
  };

  try {
    const analysis = await mistralAnalyze(content);

    if (!analysis) return fallback;

    return {
      sentiment: mapIntentToSentiment(analysis.intent),
      intentScore: analysis.intentScore,
      summary: analysis.summary,
      appointmentRequested: analysis.appointmentRequested,
      doNotContact: analysis.doNotContact,
    };
  } catch (error) {
    console.error("Error analyzing reply with Mistral:", error);
    return fallback;
  }
}

/**
 * Map intent category to sentiment enum
 */
function mapIntentToSentiment(intent: string): ReplySentiment {
  switch (intent) {
    case "interested":
      return ReplySentiment.INTERESTED;
    case "not_interested":
      return ReplySentiment.NOT_INTERESTED;
    case "appointment_request":
      return ReplySentiment.APPOINTMENT_REQUEST;
    case "question":
      return ReplySentiment.NEUTRAL;
    case "spam_complaint":
      return ReplySentiment.SPAM_COMPLAINT;
    case "unsubscribe":
      return ReplySentiment.UNSUBSCRIBE;
    default:
      return ReplySentiment.NEUTRAL;
  }
}

/**
 * Update contact status in sequence based on reply analysis
 */
async function updateContactStatus(
  contactId: string,
  sequenceId: string,
  analysis: ReplyAnalysis
): Promise<void> {
  try {
    // Get current sequence contact
    const sequenceContact = await prisma.sequenceContact.findFirst({
      where: {
        contactId,
        sequenceId,
      },
    });
    
    if (!sequenceContact) {
      console.log(`No sequence contact found for ${contactId} in ${sequenceId}`);
      return;
    }
    
    // Determine new status based on analysis
    let newStatus = sequenceContact.status;
    let completed = sequenceContact.completed;
    
    if (analysis.appointmentRequested) {
      newStatus = CallStatus.APPOINTMENT_SET;
      completed = true;
    } else if (analysis.doNotContact) {
      newStatus = CallStatus.DO_NOT_CALL;
      completed = true;
    } else if (analysis.sentiment === ReplySentiment.NOT_INTERESTED) {
      newStatus = CallStatus.NO_INTEREST;
      completed = true;
    } else {
      // For other sentiments, mark as replied but don't complete
      newStatus = "replied";
    }
    
    // Update sequence contact
    await prisma.sequenceContact.update({
      where: { id: sequenceContact.id },
      data: {
        status: newStatus,
        completed,
        completedAt: completed ? new Date() : undefined,
      },
    });
    
    console.log(`Updated contact ${contactId} status to ${newStatus} in sequence ${sequenceId}`);
  } catch (error) {
    console.error("Error updating contact status:", error);
  }
}

/**
 * Update contact record with reply information
 */
async function updateContactWithReply(
  contactId: string,
  messageId: string,
  threadId: string,
  analysis: ReplyAnalysis
): Promise<void> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });
    
    if (!contact) {
      console.log(`Contact ${contactId} not found`);
      return;
    }
    
    // Get existing metadata or initialize empty object
    const metadata = contact.metadata as Record<string, any> || {};
    
    // Update metadata with reply information
    const updatedMetadata = {
      ...metadata,
      lastReplyAt: new Date().toISOString(),
      lastReplySentiment: analysis.sentiment,
      lastReplyIntentScore: analysis.intentScore,
      lastReplySummary: analysis.summary,
      lastReplyMessageId: messageId,
      lastReplyThreadId: threadId,
      // Store reply history
      replyHistory: [
        ...(metadata.replyHistory || []),
        {
          timestamp: new Date().toISOString(),
          messageId,
          threadId,
          sentiment: analysis.sentiment,
          intentScore: analysis.intentScore,
          summary: analysis.summary,
        },
      ],
    };
    
    // Update contact
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        metadata: updatedMetadata,
      },
    });
    
    console.log(`Updated contact ${contactId} with reply information`);
  } catch (error) {
    console.error("Error updating contact with reply:", error);
  }
}
