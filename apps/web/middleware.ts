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

// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";
// import { auth } from "@/auth";

// // List of paths that don't require authentication
// const publicPaths = [
//   "/login",
//   "/auth/signin",
//   "/legal/terms",
//   "/legal/privacy",
// ];

// export async function middleware(request: NextRequest) {
//   const session = await auth();
//   const { pathname } = request.nextUrl;

//   // Check if the path is public
//   const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

//   // If the path is public and user is logged in, redirect to home
//   if (isPublicPath && session) {
//     return NextResponse.redirect(new URL("/", request.url));
//   }

//   // If the path is private and user is not logged in, redirect to login
//   if (!isPublicPath && !session) {
//     return NextResponse.redirect(new URL("/login", request.url));
//   }

//   return NextResponse.next();
// }

// // Configure which paths should trigger the middleware
// export const config = {
//   // Exclude paths that don't need authentication check (e.g. api routes, static files)
//   matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
// };
