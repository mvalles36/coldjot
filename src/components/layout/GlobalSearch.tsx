"use client";

import * as React from "react";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { Search, User, Building2, FileText, Loader2 } from "lucide-react";
import { SearchResult, SearchResultType } from "@/types/search";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { v4 as uuidv4 } from "uuid";
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchKey, setSearchKey] = React.useState(0);

  const mounted = React.useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      return;
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    console.log("Query changed:", query);

    if (!query) {
      setResults([]);
      return;
    }

    let active = true;

    const searchItems = async () => {
      console.log("Starting search for:", query);
      setIsLoading(true);

      try {
        const [contactsRes, companiesRes] = await Promise.all([
          fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`),
          fetch(`/api/companies/search?q=${encodeURIComponent(query)}`),
        ]);

        if (!active) return;

        const [contacts, companies] = await Promise.all([
          contactsRes.ok ? contactsRes.json() : [],
          companiesRes.ok ? companiesRes.json() : [],
        ]);

        if (!active) return;

        const searchResults: SearchResult[] = [
          ...contacts.map((contact: any) => ({
            id: contact.id,
            type: "contact",
            title: `${contact.firstName} ${contact.lastName}`,
            subtitle: contact.email,
            url: `/contacts/${contact.id}`,
          })),
          ...companies.map((company: any) => ({
            id: company.id,
            type: "company",
            title: company.name,
            subtitle: company.website,
            url: `/companies/${company.id}`,
          })),
        ];

        if (active) {
          setResults(searchResults);
          setSearchKey((prev) => prev + 1);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Search error:", error);
        if (active) {
          setResults([]);
          setIsLoading(false);
        }
      }
    };

    searchItems();

    return () => {
      active = false;
    };
  }, [query]);

  React.useEffect(() => {
    console.log("Results updated:", results);
  }, [results]);

  const groupedResults = useMemo(() => {
    const grouped = results.reduce((acc, item) => {
      const group = acc[item.type] || [];
      group.push(item);
      acc[item.type] = group;
      return acc;
    }, {} as Record<SearchResultType, SearchResult[]>);
    return grouped;
  }, [results]);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-80"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <VisuallyHidden.Root asChild>
          <DialogTitle>Search</DialogTitle>
        </VisuallyHidden.Root>
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0"
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput
            placeholder="Search contacts & companies..."
            value={query}
            onValueChange={setQuery}
            className="border-none focus:ring-0"
          />
          <CommandList className="max-h-[500px] overflow-y-auto py-2">
            {query.length === 0 ? (
              <CommandEmpty>Type to start searching...</CommandEmpty>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              <>
                {/* Contacts Section */}
                {results.some((item) => item.type === "contact") && (
                  <CommandGroup heading="Contacts">
                    {results
                      .filter((item) => item.type === "contact")
                      .map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.title} ${item.subtitle}`}
                          onSelect={() => {
                            router.push(item.url!);
                            setOpen(false);
                          }}
                          className="flex items-center gap-2 px-2"
                        >
                          <User className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{item.title}</span>
                            {item.subtitle && (
                              <span className="text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}

                {/* Companies Section */}
                {results.some((item) => item.type === "company") && (
                  <CommandGroup heading="Companies">
                    {results
                      .filter((item) => item.type === "company")
                      .map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.title} ${item.subtitle}`}
                          onSelect={() => {
                            router.push(item.url!);
                            setOpen(false);
                          }}
                          className="flex items-center gap-2 px-2"
                        >
                          <Building2 className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{item.title}</span>
                            {item.subtitle && (
                              <span className="text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
