"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LocalSearch } from "@/components/ui/local-search";
import ContactList from "../../components/contacts/contact-list";
import { Separator } from "@/components/ui/separator";

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (value: string) => {
    setActiveSearch(value);
    setIsSearching(true);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Contacts"
            description="Manage your contacts and their associated companies."
          />
          <LocalSearch
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            isLoading={isSearching}
          />
        </div>
        <Separator />
      </div>
      <ContactList
        searchQuery={activeSearch}
        onSearchEnd={() => setIsSearching(false)}
        initialContacts={[]}
        companies={[]}
      />
    </div>
  );
}
