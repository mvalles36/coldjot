import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "react-hot-toast";

import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "@/components/layout/Sidebar";

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
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <Providers>
          <div className="flex h-screen">
            <div className="hidden w-64 shrink-0 border-r md:block">
              <Sidebar />
            </div>
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
