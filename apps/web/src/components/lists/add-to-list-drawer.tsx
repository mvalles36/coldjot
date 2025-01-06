"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmailList } from "@coldjot/types";
import { Search, Plus } from "lucide-react";
import { toast } from "react-hot-toast";

interface AddToListDrawerProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  isMultiple?: boolean;
}

export const AddToListDrawer = ({
  open,
  onClose,
  contactId,
  isMultiple,
}: AddToListDrawerProps) => {
  const [lists, setLists] = useState<EmailList[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      const response = await fetch("/api/lists");
      if (!response.ok) throw new Error("Failed to fetch lists");
      const data = await response.json();
      setLists(data);
    } catch (error) {
      console.error("Error fetching lists:", error);
      toast.error("Failed to load lists");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToList = async (listId: string) => {
    try {
      const contactIds = contactId.split(",");
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contacts: [
            ...(lists.find((l) => l.id === listId)?.contacts.map((c) => c.id) ||
              []),
            ...contactIds,
          ],
        }),
      });

      if (!response.ok) throw new Error("Failed to add contact to list");

      toast.success(
        isMultiple ? "Contacts added to list" : "Contact added to list"
      );
      onClose();
    } catch (error) {
      console.error("Error adding contact to list:", error);
      toast.error(
        isMultiple
          ? "Failed to add contacts to list"
          : "Failed to add contact to list"
      );
    }
  };

  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Add to List</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lists..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading lists...
              </div>
            ) : filteredLists.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No lists found
              </div>
            ) : (
              filteredLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-accent"
                >
                  <div>
                    <h4 className="font-medium">{list.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {list.contacts.length} contacts
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAddToList(list.id)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddToListDrawer;
