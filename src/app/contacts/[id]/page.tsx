import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import { User, Building2, Globe, Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import { formatLinkedInUrl } from "@/lib/utils";
import ActionButtons from "./ActionButtons";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  try {
    const { id: contactId } = await params;
    if (!contactId) {
      notFound();
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
      include: { company: true },
    });

    if (!contact) {
      notFound();
    }

    return (
      <div className="max-w-7xl mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title={`${contact.firstName} ${contact.lastName}`}
            description="View and manage contact details."
          />
          <ActionButtons contact={contact} />
        </div>

        <Separator />

        <div className="space-y-8 max-w-3xl">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Contact Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {contact.firstName} {contact.lastName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-primary hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
                {contact.linkedinUrl && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {formatLinkedInUrl(contact.linkedinUrl)}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {contact.company && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Company Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/companies/${contact.company.id}`}
                      className="text-primary hover:underline"
                    >
                      {contact.company.name}
                    </Link>
                  </div>
                  {contact.company.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={
                          contact.company.website.startsWith("http")
                            ? contact.company.website
                            : `https://${contact.company.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {contact.company.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Timeline
            </h3>
            <div className="rounded-md border p-8 flex items-center justify-center text-muted-foreground">
              Coming soon
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading contact:", error);
    notFound();
  }
}
