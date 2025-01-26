import { Metadata } from "next";
import { UsersClient } from "./users-client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Users Management",
  description: "Manage users of ColdJot",
};

export default async function UsersPage() {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground">
          Manage user accounts and permissions.
        </p>
      </div>
      <UsersClient />
    </div>
  );
}
