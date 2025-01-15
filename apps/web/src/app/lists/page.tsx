"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LocalSearch } from "@/components/ui/local-search";
import { Separator } from "@/components/ui/separator";
import EmailListsView from "../../components/lists/email-list";

export default function ListsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (value: string) => {
    setActiveSearch(value);
    setIsSearching(true);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Email Lists"
            description="Create and manage your email lists for targeted campaigns"
          />
          <LocalSearch
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            isLoading={isSearching}
          />
        </div>
        <Separator />
      </div>
      <EmailListsView
        searchQuery={activeSearch}
        onSearchEnd={() => setIsSearching(false)}
      />
    </div>
  );
}
