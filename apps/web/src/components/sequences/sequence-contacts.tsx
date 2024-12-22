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
import { Loader2, UserPlus, X, Check, Clock, RefreshCw } from "lucide-react";
import { ListSelector } from "@/components/lists/list-selector";
import { formatDistanceToNow } from "date-fns";
import { useSequenceStats } from "@/hooks/use-sequence-stats";
import type { SequenceContact } from "@mailjot/types";

interface ContactWithCompany {
  id: string;
  name: string;
  title: string | null;
  firstName: string;
  lastName: string;
  email: string;
  linkedinUrl: string | null;
  companyId: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
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

interface SequenceContactsProps {
  sequenceId: string;
  initialContacts: SequenceContact[];
  isActive: boolean;
}

export function SequenceContacts({
  sequenceId,
  initialContacts,
  isActive,
}: SequenceContactsProps) {
  const [contacts, setContacts] = useState<SequenceContact[]>(initialContacts);
  const [selectedContact, setSelectedContact] =
    useState<ContactWithCompany | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [totalSteps, setTotalSteps] = useState(0);
  const { stats, isLoading: statsLoading } = useSequenceStats(sequenceId);

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

  const handleRemoveContact = async (contactId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/sequences/${sequenceId}/contacts/${contactId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove contact");

      setContacts((prev) => prev.filter((c) => c.contactId !== contactId));
      toast.success("Contact removed from sequence");
    } catch (error) {
      toast.error("Failed to remove contact");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshContacts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/contacts`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
        setTotalSteps(data.totalSteps);
      }
    } catch (error) {
      console.error("Failed to refresh contacts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshContacts();

    // If sequence is active, poll for updates every 30 seconds
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(refreshContacts, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sequenceId, isActive]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 shadow-none hover:bg-green-100"
          >
            <Check className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
          >
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            In Progress
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="destructive"
            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
          >
            <X className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "not_started":
        return (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
          >
            <Clock className="w-3 h-3 mr-1" />
            Not Started
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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
        <ListSelector
          sequenceId={sequenceId}
          onListSelected={refreshContacts}
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Current Step</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : contacts.length > 0 ? (
              contacts.map((sequenceContact) => (
                <TableRow key={sequenceContact.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {sequenceContact.contact.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {sequenceContact.contact.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {sequenceContact.contact.company?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      Step {sequenceContact.currentStep} of {totalSteps}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(sequenceContact.status)}
                  </TableCell>
                  <TableCell>
                    {sequenceContact.lastProcessedAt
                      ? formatDistanceToNow(
                          new Date(sequenceContact.lastProcessedAt),
                          {
                            addSuffix: true,
                          }
                        )
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleRemoveContact(sequenceContact.contactId)
                      }
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="text-muted-foreground">
                    {isActive ? (
                      <>
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                        Waiting for contact activity...
                      </>
                    ) : (
                      "No contacts added to this sequence yet"
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
