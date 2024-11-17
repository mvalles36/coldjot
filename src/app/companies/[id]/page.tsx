import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import ContactList from "@/app/contacts/ContactList";
import { Globe, Building2 } from "lucide-react";

export default async function CompanyPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const company = await prisma.company.findUnique({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  });

  if (!company) {
    notFound();
  }

  const contacts = await prisma.contact.findMany({
    where: {
      companyId: company.id,
      userId: session.user.id,
    },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });

  const companies = await prisma.company.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="space-y-4">
        <PageHeader
          title={company.name}
          description="View and manage company details and contacts."
        />

        {company.website && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <a
              href={
                company.website.startsWith("http")
                  ? company.website
                  : `https://${company.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {company.website}
            </a>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <ContactList initialContacts={contacts} companies={companies} />
      </div>
    </div>
  );
}
