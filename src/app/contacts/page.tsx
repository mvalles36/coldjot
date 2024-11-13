import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ContactList from "./ContactList";
import { Separator } from "@/components/ui/separator";

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const contacts = await prisma.contact.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground">
          Manage your contacts for email templates.
        </p>
      </div>
      <Separator />
      <ContactList initialContacts={contacts} />
    </div>
  );
}
