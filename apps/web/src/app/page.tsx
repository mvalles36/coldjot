import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, Users, FileText, Building2 } from "lucide-react";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-semibold mb-8">Welcome to ColdJot</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/sequences">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <Mail className="h-8 w-8" />
            <span>Email Sequences</span>
          </Button>
        </Link>

        <Link href="/contacts">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <Users className="h-8 w-8" />
            <span>Contacts</span>
          </Button>
        </Link>

        <Link href="/templates">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <FileText className="h-8 w-8" />
            <span>Templates</span>
          </Button>
        </Link>

        <Link href="/organizations">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <Building2 className="h-8 w-8" />
            <span>Organizations</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
