import type { MessagePartHeader } from "@mailjot/types";
import { NextRequest } from "next/server";

// Message ID generation
export const generateMessageId = (): string => {
  const domain = process.env.EMAIL_DOMAIN || "gmail.com";
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2);
  return `<${timestamp}.${randomPart}@${domain}>`;
};

export const normalizeMessageId = (messageId: string): string => {
  if (!messageId) return "";
  return messageId.includes("@") ? messageId : `<${messageId}@gmail.com>`;
};

// MIME and subject handling
export const encodeMIMEWords = (text: string): string => {
  if (!/^[\x00-\x7F]*$/.test(text)) {
    const encoded = Buffer.from(text, "utf-8").toString("base64");
    return `=?UTF-8?B?${encoded}?=`;
  }
  return text;
};

export const normalizeSubject = (
  subject: string,
  isReply: boolean,
  originalSubject?: string
): string => {
  const baseSubject = isReply && originalSubject ? originalSubject : subject;
  const cleanSubject = baseSubject.replace(/^(Re:\s*)+/i, "").trim();
  const finalSubject = isReply ? `Re: ${cleanSubject}` : cleanSubject;
  return encodeMIMEWords(finalSubject);
};
// ----------------------------------------------------------------------------

// Helper Functions
export const extractEmailFromHeader = (fromHeader: string): string => {
  return fromHeader.match(/<(.+?)>|(.+)/)?.[1] || fromHeader;
};

// ----------------------------------------------------------------------------

export const isSenderSequenceOwner = (
  senderEmail: string,
  userId: string
): boolean => {
  return senderEmail.toLowerCase() === userId.toLowerCase();
};

// ----------------------------------------------------------------------------

// Helper functions for bounce processing
export const isBounceMessage = (
  headers: MessagePartHeader[],
  labelIds: string[]
) => {
  return (
    (labelIds.includes("UNDELIVERABLE") &&
      headers.some(
        (h) => h.name === "From" && h.value?.includes("mailer-daemon")
      )) ||
    headers.some((h) => h.name === "X-Failed-Recipients") ||
    headers.some(
      (h) =>
        h.name === "Content-Type" &&
        h.value?.includes("report-type=delivery-status")
    )
  );
};

// ----------------------------------------------------------------------------

// Helper functions for reply processing
export const shouldProcessMessage = (labelIds: string[]): boolean => {
  return !(
    labelIds.includes("SENT") ||
    labelIds.includes("DRAFT") ||
    !labelIds.includes("INBOX")
  );
};

// ----------------------------------------------------------------------------

export const extractPossibleMessageIds = (
  headers: MessagePartHeader[]
): string[] => {
  const inReplyTo = headers
    .find((h) => h.name === "In-Reply-To")
    ?.value?.replace(/[<>]/g, "");
  const references = headers
    .find((h) => h.name === "References")
    ?.value?.split(/\s+/)
    .map((ref) => ref.replace(/[<>]/g, ""));

  return [inReplyTo, ...(references || [])].filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
};

// ----------------------------------------------------------------------------

// Helper functions for POST handler
export const validateAuthorization = async (
  req: NextRequest
): Promise<string | null> => {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.replace("Bearer ", "");
};
