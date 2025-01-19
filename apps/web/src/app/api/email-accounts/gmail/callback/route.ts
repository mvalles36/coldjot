import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@coldjot/database";
import { decrypt } from "@/lib/crypto";

// Verify credentials are loaded
if (
  !process.env.GOOGLE_CLIENT_ID_EMAIL ||
  !process.env.GOOGLE_CLIENT_SECRET_EMAIL
) {
  console.error("Missing Gmail OAuth credentials for email accounts");
  throw new Error("Missing Gmail OAuth credentials for email accounts");
}

export async function GET(request: Request) {
  const oauth2Client = await new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID_EMAIL,
    process.env.GOOGLE_CLIENT_SECRET_EMAIL,
    `http://localhost:3000/api/email-accounts/gmail/callback`
  );

  try {
    console.log(oauth2Client);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Log all search params for debugging
    console.log("Callback Parameters:", {
      code: code?.slice(0, 30) + "...",
      state,
      error,
      scope: searchParams.get("scope"),
    });

    if (error) {
      console.error("[GMAIL_CALLBACK] OAuth Error:", error);
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=gmail_auth_failed&reason=${error}`
      );
    }

    if (!code || !state) {
      console.error("[GMAIL_CALLBACK] Missing code or state");
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=invalid_request`
      );
    }

    // Log OAuth configuration
    console.log("OAuth Configuration:", {
      clientId: process.env.GOOGLE_CLIENT_ID_EMAIL?.slice(0, 30) + "...",
      redirectUri: `http://localhost:3000/api/email-accounts/gmail/callback`,
    });

    const userId = decrypt(state);

    try {
      // Get tokens from code
      const { tokens } = await oauth2Client.getToken(code);
      console.log("Tokens:", tokens);

      await oauth2Client.setCredentials(tokens);

      // Log token info (without sensitive data)
      console.log("Token Info:", {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        tokenType: tokens.token_type,
      });

      // Get user info from Google
      const oauth2 = google.oauth2("v2");
      const { data: userInfo } = await oauth2.userinfo.get({
        auth: oauth2Client,
      });

      if (!userInfo.email) {
        throw new Error("No email found in Google account");
      }

      // Log user info (without sensitive data)
      console.log("User Info:", {
        email: userInfo.email,
        hasName: !!userInfo.name,
      });

      // Check if this email is already connected
      const existingAccount = await prisma.emailAccount.findUnique({
        where: {
          userId_email: {
            userId,
            email: userInfo.email,
          },
        },
      });

      if (existingAccount) {
        // Update existing account
        await prisma.emailAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date
              ? Math.floor(tokens.expiry_date / 1000)
              : null,
            name: userInfo.name || null,
          },
        });
        console.log("Updated existing email account");
      } else {
        // Create new account
        await prisma.emailAccount.create({
          data: {
            userId,
            email: userInfo.email,
            name: userInfo.name || null,
            provider: "gmail",
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date
              ? Math.floor(tokens.expiry_date / 1000)
              : null,
            // If this is the first account, make it default
            isDefault: !(await prisma.emailAccount.findFirst({
              where: { userId, isDefault: true },
            })),
          },
        });
        console.log("Created new email account");
      }

      // Redirect back to settings page
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=gmail_connected`
      );
    } catch (tokenError: any) {
      console.error("[GMAIL_CALLBACK] Token Error:", {
        message: tokenError.message,
        response: tokenError.response?.data,
      });
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=gmail_auth_failed&reason=token_error`
      );
    }
  } catch (error: any) {
    console.error("[GMAIL_CALLBACK] Error:", {
      message: error.message,
      stack: error.stack,
    });
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=gmail_auth_failed&reason=unexpected_error`
    );
  }
}
