"use client";

import { useState, useEffect } from "react";
import { Contact, Company } from "@prisma/client";
import { useRouter } from "next/navigation";
import EditContactModal from "./edit-contact-drawer";
import AddContactModal from "./add-contact-drawer";
import AddContactButton from "./add-contact-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Edit2,
  Trash2,
  Mail,
  ExternalLink,
  User,
  ListPlus,
  MoreHorizontal,
  SendHorizonal,
} from "lucide-react";
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
import AddToListDrawer from "@/components/lists/add-to-list-drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import ContactDetailsDrawer from "./contact-details-drawer";
import { AddToSequenceModal } from "./add-to-sequence-modal";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface ContactListProps {
  searchQuery?: string;
  onSearchStart?: () => void;
  onSearchEnd?: () => void;
  initialContacts: ContactWithCompany[]; // Replace 'any' with your Contact type
  companies: Company[]; // Replace 'any' with your Company type
  showAddModal?: boolean;
  onAddModalClose?: () => void;
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

// Add this interface near the top with other type definitions
interface ContactToList {
  id: string;
  isMultiple?: boolean;
}

export default function ContactList({
  searchQuery = "",
  onSearchStart,
  onSearchEnd,
  onAddModalClose,
  showAddModal = false,
  companies,
}: ContactListProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [editingContact, setEditingContact] =
    useState<ContactWithCompany | null>(null);
  const [deletingContact, setDeletingContact] =
    useState<ContactWithCompany | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contactToAddToList, setContactToAddToList] =
    useState<ContactToList | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [selectedContactForDetails, setSelectedContactForDetails] =
    useState<ContactWithCompany | null>(null);
  const [contactToAddToSequence, setContactToAddToSequence] =
    useState<Contact | null>(null);

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

  const handleCheckboxChange = (contactId: string, checked: boolean) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(contactId);
      } else {
        next.delete(contactId);
      }
      return next;
    });
  };

  const handleBulkAddToList = () => {
    setContactToAddToList({
      id: Array.from(selectedContacts).join(","),
      isMultiple: true,
    });
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
            {/* <Button
              variant="ghost"
              size="icon"
              onClick={() => handleComposeEmail(contact)}
            >
              <Mail className="h-4 w-4" />
            </Button> */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingContact(contact);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Contact
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setContactToAddToList({
                      id: contact.id,
                      isMultiple: false,
                    });
                  }}
                >
                  <ListPlus className="h-4 w-4 mr-2" />
                  Add to List
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingContact(contact);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {selectedContacts.size > 0 && (
            <Button variant="outline" size="sm" onClick={handleBulkAddToList}>
              <ListPlus className="h-4 w-4 mr-2" />
              Add {selectedContacts.size} to List
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedContacts.size === contacts.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedContacts(new Set(contacts.map((c) => c.id)));
                    } else {
                      setSelectedContacts(new Set());
                    }
                  }}
                />
              </TableHead>
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
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest(".checkbox-cell")) {
                    setSelectedContactForDetails(contact);
                  }
                }}
              >
                <TableCell
                  className="checkbox-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedContacts.has(contact.id)}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(contact.id, checked as boolean)
                    }
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground/70" />
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
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
                        setContactToAddToSequence(contact);
                      }}
                    >
                      <SendHorizonal className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingContact(contact);
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactToAddToList({
                              id: contact.id,
                              isMultiple: false,
                            });
                          }}
                        >
                          <ListPlus className="h-4 w-4 mr-2" />
                          Add to List
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingContact(contact);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {selectedContactForDetails && (
        <ContactDetailsDrawer
          contact={selectedContactForDetails}
          open={!!selectedContactForDetails}
          onClose={() => setSelectedContactForDetails(null)}
        />
      )}

      <AddToListDrawer
        open={!!contactToAddToList}
        onClose={() => setContactToAddToList(null)}
        contactId={contactToAddToList?.id || ""}
        isMultiple={contactToAddToList?.isMultiple}
      />

      {showAddModal && (
        <AddContactModal
          onClose={() => {
            onAddModalClose?.();
          }}
          onAdd={(newContact: ContactWithCompany) => {
            setContacts((prev) => [newContact, ...prev]);
            onAddModalClose?.();
          }}
        />
      )}

      {contactToAddToSequence && (
        <AddToSequenceModal
          open={!!contactToAddToSequence}
          onClose={() => setContactToAddToSequence(null)}
          contact={contactToAddToSequence}
        />
      )}
    </div>
  );
}
