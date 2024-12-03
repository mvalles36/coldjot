import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { setupGmailWatch } from "@/lib/google/gmail-watch";
export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // authorization: {
      //   params: {
      //     access_type: "offline",
      //     prompt: "consent",
      //     scope:
      //       "openid email profile https://www.googleapis.com/auth/gmail.compose",
      //   },
      // },

      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            // "openid email profile",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.compose",
            // "https://www.googleapis.com/auth/gmail.metadata",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/pubsub",
            "https://mail.google.com/", // Required for SMTP access
          ].join(" "),
        },
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && account.access_token) {
        try {
          // Ensure we save the user's email and name
          await prisma.user.update({
            where: { id: user.id! },
            data: {
              email: user.email,
              name: user.name,
            },
          });

          console.log("🚀 Setting up Gmail watch...");
          // Set up Gmail watch when user signs in with Google
          await setupGmailWatch({
            userId: user.id!,
            accessToken: account.access_token,
            topicName: process.env.GMAIL_WATCH_TOPIC!,
          });
        } catch (error) {
          console.error("Failed to setup Gmail watch:", error);
          // Don't block sign in if watch setup fails
        }
      }
      return true;
    },

    async session({ session, user, token }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      console.log("jwt", token, account, profile);
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.id = profile?.sub;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  // debug: process.env.NODE_ENV === "development",
};
