"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LocalSearch } from "@/components/ui/local-search";
import TemplateList from "./TemplateList";
import { Separator } from "@/components/ui/separator";

export default function TemplatesPage() {
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
            title="Templates"
            description="Manage your email templates."
          />
          <LocalSearch
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            isLoading={isSearching}
          />
        </div>
        <Separator />
      </div>
      <TemplateList
        searchQuery={activeSearch}
        onSearchEnd={() => setIsSearching(false)}
      />
    </div>
  );
}
