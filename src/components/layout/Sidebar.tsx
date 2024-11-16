"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  FileText,
  Mail,
  Settings,
  Building2,
  Menu,
  X,
  ChevronLeft,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

const composeRoute = {
  label: "Compose",
  icon: Mail,
  href: "/compose",
  isPrimary: true,
};

const managementRoutes = [
  {
    label: "Home",
    icon: Home,
    href: "/",
  },
  {
    label: "Contacts",
    icon: Users,
    href: "/contacts",
  },
  {
    label: "Companies",
    icon: Building2,
    href: "/companies",
  },
  {
    label: "Templates",
    icon: FileText,
    href: "/templates",
  },
];

const otherRoutes = [
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

const apolloRoute = {
  label: "Apollo Search",
  icon: Sparkles,
  secondaryIcon: Search,
  href: "/apollo",
  description: "Find new prospects",
};

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: session } = useSession();

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3
      className={cn(
        "text-xs font-semibold text-muted-foreground px-3 mb-2",
        isCollapsed && "hidden"
      )}
    >
      {children}
    </h3>
  );

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r bg-white transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 font-semibold tracking-tight",
            isCollapsed && "justify-center"
          )}
        >
          <Mail className="h-6 w-6 text-gray-700" />
          <span
            className={cn(
              "transition-all duration-300",
              isCollapsed && "hidden w-0 opacity-0"
            )}
          >
            ZKMail
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 transition-all duration-300",
            isCollapsed ? "ml-auto" : "ml-auto"
          )}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-all",
              isCollapsed && "rotate-180"
            )}
          />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-6 py-4">
          {/* Compose Section */}
          <div>
            <Link
              href={composeRoute.href}
              className={cn(
                "flex w-full items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                isCollapsed && "justify-center px-2"
              )}
            >
              <composeRoute.icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  "transition-all duration-300",
                  isCollapsed && "hidden w-0 opacity-0"
                )}
              >
                {composeRoute.label}
              </span>
            </Link>
          </div>

          {/* Management Section */}
          <div className="space-y-2">
            <SectionTitle>Management</SectionTitle>
            {managementRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-gray-100",
                  "text-gray-500 hover:text-gray-900",
                  pathname === route.href && "bg-gray-100 text-gray-900",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <route.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    pathname === route.href ? "text-gray-900" : "text-gray-500"
                  )}
                />
                <span
                  className={cn(
                    "transition-all duration-300",
                    isCollapsed && "hidden w-0 opacity-0"
                  )}
                >
                  {route.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Tools Section */}
          <div className="space-y-2">
            <SectionTitle>Tools</SectionTitle>
            <Link
              href={apolloRoute.href}
              className={cn(
                "flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-gray-100",
                "text-gray-500 hover:text-gray-900 group",
                pathname === apolloRoute.href && "bg-gray-100 text-gray-900",
                isCollapsed && "justify-center px-2"
              )}
            >
              <div className="relative">
                <apolloRoute.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    pathname === apolloRoute.href
                      ? "text-gray-900"
                      : "text-gray-500"
                  )}
                />
                <apolloRoute.secondaryIcon className="h-3 w-3 absolute -right-1 -bottom-1 text-primary" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span>{apolloRoute.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {apolloRoute.description}
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* System Section */}
          <div className="space-y-2">
            <SectionTitle>System</SectionTitle>
            {otherRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-gray-100",
                  "text-gray-500 hover:text-gray-900",
                  pathname === route.href && "bg-gray-100 text-gray-900",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <route.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    pathname === route.href ? "text-gray-900" : "text-gray-500"
                  )}
                />
                <span
                  className={cn(
                    "transition-all duration-300",
                    isCollapsed && "hidden w-0 opacity-0"
                  )}
                >
                  {route.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>
      {session?.user && (
        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2 px-2",
                  isCollapsed && "justify-center"
                )}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={session.user.image || ""} />
                  <AvatarFallback>
                    {session.user.name?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "truncate transition-all duration-300",
                    isCollapsed && "hidden w-0 opacity-0"
                  )}
                >
                  {session.user.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[200px]"
              side="right"
              sideOffset={18}
            >
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-red-600"
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
