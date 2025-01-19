"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EmailAlias } from "@prisma/client";

interface AliasListProps {
  accountId: string;
}

export function AliasList({ accountId }: AliasListProps) {
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newAlias, setNewAlias] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchAliases();
  }, [accountId]);

  const fetchAliases = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/email-accounts/${accountId}/aliases`);
      if (!response.ok) throw new Error("Failed to fetch aliases");
      const data = await response.json();
      setAliases(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load email aliases",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias || !newAlias.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email alias",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/email-accounts/${accountId}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: newAlias }),
      });

      if (!response.ok) throw new Error("Failed to add alias");

      const newAliasData = await response.json();
      setAliases((prev) => [...prev, newAliasData]);
      setNewAlias("");

      toast({
        title: "Success",
        description: "Email alias added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add email alias",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAlias = async (aliasId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/email-accounts/${accountId}/aliases/${aliasId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove alias");

      setAliases((prev) => prev.filter((alias) => alias.id !== aliasId));
      toast({
        title: "Success",
        description: "Email alias removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove email alias",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && aliases.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-sm text-muted-foreground">Loading aliases...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Enter email alias"
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddAlias()}
          disabled={isLoading}
        />
        <Button onClick={handleAddAlias} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center">
            No aliases added yet
          </p>
        ) : (
          aliases.map((alias) => (
            <div
              key={alias.id}
              className="flex items-center justify-between p-2 rounded-md border bg-muted/40"
            >
              <div>
                <p className="text-sm font-medium">{alias.alias}</p>
                {alias.name && (
                  <p className="text-xs text-muted-foreground">{alias.name}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveAlias(alias.id)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
