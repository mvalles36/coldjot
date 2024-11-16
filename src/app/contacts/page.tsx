import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ContactList from "./ContactList";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/PageHeader";
import { Contact, Company } from "@prisma/client";

type ContactWithCompany = Contact & {
  company: Company | null;
};

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
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage your contacts and their associated companies."
      />
      <Separator />
      <ContactList
        initialContacts={contacts as ContactWithCompany[]}
        companies={companies}
      />
    </div>
  );
}
