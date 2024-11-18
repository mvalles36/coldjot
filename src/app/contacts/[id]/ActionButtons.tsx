"use client";

import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import Link from "next/link";
import { Contact, Company } from "@prisma/client";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface ActionButtonsProps {
  contact: ContactWithCompany;
}

export default function ActionButtons({ contact }: ActionButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Link href={`/contacts/${contact.id}/edit`}>
        <Button variant="outline">Edit Contact</Button>
      </Link>
      <Button
        onClick={() => {
          localStorage.setItem(
            "selectedContact",
            JSON.stringify({
              id: contact.id,
              name: `${contact.firstName} ${contact.lastName}`,
              email: contact.email,
              companyId: contact.companyId,
              company: contact.company,
            })
          );
          window.location.href = "/compose";
        }}
      >
        <Mail className="h-4 w-4 mr-2" />
        Send Email
      </Button>
    </div>
  );
}
