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
import {
  Loader2,
  UserPlus,
  X,
  Check,
  Clock,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
} from "lucide-react";
import { ListSelector } from "@/components/lists/list-selector";
import { formatDistanceToNow, format } from "date-fns";
import { useSequenceStats } from "@/hooks/use-sequence-stats";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SequenceContact, StepStatus } from "@mailjot/types";

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

// Add extended SequenceContact type with all required properties
interface ExtendedSequenceContact {
  id: string;
  sequenceId: string;
  contactId: string;
  status:
    | "not_sent"
    | "draft"
    | "active"
    | "paused"
    | "completed"
    | "error"
    | "pending"
    | "scheduled"
    | "sent"
    | "bounced";
  currentStep: number;
  nextScheduledAt: Date | null;
  completed: boolean;
  startedAt: Date;
  lastProcessedAt: Date | null;
  completedAt: Date | null;
  threadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: {
    id: string;
    name: string;
    email: string;
    company?: {
      id: string;
      name: string;
    } | null;
  };
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
  const [contacts, setContacts] = useState<ExtendedSequenceContact[]>(
    initialContacts as ExtendedSequenceContact[]
  );
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
      setContacts((prev) => [
        ...prev,
        newSequenceContact as ExtendedSequenceContact,
      ]);
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
        setContacts(data.contacts as ExtendedSequenceContact[]);
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

  const getStatusDetails = (contact: ExtendedSequenceContact) => {
    if (contact.completedAt) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>Completed</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(contact.completedAt), "MMM d, yyyy 'at' h:mm a")}
          </div>
        </div>
      );
    }

    if (contact.status === "bounced" || contact.status === "error") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Failed</span>
          </div>
          {contact.lastProcessedAt && (
            <div className="text-xs text-muted-foreground">
              Last attempt:{" "}
              {format(
                new Date(contact.lastProcessedAt),
                "MMM d, yyyy 'at' h:mm a"
              )}
            </div>
          )}
        </div>
      );
    }

    if (contact.status === "active" || contact.status === "scheduled") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-yellow-600">
            <PlayCircle className="w-4 h-4" />
            <span>In Progress</span>
          </div>
          {contact.nextScheduledAt && (
            <div className="text-xs text-muted-foreground">
              Next step:{" "}
              {format(
                new Date(contact.nextScheduledAt),
                "MMM d, yyyy 'at' h:mm a"
              )}
            </div>
          )}
        </div>
      );
    }

    if (contact.status === "paused") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-orange-600">
            <Clock className="w-4 h-4" />
            <span>Paused</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Started{" "}
            {formatDistanceToNow(new Date(contact.startedAt), {
              addSuffix: true,
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Not Started</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Added{" "}
          {formatDistanceToNow(new Date(contact.startedAt), {
            addSuffix: true,
          })}
        </div>
      </div>
    );
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
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timeline</TableHead>
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                              Step {sequenceContact.currentStep + 1} of{" "}
                              {totalSteps}
                            </div>
                            {sequenceContact.nextScheduledAt && (
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {sequenceContact.nextScheduledAt
                            ? `Next step scheduled for ${format(
                                new Date(sequenceContact.nextScheduledAt),
                                "MMM d, yyyy 'at' h:mm a"
                              )}`
                            : "No next step scheduled"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-xs text-muted-foreground">
                      Started{" "}
                      {formatDistanceToNow(
                        new Date(sequenceContact.startedAt),
                        { addSuffix: true }
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusDetails(sequenceContact)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        {sequenceContact.lastProcessedAt ? (
                          <>
                            Last activity{" "}
                            {formatDistanceToNow(
                              new Date(sequenceContact.lastProcessedAt),
                              {
                                addSuffix: true,
                              }
                            )}
                          </>
                        ) : (
                          "No activity yet"
                        )}
                      </div>
                      {sequenceContact.completedAt && (
                        <div className="text-xs text-muted-foreground">
                          Completed in{" "}
                          {formatDistanceToNow(
                            new Date(sequenceContact.startedAt),
                            {
                              addSuffix: false,
                            }
                          )}
                        </div>
                      )}
                    </div>
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
