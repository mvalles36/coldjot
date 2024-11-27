import { TrackingOptions } from "@/lib/email";
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

// Add new interface for tracking metadata
interface TrackingMetadata {
  emailId: string;
  userId: string;
  timestamp: number;
}

// Generate a unique tracking hash
const generateTrackingHash = (metadata: TrackingMetadata): string => {
  const data = `${metadata.emailId}:${metadata.userId}:${metadata.timestamp}`;
  return createHash("sha256").update(data).digest("hex");
};

export const generateTrackingPixel = ({
  emailId,
  userId,
}: TrackingOptions): string => {
  try {
    const baseUrl = getBaseUrl();
    const metadata: TrackingMetadata = {
      emailId,
      userId,
      timestamp: Date.now(),
    };

    const trackingHash = generateTrackingHash(metadata);
    const trackingUrl = new URL(
      `${baseUrl}/api/track/mail/${trackingHash}.png`
    );

    // Add metadata as query params
    trackingUrl.searchParams.set("u", userId);

    if (process.env.NODE_ENV === "development") {
      return `
        <!-- Email Open Tracking -->
        <div style="color: #666; font-size: 6px; margin-top: 10px; text-align: center;">
          <img src="${trackingUrl.toString()}" 
               width="1" 
               height="1" 
               alt="" 
               style="display:inline" />
          <br/>
          <a href="${trackingUrl.toString()}" target="_blank">View Tracking Pixel</a>
        </div>
      `;
    }

    // In production, use a more discreet tracking pixel
    return `<img src="${trackingUrl.toString()}" 
                  width="0" 
                  height="0" 
                  alt="" 
                  style="display:none;width:0;height:0;opacity:0" />`;
  } catch (error) {
    console.error("Error generating tracking pixel:", error);
    return "";
  }
};

export const wrapLinksWithTracking = (
  content: string,
  { emailId, userId, sequenceId }: TrackingOptions
): string => {
  try {
    const baseUrl = getBaseUrl();
    const trackingBaseUrl = `${baseUrl}/api/track/click`;

    return content.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match, quote, url) => {
        try {
          const trackingUrl = new URL(trackingBaseUrl);
          trackingUrl.searchParams.set("emailId", emailId);
          trackingUrl.searchParams.set("userId", userId);
          if (sequenceId) {
            trackingUrl.searchParams.set("sequenceId", sequenceId);
          }
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
