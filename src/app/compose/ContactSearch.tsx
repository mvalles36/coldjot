"use client";

import { useState, useEffect } from "react";
import { Contact, Company } from "@prisma/client";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ContactWithCompany = Contact & {
  company: Company | null;
};

interface Props {
  selectedContact: ContactWithCompany | null;
  onSelect: (contact: ContactWithCompany | null) => void;
}

export function ContactSearch({ selectedContact, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<ContactWithCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Set initial value if contact is pre-selected
  useEffect(() => {
    if (selectedContact) {
      setInputValue(`${selectedContact.name} <${selectedContact.email}>`);
      setOpen(false);
    }
  }, [selectedContact]);

  // Handle search
  useEffect(() => {
    const searchContacts = async () => {
      if (!inputValue || inputValue.length < 2) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/contacts/search?q=${encodeURIComponent(inputValue)}`
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(searchContacts, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedContact ? (
              <span className="flex items-center gap-2">
                <span>{selectedContact.name}</span>
                <span className="text-muted-foreground">
                  ({selectedContact.email})
                </span>
              </span>
            ) : (
              "Search contacts..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name, email or company..."
              value={inputValue}
              onValueChange={(value) => {
                setInputValue(value);
                setOpen(true);
              }}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Searching..." : "No contact found"}
              </CommandEmpty>
              {searchResults.length > 0 && (
                <CommandGroup>
                  {searchResults.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      onSelect={() => {
                        onSelect(contact);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedContact?.id === contact.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{contact.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {contact.email}
                          {contact.company && ` • ${contact.company.name}`}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedContact && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onSelect(null);
            setInputValue("");
            setSearchResults([]);
          }}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
