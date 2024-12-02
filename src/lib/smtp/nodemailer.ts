import nodemailer from "nodemailer";
import { google } from "googleapis";
import { createTransport, TransportOptions } from "nodemailer";

export async function createGmailTransport(
  accessToken: string,
  refreshToken: string
) {
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  // Set credentials
  await oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Create SMTP transport
  const transport = await nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_EMAIL,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: refreshToken,
      accessToken: accessToken,
      expires: 3599, // Default token expiry time in seconds
    },
    pool: true, // Use pooled connections
    maxConnections: 5, // Maximum number of simultaneous connections
    maxMessages: 100, // Maximum number of messages per connection
    rateDelta: 1000, // How many milliseconds between messages
    rateLimit: 5, // Maximum number of messages per rateDelta
  } as TransportOptions);

  // Verify SMTP connection configuration
  try {
    await new Promise((resolve, reject) => {
      transport.verify((error) => {
        if (error) {
          console.error("SMTP Connection Error:", error);
          reject(error);
        } else {
          console.log("SMTP Connection Successful");
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error("Failed to verify SMTP connection:", error);
    throw error;
  }

  return transport;
}
