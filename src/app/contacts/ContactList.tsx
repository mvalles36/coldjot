"use client";

import { useState, useEffect } from "react";
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
import { User } from "lucide-react";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface ContactListProps {
  searchQuery?: string;
  onSearchStart?: () => void;
  onSearchEnd?: () => void;
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
  searchQuery = "",
  onSearchStart,
  onSearchEnd,
}: ContactListProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [editingContact, setEditingContact] =
    useState<ContactWithCompany | null>(null);
  const [deletingContact, setDeletingContact] =
    useState<ContactWithCompany | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchContacts = async () => {
      onSearchStart?.();
      try {
        const url =
          searchQuery.length >= 2
            ? `/api/contacts/search?q=${encodeURIComponent(searchQuery)}`
            : "/api/contacts";

        const response = await fetch(url);
        const data = await response.json();
        setContacts(data);
      } catch (error) {
        console.error("Failed to fetch contacts:", error);
      } finally {
        onSearchEnd?.();
      }
    };

    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      fetchContacts();
    }
  }, [searchQuery, onSearchStart, onSearchEnd]);

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
        <AddContactButton onAddContact={handleAddContact} companies={[]} />
      </div>

      <div className="rounded-md border">
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
              <TableRow
                key={contact.id}
                className="hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/contacts/${contact.id}`)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground/70" />
                    <span>
                      {contact.firstName} {contact.lastName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>
                  {contact.company ? (
                    <Link
                      href={`/companies/${contact.company.id}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
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
                            onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComposeEmail(contact);
                      }}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingContact(contact);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingContact(contact);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
