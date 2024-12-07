"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import AddContactModal from "./add-contact-drawer";
import { Contact, Company } from "@prisma/client";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface AddContactButtonProps {
  onAddContact: (contact: ContactWithCompany) => void;
  companies: Company[];
}

export default function AddContactButton({
  onAddContact,
  companies,
}: AddContactButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button onClick={() => setShowModal(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Contact
      </Button>

      {showModal && (
        <AddContactModal
          onClose={() => setShowModal(false)}
          onAdd={onAddContact}
        />
      )}
    </>
  );
}
