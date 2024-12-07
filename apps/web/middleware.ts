// import { auth } from "@/app/auth";

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
export const { auth } = NextAuth(authConfig);

import { NextRequest } from "next/server";

// export default auth(async (req: NextRequest) => {
export default async function middleware(req: NextRequest) {
  //   const isLoggedIn = !!req.auth;
  const isLoggedIn = await auth(req as any);
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");

  if (isApiAuthRoute || isAuthPage) {
    return null;
  }

  if (!isLoggedIn) {
    return Response.redirect(new URL("/auth/signin", req.nextUrl));
  }
  return null;
}

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
