"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Contact, Company } from "@prisma/client";
import { Mail, Building2, Globe, Linkedin, Calendar } from "lucide-react";
import Link from "next/link";
import { formatLinkedInUrl } from "@/lib/utils";
import ActionButtons from "./[id]/ActionButtons";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface ContactDetailsSliderProps {
  contact: ContactWithCompany;
  open: boolean;
  onClose: () => void;
}

export function ContactDetailsSlider({
  contact,
  open,
  onClose,
}: ContactDetailsSliderProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            {contact.firstName} {contact.lastName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <ActionButtons contact={contact} />

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
              <div>
                <p className="font-medium">{contact.email}</p>
                <p className="text-sm text-muted-foreground">Email</p>
              </div>
            </div>

            {contact.company && (
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
                <div>
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="font-medium hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">Company</p>
                </div>
              </div>
            )}

            {contact.company?.website && (
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
                <div>
                  <a
                    href={contact.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {contact.company.website}
                  </a>
                  <p className="text-sm text-muted-foreground">Website</p>
                </div>
              </div>
            )}

            {contact.linkedinUrl && (
              <div className="flex items-start gap-3">
                <Linkedin className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
                <div>
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {formatLinkedInUrl(contact.linkedinUrl)}
                  </a>
                  <p className="text-sm text-muted-foreground">LinkedIn</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground/70 mt-0.5" />
              <div>
                <p className="font-medium">
                  {new Date(contact.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">Added on</p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
