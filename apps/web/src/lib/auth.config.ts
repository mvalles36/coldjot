import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@coldjot/database";
import { setupGmailWatch } from "@/lib/google/gmail-watch";

declare module "next-auth" {
  interface Session {
    error?: "RefreshTokenError";
  }
}

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
          console.log("🚀 Signing in with Google...");
          console.log(user, account, profile);
          // Ensure we save the user's email and name
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: account.providerAccountId,
              },
            },
          });

          if (existingAccount) {
            await prisma.account.update({
              where: {
                provider_providerAccountId: {
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                },
              },
              data: {
                access_token: account.access_token,
                expires_at: account.expires_at,
                refresh_token: account.refresh_token,
              },
            });
          } else {
            if (!user.id) return false;
            // await prisma.account.create({
            //   data: {
            //     provider: "google",
            //     providerAccountId: account.providerAccountId,
            //     access_token: account.access_token,
            //     expires_at: account.expires_at,
            //     refresh_token: account.refresh_token,
            //     userId: user.id,
            //     type: "oauth",
            //   },
            // });
          }

          console.log("🚀 Setting up Gmail watch...");
          // Set up Gmail watch when user signs in with Google
          // TODO: Only setup watch if user has no watch already

          // add 3 seconds delay
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // TODO: Uncomment this when we have a way to check if the user already has a watch
          // await setupGmailWatch({
          //   userId: user.id!,
          //   accessToken: account.access_token,
          //   topicName: process.env.GMAIL_WATCH_TOPIC!,
          // });
        } catch (error) {
          console.error("Failed to setup Gmail watch:", error);
          // Don't block sign in if watch setup fails
        }
      }
      return true;
    },

    async session({ session, user }) {
      const [googleAccount] = await prisma.account.findMany({
        where: { userId: user.id, provider: "google" },
      });
      if (
        googleAccount &&
        googleAccount.expires_at &&
        googleAccount.expires_at * 1000 < Date.now()
      ) {
        // If the access token has expired, try to refresh it
        try {
          // https://accounts.google.com/.well-known/openid-configuration
          // We need the `token_endpoint`.
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: googleAccount.refresh_token ?? "",
            }),
          });

          const tokensOrError = await response.json();

          if (!response.ok) throw tokensOrError;

          const newTokens = tokensOrError as {
            access_token: string;
            expires_in: number;
            refresh_token?: string;
          };

          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: googleAccount.providerAccountId,
              },
            },
          });

          if (existingAccount) {
            await prisma.account.update({
              data: {
                access_token: newTokens.access_token,
                expires_at: Math.floor(
                  Date.now() / 1000 + newTokens.expires_in
                ),
                refresh_token:
                  newTokens.refresh_token ?? googleAccount.refresh_token,
              },
              where: {
                provider_providerAccountId: {
                  provider: "google",
                  providerAccountId: googleAccount.providerAccountId,
                },
              },
            });
          }
        } catch (error) {
          console.error("Error refreshing access_token", error);
          // If we fail to refresh the token, return an error so we can handle it on the page
          session.error = "RefreshTokenError";
        }
      }
      return session;
    },

    async jwt({ token, account, profile }) {
      console.log("jwt", token, account, profile);
      if (account && account.refresh_token) {
        // Save new refresh token
        token.refresh_token = account.refresh_token;
        token.access_token = account.access_token;
        token.expires_at = account.expires_at;

        // Check if account exists first
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
          },
        });

        if (existingAccount) {
          // Only update if account exists
          await prisma.account.update({
            data: {
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
            },
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: account.providerAccountId,
              },
            },
          });
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  // debug: process.env.NODE_ENV === "development",
};

// import NextAuth from "next-auth"
// import Google from "next-auth/providers/google"
// import { PrismaAdapter } from "@auth/prisma-adapter"
// import { PrismaClient } from "@prisma/client"

// const prisma = new PrismaClient()

// export const { handlers, signIn, signOut, auth } = NextAuth({
//   adapter: PrismaAdapter(prisma),
//   providers: [
//     Google({
//       authorization: { params: { access_type: "offline", prompt: "consent" } },
//     }),
//   ],
//   callbacks: {
//     async session({ session, user }) {
//       const [googleAccount] = await prisma.account.findMany({
//         where: { userId: user.id, provider: "google" },
//       })
//       if (googleAccount.expires_at * 1000 < Date.now()) {
//         // If the access token has expired, try to refresh it
//         try {
//           // https://accounts.google.com/.well-known/openid-configuration
//           // We need the `token_endpoint`.
//           const response = await fetch("https://oauth2.googleapis.com/token", {
//             method: "POST",
//             body: new URLSearchParams({
//               client_id: process.env.AUTH_GOOGLE_ID!,
//               client_secret: process.env.AUTH_GOOGLE_SECRET!,
//               grant_type: "refresh_token",
//               refresh_token: googleAccount.refresh_token,
//             }),
//           })

//           const tokensOrError = await response.json()

//           if (!response.ok) throw tokensOrError

//           const newTokens = tokensOrError as {
//             access_token: string
//             expires_in: number
//             refresh_token?: string
//           }

//           await prisma.account.update({
//             data: {
//               access_token: newTokens.access_token,
//               expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
//               refresh_token:
//                 newTokens.refresh_token ?? googleAccount.refresh_token,
//             },
//             where: {
//               provider_providerAccountId: {
//                 provider: "google",
//                 providerAccountId: googleAccount.providerAccountId,
//               },
//             },
//           })
//         } catch (error) {
//           console.error("Error refreshing access_token", error)
//           // If we fail to refresh the token, return an error so we can handle it on the page
//           session.error = "RefreshTokenError"
//         }
//       }
//       return session
//     },
//   },
// })
