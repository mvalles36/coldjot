"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ContactSearch } from "@/components/search/contact-search-dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { Loader2, UserPlus, X } from "lucide-react";
import { Contact } from "@prisma/client";

interface ContactWithCompany extends Contact {
  company: {
    id: string;
    name: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    website: string | null;
    domain: string | null;
  } | null;
}

interface SequenceContact {
  id: string;
  sequenceId: string;
  contactId: string;
  status: string;
  contact: ContactWithCompany;
}

interface SequenceContactsProps {
  sequenceId: string;
  initialContacts: SequenceContact[];
}

export function SequenceContacts({
  sequenceId,
  initialContacts,
}: SequenceContactsProps) {
  const [contacts, setContacts] = useState<SequenceContact[]>(initialContacts);
  const [selectedContact, setSelectedContact] =
    useState<ContactWithCompany | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log("initialContacts", initialContacts);
  }, [initialContacts]);

  const handleAddContact = async (contact: ContactWithCompany) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id }),
      });

      if (!response.ok) throw new Error("Failed to add contact");

      const newSequenceContact = await response.json();
      setContacts((prev) => [...prev, newSequenceContact]);
      setSelectedContact(null);
      toast.success("Contact added to sequence");
    } catch (error) {
      toast.error("Failed to add contact");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveContact = async (sequenceContactId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/sequences/${sequenceId}/contacts/${sequenceContactId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove contact");

      setContacts((prev) => prev.filter((c) => c.id !== sequenceContactId));
      toast.success("Contact removed from sequence");
    } catch (error) {
      toast.error("Failed to remove contact");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <ContactSearch
            selectedContact={selectedContact}
            onSelect={setSelectedContact}
          />
        </div>
        <Button
          onClick={() => selectedContact && handleAddContact(selectedContact)}
          disabled={!selectedContact || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          Add Contact
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* {JSON.stringify(contacts)} */}
            {contacts.map((sequenceContact) => (
              <TableRow key={sequenceContact.id}>
                <TableCell>{sequenceContact.contact.name}</TableCell>
                <TableCell>{sequenceContact.contact.email}</TableCell>
                <TableCell>
                  {sequenceContact.contact.company?.name || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{sequenceContact.status}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveContact(sequenceContact.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
