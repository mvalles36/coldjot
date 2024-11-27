import { EmailTrackingMetadata } from "@/types/sequences";
import { createHash } from "crypto";

// Sleep utility
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Message ID generation
export const generateMessageId = () => {
  const domain = process.env.EMAIL_DOMAIN || "gmail.com";
  return `<${Date.now()}.${Math.random().toString(36).substring(2)}@${domain}>`;
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

// URL and tracking utilities
export const getBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) {
    console.warn("NEXT_PUBLIC_APP_URL is not set, using fallback URL");
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL;
    }
    return process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://app.zkmail.io";
  }
  return url;
};

// Generate a unique tracking hash
const generateTrackingHash = (metadata: EmailTrackingMetadata): string => {
  const data = `${metadata.email}:${metadata.userId}:${metadata.sequenceId}`;
  return createHash("sha256").update(data).digest("hex");
};

export const generateTrackingPixel = (
  metadata: EmailTrackingMetadata
): string => {
  try {
    const baseUrl = getBaseUrl();
    const trackingHash = generateTrackingHash(metadata);
    const trackingUrl = new URL(`${baseUrl}/api/track/${trackingHash}.png`);

    // Return a minimal tracking pixel with just the hash
    return `<img src="${trackingUrl.toString()}" alt="" style="display:none" width="1" height="1" />`;
  } catch (error) {
    console.error("Error generating tracking pixel:", error);
    return "";
  }
};

export const wrapLinksWithTracking = (
  content: string,
  metadata: EmailTrackingMetadata
): string => {
  try {
    const baseUrl = getBaseUrl();
    const trackingHash = generateTrackingHash(metadata);
    const trackingBaseUrl = `${baseUrl}/api/track/${trackingHash}/click`;

    return content.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match, quote, url) => {
        try {
          // Only add the target URL as a query param
          const trackingUrl = new URL(trackingBaseUrl);
          trackingUrl.searchParams.set("url", url);

          return `<a href="${trackingUrl.toString()}"`;
        } catch (error) {
          console.error("Error wrapping link with tracking:", error);
          return match;
        }
      }
    );
  } catch (error) {
    console.error("Error in link tracking:", error);
    return content;
  }
};
