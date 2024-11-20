"use client";

import { useState, useEffect } from "react";
import { Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailList } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateListModal } from "./CreateListModal";
import { EmailListCard } from "./EmailListCard";
import { toast } from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EmailListsView = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      setError(null);
      const response = await fetch("/api/lists");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch lists");
      }

      const data = await response.json();

      // Validate the response data
      if (!Array.isArray(data)) {
        throw new Error("Invalid response format");
      }

      setLists(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred while loading lists";
      setError(errorMessage);
      toast.error("Failed to load email lists");
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async (
    list: Omit<EmailList, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      setError(null);
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...list,
          contacts: list.contacts || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create list");
      }

      const newList = await response.json();
      setLists((prev) => [newList, ...prev]);
      toast.success("Email list created successfully");
      setIsCreateModalOpen(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create email list";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDeleteList = async (list: EmailList) => {
    try {
      setError(null);
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete list");
      }

      setLists((prev) => prev.filter((l) => l.id !== list.id));
      toast.success("Email list deleted successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete email list";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchLists();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Email Lists"
        description="Create and manage your email lists for targeted campaigns"
        action={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create List
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-[200px] rounded-xl border bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : lists.length === 0 && !error ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No email lists found.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create your first list
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <EmailListCard
              key={list.id}
              list={list}
              onDelete={handleDeleteList}
            />
          ))}
        </div>
      )}

      <CreateListModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateList}
      />
    </div>
  );
};

export default EmailListsView;
