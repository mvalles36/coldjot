import { Metadata } from "next";
import { Users, Settings } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard for managing ColdJot",
};

const navItems = [
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-card border-r">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Admin</h1>
        </div>
        <nav className="px-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent text-sm font-medium"
            >
              <item.icon className="w-4 h-4" />
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="container py-6">{children}</div>
      </main>
    </div>
  );
}
