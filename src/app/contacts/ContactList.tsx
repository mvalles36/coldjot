"use client";

import { useState } from "react";
import { Contact, Company } from "@prisma/client";
import { useRouter } from "next/navigation";
import EditContactModal from "./EditContactModal";
import AddContactButton from "./AddContactButton";
import ApolloSearch from "./ApolloSearch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ColumnDef } from "@tanstack/react-table";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface ContactListProps {
  initialContacts: ContactWithCompany[];
  companies: Company[];
}

export default function ContactList({
  initialContacts,
  companies,
}: ContactListProps) {
  const [contacts, setContacts] =
    useState<ContactWithCompany[]>(initialContacts);
  const [editingContact, setEditingContact] =
    useState<ContactWithCompany | null>(null);
  const [deletingContact, setDeletingContact] =
    useState<ContactWithCompany | null>(null);

  const handleAddContact = (newContact: ContactWithCompany) => {
    setContacts((prev) => [newContact, ...prev]);
  };

  const handleDelete = async (contact: ContactWithCompany) => {
    const response = await fetch(`/api/contacts/${contact.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setContacts(contacts.filter((c) => c.id !== contact.id));
    }
  };

  const columns: ColumnDef<ContactWithCompany>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "company",
      header: "Company",
      cell: ({ row }) => {
        const company = row.original.company;
        return company ? company.name : "-";
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const contact = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingContact(contact)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeletingContact(contact)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <ApolloSearch onAddContact={handleAddContact} />
        <AddContactButton
          onAddContact={handleAddContact}
          companies={companies}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell className="font-medium">{contact.name}</TableCell>
              <TableCell>{contact.email}</TableCell>
              <TableCell>
                {contact.company ? contact.company.name : "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingContact(contact)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingContact(contact)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingContact && (
        <EditContactModal
          contact={editingContact}
          companies={companies}
          onClose={() => setEditingContact(null)}
          onSave={(updatedContact) => {
            setContacts(
              contacts.map((c) =>
                c.id === updatedContact.id ? updatedContact : c
              )
            );
            setEditingContact(null);
          }}
        />
      )}

      <AlertDialog
        open={!!deletingContact}
        onOpenChange={() => setDeletingContact(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              contact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingContact) {
                  handleDelete(deletingContact);
                  setDeletingContact(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
