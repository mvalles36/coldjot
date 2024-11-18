"use client";

import { useEffect, useState, use } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import { User, Building2, Globe, Linkedin, Mail, Calendar } from "lucide-react";
import Link from "next/link";
import { formatLinkedInUrl } from "@/lib/utils";
import ActionButtons from "./ActionButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CopyButton from "./CopyButton";
import { Contact, Company } from "@prisma/client";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ContactPage({ params }: PageProps) {
  const [contact, setContact] = useState<ContactWithCompany | null>(null);
  const resolvedParams = use(params);
  const contactId = resolvedParams.id;

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const response = await fetch(`/api/contacts/${contactId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch contact");
        }
        const data = await response.json();
        setContact(data);
      } catch (error) {
        console.error("Error loading contact:", error);
      }
    };

    if (contactId) {
      fetchContact();
    }
  }, [contactId]);

  if (!contact) {
    return null; // Or loading state
  }

  const handleContactUpdate = (updatedContact: ContactWithCompany) => {
    setContact(updatedContact);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title={`${contact.firstName} ${contact.lastName}`}
          description="View and manage contact details."
        />
        <ActionButtons
          contact={contact}
          onContactUpdate={handleContactUpdate}
        />
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Information Card */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-[120px] text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Full Name</span>
                </div>
                <span className="font-medium">
                  {contact.firstName} {contact.lastName}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-[120px] text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${contact.email}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {contact.email}
                  </a>
                  <CopyButton textToCopy={contact.email} />
                </div>
              </div>
              {contact.linkedinUrl && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-[120px] text-muted-foreground">
                    <Linkedin className="h-4 w-4" />
                    <span>LinkedIn</span>
                  </div>
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {formatLinkedInUrl(contact.linkedinUrl)}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-[120px] text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Added</span>
                </div>
                <span className="font-medium">
                  {new Date(contact.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Information Card */}
        {contact.company && (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-[120px] text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>Company</span>
                  </div>
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                </div>
                {contact.company.website && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-[120px] text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span>Website</span>
                    </div>
                    <a
                      href={
                        contact.company.website.startsWith("http")
                          ? contact.company.website
                          : `https://${contact.company.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {contact.company.website}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
