"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, User, Trash2, ArrowLeft, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailList } from "@/types";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { Contact, Company } from "@prisma/client";
import ContactDetailsDrawer from "@/components/contacts/contact-details-drawer";

type ContactWithCompany = Contact & {
  company: Company | null;
};

type EmailListWithContacts = Omit<EmailList, "contacts"> & {
  contacts: ContactWithCompany[];
};

const RECENT_CONTACTS_KEY = "recentContacts";
const MAX_RECENT_CONTACTS = 5;

export default function ListDetailsView() {
  const router = useRouter();
  const [list, setList] = useState<EmailListWithContacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactToRemove, setContactToRemove] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [selectedContactForDetails, setSelectedContactForDetails] =
    useState<ContactWithCompany | null>(null);

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    try {
      // Get list ID from URL
      const listId = window.location.pathname.split("/").pop();
      const response = await fetch(`/api/lists/${listId}`);
      if (!response.ok) throw new Error("Failed to fetch list");
      const data = await response.json();
      setList(data);
    } catch (error) {
      console.error("Failed to fetch list:", error);
      toast.error("Failed to load list details");
    } finally {
      setLoading(false);
    }
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

  const handleBulkRemove = async () => {
    if (!list) return;

    try {
      // Filter out the selected contacts
      const updatedContacts = list.contacts
        .filter((c) => !selectedContacts.has(c.id))
        .map((c) => c.id);

      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contacts: updatedContacts,
        }),
      });

      if (!response.ok) throw new Error("Failed to remove contacts from list");

      // Update local state
      setList((prev) =>
        prev
          ? {
              ...prev,
              contacts: prev.contacts.filter(
                (c) => !selectedContacts.has(c.id)
              ),
            }
          : null
      );

      // Clear selection
      setSelectedContacts(new Set());

      toast.success(`${selectedContacts.size} contacts removed from list`);
    } catch (error) {
      console.error("Failed to remove contacts:", error);
      toast.error("Failed to remove contacts from list");
    }
  };

  const handleComposeToSelected = () => {
    if (!list || selectedContacts.size === 0) return;

    const selectedContactsList = list.contacts.filter((c) =>
      selectedContacts.has(c.id)
    );

    localStorage.setItem(
      "selectedList",
      JSON.stringify({
        id: list.id,
        name: `${list.name} (Selected)`,
        contacts: selectedContactsList,
      })
    );
    router.push("/compose");
  };

  const handleComposeToList = () => {
    if (!list) return;

    localStorage.setItem(
      "selectedList",
      JSON.stringify({
        id: list.id,
        name: list.name,
        contacts: list.contacts,
      })
    );
    router.push("/compose");
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!list) return;

    try {
      const updatedContacts = list.contacts
        .filter((c) => c.id !== contactId)
        .map((c) => c.id);

      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contacts: updatedContacts,
        }),
      });

      if (!response.ok) throw new Error("Failed to update list");

      setList((prev) =>
        prev
          ? {
              ...prev,
              contacts: prev.contacts.filter((c) => c.id !== contactId),
            }
          : null
      );

      toast.success("Contact removed from list");
    } catch (error) {
      console.error("Failed to remove contact:", error);
      toast.error("Failed to remove contact");
    } finally {
      setContactToRemove(null);
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

    // Add to recent contacts
    try {
      const recentContacts = JSON.parse(
        localStorage.getItem(RECENT_CONTACTS_KEY) || "[]"
      );
      const updatedRecents = [
        contact.id,
        ...recentContacts.filter((id: string) => id !== contact.id),
      ].slice(0, MAX_RECENT_CONTACTS);

      localStorage.setItem(RECENT_CONTACTS_KEY, JSON.stringify(updatedRecents));
    } catch (error) {
      console.error("Error updating recent contacts:", error);
    }

    router.push("/compose");
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!list) {
    return <div>List not found</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/lists")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Lists
      </Button>

      <PageHeader
        title={list.name}
        description={list.description || "No description"}
        action={
          <div className="flex items-center gap-2">
            {selectedContacts.size > 0 ? (
              <>
                <Button variant="outline" onClick={handleComposeToSelected}>
                  <Mail className="h-4 w-4 mr-2" />
                  Compose to {selectedContacts.size} Selected
                </Button>
                <Button variant="destructive" onClick={handleBulkRemove}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove {selectedContacts.size} Selected
                </Button>
              </>
            ) : (
              <Button onClick={handleComposeToList}>
                <Mail className="h-4 w-4 mr-2" />
                Compose to All
              </Button>
            )}
          </div>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedContacts.size === list.contacts.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedContacts(
                        new Set(list.contacts.map((c) => c.id))
                      );
                    } else {
                      setSelectedContacts(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className="hover:bg-muted/50 cursor-pointer"
                onClick={(e) => {
                  if (
                    !(e.target as HTMLElement).closest(
                      ".checkbox-cell, .action-cell, a"
                    )
                  ) {
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
                <TableCell>
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
                <TableCell className="action-cell">
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
                        setContactToRemove(contact.id);
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

      <AlertDialog
        open={!!contactToRemove}
        onOpenChange={() => setContactToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove contact from list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the contact from this list. The contact will not
              be deleted from your contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (contactToRemove) {
                  handleRemoveContact(contactToRemove);
                }
              }}
            >
              Remove
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
    </div>
  );
}
