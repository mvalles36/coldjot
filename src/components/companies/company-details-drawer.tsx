"use client";

import { useState, useEffect } from "react";
import { Company, Contact } from "@prisma/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Mail,
  Building2,
  Globe,
  Loader2,
  ExternalLink,
  Edit2,
  Trash2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { User } from "lucide-react";
import { toast } from "react-hot-toast";

type CompanyWithContacts = Company & {
  contacts: Contact[];
};

interface CompanyDetailsDrawerProps {
  company: CompanyWithContacts;
  onClose: () => void;
  onContactClick?: (contact: Contact) => void;
}

export default function CompanyDetailsDrawer({
  company: initialCompany,
  onClose,
  onContactClick,
}: CompanyDetailsDrawerProps) {
  const [company, setCompany] = useState<CompanyWithContacts>(initialCompany);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await fetch(`/api/companies/${company.id}/contacts`);
        if (!response.ok) throw new Error("Failed to load contacts");

        const contacts = await response.json();
        setCompany((prev) => ({ ...prev, contacts }));
      } catch (error) {
        console.error("Error loading contacts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadContacts();
  }, [company.id]);

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:max-w-[800px] h-[100dvh] p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Company Details</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Building2 className="h-5 w-5" />
                  {company.name}
                </div>
                <Link
                  href={`/companies/${company.id}`}
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  View full details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {company.website && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <a
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {company.website}
                  </a>
                </div>
              )}
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Contacts</h3>
                <span className="text-sm text-muted-foreground">
                  {company.contacts.length} contacts
                </span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {company.contacts.length > 0 ? (
                        company.contacts.map((contact) => (
                          <TableRow key={contact.id}>
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
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onContactClick?.(contact)}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                <Link href={`/contacts/${contact.id}/edit`}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const response = await fetch(
                                        `/api/contacts/${contact.id}`,
                                        {
                                          method: "DELETE",
                                        }
                                      );
                                      if (!response.ok)
                                        throw new Error(
                                          "Failed to delete contact"
                                        );

                                      setCompany((prev) => ({
                                        ...prev,
                                        contacts: prev.contacts.filter(
                                          (c) => c.id !== contact.id
                                        ),
                                      }));
                                      toast.success(
                                        "Contact deleted successfully"
                                      );
                                    } catch (error) {
                                      toast.error("Failed to delete contact");
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No contacts found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
