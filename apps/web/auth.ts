import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@coldjot/database";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // session: { strategy: "jwt" },
  ...authConfig,
});
