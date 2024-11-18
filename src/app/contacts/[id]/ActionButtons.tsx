"use client";

import { Button } from "@/components/ui/button";
import { Mail, Edit2 } from "lucide-react";
import { Contact, Company } from "@prisma/client";
import { useState } from "react";
import EditContactModal from "../EditContactModal";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface ActionButtonsProps {
  contact: ContactWithCompany;
  onContactUpdate?: (updatedContact: ContactWithCompany) => void;
}

export default function ActionButtons({
  contact,
  onContactUpdate,
}: ActionButtonsProps) {
  const [editingContact, setEditingContact] =
    useState<ContactWithCompany | null>(null);

  const handleSave = (updatedContact: ContactWithCompany) => {
    setEditingContact(null);
    onContactUpdate?.(updatedContact);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setEditingContact(contact)}>
        <Edit2 className="h-4 w-4 mr-2" />
        Edit Contact
      </Button>
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

      {editingContact && (
        <EditContactModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
