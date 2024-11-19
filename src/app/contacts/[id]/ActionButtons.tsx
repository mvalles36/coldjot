"use client";

import { Button } from "@/components/ui/button";
import { Mail, Edit2, Trash2 } from "lucide-react";
import { Contact, Company } from "@prisma/client";
import { useState } from "react";
import EditContactModal from "../EditContactModal";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();

  const handleSave = (updatedContact: ContactWithCompany) => {
    setEditingContact(null);
    onContactUpdate?.(updatedContact);
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete contact");
      }

      toast.success("Contact deleted successfully");
      router.push("/contacts");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    } finally {
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setEditingContact(contact)}>
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Contact
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Contact
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
            router.push("/compose");
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">
                {contact.firstName} {contact.lastName}
              </span>{" "}
              and remove all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
