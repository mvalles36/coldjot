import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import ContactList from "@/app/contacts/ContactList";
import { Globe, Building2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  try {
    // Await the params
    const { id: companyId } = await params;
    if (!companyId) {
      notFound();
    }

    const [company, contacts, companies] = await Promise.all([
      prisma.company.findFirst({
        where: {
          id: companyId,
          userId: session.user.id,
        },
      }),
      prisma.contact.findMany({
        where: {
          companyId: companyId,
          userId: session.user.id,
        },
        include: { company: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.company.findMany({
        where: { userId: session.user.id },
        orderBy: { name: "asc" },
      }),
    ]);

    if (!company) {
      notFound();
    }

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
  } catch (error) {
    console.error("Error loading company:", error);
    notFound();
  }
}
