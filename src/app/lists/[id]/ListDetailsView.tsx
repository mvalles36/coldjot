"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, User, Trash2, ArrowLeft } from "lucide-react";
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
import Link from "next/link";
import { Contact, Company } from "@prisma/client";

type ContactWithCompany = Contact & {
  company: Company | null;
};

type EmailListWithContacts = Omit<EmailList, "contacts"> & {
  contacts: ContactWithCompany[];
};

export default function ListDetailsView() {
  const router = useRouter();
  const [list, setList] = useState<EmailListWithContacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactToRemove, setContactToRemove] = useState<string | null>(null);

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
          <Button onClick={handleComposeToList}>
            <Mail className="h-4 w-4 mr-2" />
            Compose to List
          </Button>
        }
      />

      <div className="rounded-md border">
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
            {list.contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground/70" />
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="hover:underline"
                    >
                      {contact.name}
                    </Link>
                  </div>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setContactToRemove(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
    </div>
  );
}
