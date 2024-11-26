import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

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
          ].join(" "),
        },
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  callbacks: {
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
