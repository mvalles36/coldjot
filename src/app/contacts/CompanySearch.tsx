"use client";

import { useState, useEffect } from "react";
import { Company } from "@prisma/client";
import { Check, ChevronsUpDown, X, Building2 } from "lucide-react";
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

interface Props {
  selectedCompany: Company | null;
  onSelect: (company: Company | null) => void;
}

export function CompanySearch({ selectedCompany, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Set initial value if company is pre-selected
  useEffect(() => {
    if (selectedCompany) {
      setInputValue(selectedCompany.name);
      setOpen(false);
    }
  }, [selectedCompany]);

  // Handle search
  useEffect(() => {
    const searchCompanies = async () => {
      if (!inputValue || inputValue.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/companies/search?q=${encodeURIComponent(inputValue)}`
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(searchCompanies, 300);
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
            <div className="flex items-center gap-2 truncate">
              {selectedCompany ? (
                <>
                  <Building2 className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="truncate">{selectedCompany.name}</span>
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="text-muted-foreground">
                    Select company...
                  </span>
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search companies..."
              value={inputValue}
              onValueChange={(value) => {
                setInputValue(value);
                setOpen(true);
              }}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Searching..." : "No company found"}
              </CommandEmpty>
              {searchResults.length > 0 && (
                <CommandGroup>
                  {searchResults.map((company) => (
                    <CommandItem
                      key={company.id}
                      onSelect={() => {
                        onSelect(company);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <div className="flex w-full items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedCompany?.id === company.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{company.name}</span>
                          {company.website && (
                            <span className="text-sm text-muted-foreground">
                              {company.website}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedCompany && (
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
