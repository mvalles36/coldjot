"use client";

import { useState } from "react";
import { Contact, Company } from "@prisma/client";
import { useRouter } from "next/navigation";
import EditContactModal from "./EditContactModal";
import AddContactButton from "./AddContactButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Mail, ExternalLink } from "lucide-react";
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
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface ContactListProps {
  initialContacts: ContactWithCompany[];
  companies: Company[];
}

// Helper function to format LinkedIn URL
const formatLinkedInUrl = (url: string | null) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    // Get the path without leading/trailing slashes
    const path = urlObj.pathname.replace(/^\/|\/$/g, "");
    // Get the last part of the path (usually the profile name/id)
    const profileName = path.split("/").pop();
    return profileName || url;
  } catch {
    return url;
  }
};

export default function ContactList({
  initialContacts,
  companies,
}: ContactListProps) {
  const router = useRouter();
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

  const handleComposeEmail = (contact: ContactWithCompany) => {
    localStorage.setItem(
      "selectedContact",
      JSON.stringify({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        companyId: contact.companyId,
        company: contact.company,
      })
    );
    router.push("/compose");
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
        return company ? (
          <Link
            href={`/companies/${company.id}`}
            className="text-primary hover:underline"
          >
            {company.name}
          </Link>
        ) : (
          "—"
        );
      },
    },
    {
      accessorKey: "linkedinUrl",
      header: "LinkedIn",
      cell: ({ row }) => {
        const linkedinUrl = row.original.linkedinUrl;
        return linkedinUrl ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  {formatLinkedInUrl(linkedinUrl)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open LinkedIn profile</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          "—"
        );
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
              onClick={() => handleComposeEmail(contact)}
            >
              <Mail className="h-4 w-4" />
            </Button>
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
            <TableHead>LinkedIn</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell className="font-medium">
                {contact.firstName} {contact.lastName}
              </TableCell>
              <TableCell>{contact.email}</TableCell>
              <TableCell>
                {contact.company ? (
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="text-primary hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {contact.linkedinUrl ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {formatLinkedInUrl(contact.linkedinUrl)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open LinkedIn profile</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleComposeEmail(contact)}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
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
