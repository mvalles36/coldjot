"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Contact } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContactSearchProps {
  onSelect: (contactId: string) => void;
  selectedContacts: string[];
}

export const ContactSearch = ({
  onSelect,
  selectedContacts,
}: ContactSearchProps) => {
  const [open, setOpen] = React.useState(false);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/contacts");
        const data = await response.json();
        setContacts(data);
      } catch (error) {
        console.error("Failed to fetch contacts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selectedContacts.length > 0
              ? `${selectedContacts.length} contacts selected`
              : "Select contacts..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search contacts..."
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandEmpty>No contacts found.</CommandEmpty>
          <ScrollArea className="h-72">
            <CommandGroup>
              {contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  onSelect={() => {
                    onSelect(contact.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedContacts.includes(contact.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{contact.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {contact.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
