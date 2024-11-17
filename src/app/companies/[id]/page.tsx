import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import { Contact } from "@prisma/client";

interface CompanyPageProps {
  params: {
    id: string;
  };
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const company = await prisma.company.findUnique({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    include: {
      contacts: true,
    },
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <PageHeader
        title={company.name}
        description={`View details and contacts for ${company.name}`}
      />
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Company Details</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Website:</span>{" "}
              {company.website || "N/A"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Contacts</h2>
          <div className="space-y-2">
            {company.contacts.map((contact: Contact) => (
              <div key={contact.id} className="p-3 border rounded-lg">
                <p className="font-medium">
                  {contact.firstName} {contact.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{contact.email}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
