import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// import { Toaster } from "react-hot-toast";
import { Toaster } from "@/components/ui/toaster";

import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "@/components/layout/Sidebar";
import { QueryProvider } from "@/providers/query-provider";

export const metadata: Metadata = {
  title: "Email Template Manager",
  description: "Manage your email templates and drafts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body className={``}>
        <Providers>
          <QueryProvider>
            <div className="flex h-screen">
              <div className="hidden w-64 shrink-0 md:block">
                <Sidebar />
              </div>
              {/* <>{console.log(process.env)}</> */}
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
            {/* <Toaster position="bottom-right" /> */}
            <Toaster />
          </QueryProvider>
        </Providers>
      </body>
    </html>
  );
}
