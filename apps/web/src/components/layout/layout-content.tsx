"use client";

import { usePathname } from "next/navigation";
import { EnvironmentBanner } from "./environment-banner";
import Sidebar from "./Sidebar";

// Pages that should not show the sidebar
const pagesWithoutSidebar = [
  "/auth/signin",
  "/auth/signup",
  "/legal/terms",
  "/legal/privacy",
];

function shouldHideSidebar(pathname: string) {
  return pagesWithoutSidebar.some((page) => pathname.startsWith(page));
}

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !shouldHideSidebar(pathname);

  return (
    <div className={`flex h-screen ${showSidebar ? "pt-8" : ""}`}>
      <EnvironmentBanner />
      {showSidebar && (
        <div className="hidden w-64 shrink-0 md:block">
          <Sidebar />
        </div>
      )}
      <main
        className={`flex-1 overflow-y-auto ${!showSidebar ? "w-full" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}
