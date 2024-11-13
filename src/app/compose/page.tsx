import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Separator } from "@/components/ui/separator";
import EmailComposer from "./EmailComposer";

export default async function ComposePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Fetch contacts and templates for the user
  const [contacts, templates] = await Promise.all([
    prisma.contact.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
    prisma.template.findMany({
      where: { userId: session.user.id },
      include: {
        sections: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compose Email</h1>
        <p className="text-muted-foreground">
          Create a new email using your templates and contacts.
        </p>
      </div>
      <Separator />
      <EmailComposer contacts={contacts} templates={templates} />
    </div>
  );
}
