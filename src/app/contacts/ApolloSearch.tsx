"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Contact, Company } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserPlus } from "lucide-react";

type FormData = {
  domain: string;
  role?: string;
};

type ContactWithCompany = Contact & {
  company: Company | null;
};

type ApolloContact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  organization_name: string;
  linkedin_url?: string;
};

interface ApolloSearchProps {
  onAddContact: (contact: ContactWithCompany) => void;
}

export default function ApolloSearch({ onAddContact }: ApolloSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ApolloContact[]>([]);
  const { register, handleSubmit } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setIsSearching(true);
    try {
      const response = await fetch("/api/search/apollo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Search failed");

      const result = await response.json();
      setSearchResults(result.people || []);
    } catch (error) {
      toast.error("Failed to search contacts");
    } finally {
      setIsSearching(false);
    }
  };

  const addContact = async (apolloContact: ApolloContact) => {
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${apolloContact.first_name} ${apolloContact.last_name}`,
          firstName: `${apolloContact.first_name}`,
          lastName: `${apolloContact.last_name}`,
          email: apolloContact.email,
          linkedinUrl: apolloContact.linkedin_url,
        }),
      });

      if (!response.ok) throw new Error("Failed to add contact");

      const newContact = await response.json();
      const contactWithCompany: ContactWithCompany = {
        ...newContact,
        company: null,
      };

      onAddContact(contactWithCompany);
      toast.success("Contact added successfully");
    } catch (error) {
      toast.error("Failed to add contact");
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline">
        <Search className="h-4 w-4 mr-2" />
        Search Apollo.io
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Search Apollo.io Contacts</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Company Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                {...register("domain", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role (Optional)</Label>
              <Input
                id="role"
                placeholder="CEO, CTO, Founder..."
                {...register("role")}
              />
            </div>

            <Button type="submit" disabled={isSearching}>
              {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Search
            </Button>
          </form>

          {searchResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-4">Search Results</h3>
              <div className="space-y-4">
                {searchResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contact.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contact.title} at {contact.organization_name}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addContact(contact)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
