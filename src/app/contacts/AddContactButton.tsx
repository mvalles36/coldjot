"use client";

import { useState } from "react";
import { Contact } from "@prisma/client";
import AddContactModal from "./AddContactModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AddContactButton({
  onAddContact,
}: {
  onAddContact: (contact: Contact) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Add Contact
      </Button>

      {isOpen && (
        <AddContactModal
          onClose={() => setIsOpen(false)}
          onAdd={(contact) => {
            onAddContact(contact);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}
