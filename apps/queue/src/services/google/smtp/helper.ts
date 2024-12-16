import { google } from "googleapis";
import quotedPrintable from "quoted-printable";
import { generateMessageId } from "@/utils";
import crypto from "crypto";

const quotedPrintableEncode = quotedPrintable.encode;
const quotedPrintableDecode = quotedPrintable.decode;

/**
 * Generate a unique MIME boundary
 */
export function generateMimeBoundary(): string {
  return `m${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
}

/**
 * Generate email headers
 */
export function generateEmailHeaders({
  fromHeader,
  to,
  subject,
  messageId,
  threadId,
  boundary,
  originalSubject,
  threadHeaders,
}: {
  fromHeader: string;
  to: string;
  subject: string;
  messageId: string;
  threadId?: string;
  boundary: string;
  originalSubject?: string;
  threadHeaders?: {
    messageId: string;
    inReplyTo?: string;
    references?: string[];
  };
}): string {
  // Ensure messageId has angle brackets
  const formattedMessageId = messageId.includes("<")
    ? messageId
    : `<${messageId}>`;

  // Format references with angle brackets if needed
  const formattedReferences = threadHeaders?.references?.map((ref) =>
    ref.includes("<") ? ref : `<${ref}>`
  );

  // Format In-Reply-To with angle brackets if needed
  const formattedInReplyTo = threadHeaders?.inReplyTo
    ? threadHeaders.inReplyTo.includes("<")
      ? threadHeaders.inReplyTo
      : `<${threadHeaders.inReplyTo}>`
    : undefined;

  const headers = [
    "MIME-Version: 1.0",
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${formattedMessageId}`,
    formattedInReplyTo ? `In-Reply-To: ${formattedInReplyTo}` : "",
    formattedReferences?.length
      ? `References: ${formattedReferences.join(" ")}`
      : threadId
        ? `References: <${threadId}>`
        : "",
    `Date: ${new Date().toUTCString()}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  // Log headers for debugging
  console.log("Generated Email Headers:", {
    messageId: formattedMessageId,
    inReplyTo: formattedInReplyTo,
    references: formattedReferences || threadId,
    subject,
    threadId,
  });

  return headers.filter(Boolean).join("\r\n");
}

/**
 * Generate MIME parts for the email
 */
export function generateMimeParts({
  boundary,
  plainText,
  originalContent,
  content,
}: {
  boundary: string;
  plainText: string;
  originalContent?: string;
  content: string;
}): {
  plainTextPart: string;
  senderPart: string;
  recipientPart: string;
} {
  const plainTextPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    quotedPrintableEncode(plainText),
    "",
  ].join("\r\n");

  const senderPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "X-View-Type: sender",
    "",
    quotedPrintableEncode(originalContent || content),
    "",
  ].join("\r\n");

  const recipientPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "X-View-Type: recipient",
    "",
    quotedPrintableEncode(content),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return { plainTextPart, senderPart, recipientPart };
}

/**
 * Convert HTML content to plain text
 */
export function convertToPlainText(content: string): string {
  return content
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
    .trim();
}

/**
 * Create Gmail OAuth2 client
 */
export function createGmailOAuth2Client(
  accessToken: string,
  refreshToken: string
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Format sender information
 */
export function formatSenderInfo(email: string, name?: string): string {
  return name ? `${name} <${email}>` : email;
}

/**
 * Process email content for debeaconization
 */
export async function debeaconizeContent(content: string): Promise<string> {
  // First decode the quoted-printable content if it is encoded
  let decodedContent = content;
  try {
    if (content.includes("=3D") || content.includes("=20")) {
      decodedContent = quotedPrintableDecode(content);
    }
  } catch (error) {
    console.log("Error decoding quoted-printable content:", error);
  }

  // Replace tracking pixel with transparent GIF
  const transparentGif =
    "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=";

  // Replace tracking pixels with base64 encoded transparent GIF
  let debeaconized = decodedContent.replace(
    /<img[^>]*src="[^"]*\/api\/track\/[^"]*\.png"[^>]*>/g,
    `<img src="${transparentGif}" alt="" style="display:none" width="1" height="1">`
  );

  // Re-encode as quoted-printable, but preserve the base64 encoded GIF
  return quotedPrintableEncode(debeaconized).replace(
    new RegExp(quotedPrintableEncode(transparentGif), "g"),
    transparentGif
  );
}

/**
 * Process email parts for debeaconization
 */
export async function processEmailParts(
  parts: string[],
  boundary: string
): Promise<string[]> {
  return await Promise.all(
    parts.map(async (part) => {
      const [partHeaders, ...partContent] = part.trim().split("\r\n\r\n");
      const content = partContent.join("\r\n\r\n");

      if (partHeaders.includes("Content-Type: text/html")) {
        const debeaconized = await debeaconizeContent(content);
        return `${partHeaders}\r\n\r\n${debeaconized}`;
      }
      return `${partHeaders}\r\n\r\n${content}`;
    })
  );
}

/**
 * Generate a debeaconized ID
 */
export function generateDebeaconizedId(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Convert email content to base64url format
 */
export function convertToBase64UrlFormat(content: string): string {
  return Buffer.from(content)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Parse MIME boundary from headers
 */
export function parseMimeBoundary(headers: string): string {
  const boundaryMatch = headers.match(/boundary="([^"]+)"/);
  if (!boundaryMatch) {
    throw new Error("Could not find boundary in email headers");
  }
  return boundaryMatch[1];
}

/**
 * Split email into headers and body parts
 */
export function splitEmailContent(emailContent: string): {
  headers: string;
  body: string;
} {
  const [headers, ...bodyParts] = emailContent.split("\r\n\r\n");
  return {
    headers,
    body: bodyParts.join("\r\n\r\n"),
  };
}

/**
 * Create mail options for nodemailer
 */
export function createMailOptions(
  senderEmail: string,
  to: string,
  headers: string,
  plainTextPart: string,
  senderPart: string,
  recipientPart: string
) {
  return {
    envelope: {
      from: senderEmail,
      to: [to],
    },
    raw: [headers, "", plainTextPart, senderPart, recipientPart].join("\r\n"),
  };
}
