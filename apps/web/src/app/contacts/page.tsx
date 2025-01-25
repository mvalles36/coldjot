"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LocalSearch } from "@/components/ui/local-search";
import { Button } from "@/components/ui/button";
import ContactList from "../../components/contacts/contact-list";
import { Separator } from "@/components/ui/separator";

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSearch = (value: string) => {
    setActiveSearch(value);
    setIsSearching(true);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Contacts"
            description="Manage your contacts and their associated companies."
          />
          <div className="flex items-center gap-3">
            <LocalSearch
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              isLoading={isSearching}
            />
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>
        <Separator />
      </div>
      <ContactList
        searchQuery={activeSearch}
        initialContacts={[]}
        companies={[]}
        showAddModal={showAddModal}
        onSearchEnd={() => setIsSearching(false)}
        onAddModalClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
