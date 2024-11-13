import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ContactList from "./ContactList";
import { Separator } from "@/components/ui/separator";

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      where: { userId: session.user.id },
      include: { company: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground">
          Manage your contacts and their associated companies.
        </p>
      </div>
      <Separator />
      <ContactList initialContacts={contacts} companies={companies} />
    </div>
  );
}
