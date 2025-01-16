"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { SequenceStatus } from "@coldjot/types";

interface SequenceDangerZoneProps {
  sequenceId: string;
  onStatusChange?: (newStatus: SequenceStatus) => void;
}

export function SequenceDangerZone({
  sequenceId,
  onStatusChange,
}: SequenceDangerZoneProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/reset`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reset sequence");
      }

      onStatusChange?.(SequenceStatus.DRAFT);

      toast({
        title: "Success",
        description: "Sequence has been reset successfully",
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset sequence",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete sequence");
      }

      toast({
        title: "Success",
        description: "Sequence has been deleted successfully",
      });

      router.push("/sequences");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete sequence",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pt-8">
      <div className="border-b pb-3">
        <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mt-1">
          These actions are irreversible. Please be certain before proceeding.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h5 className="text-sm font-medium">Reset Sequence</h5>
            <p className="text-sm text-muted-foreground">
              Reset the sequence to its initial state. This will clear all
              progress and allow you to launch the sequence again.
            </p>
          </div>
          <Button
            variant="outline"
            className="text-destructive min-w-40 border-destructive"
            onClick={handleReset}
            disabled={isLoading}
          >
            Reset Sequence
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h5 className="text-sm font-medium">Delete Sequence</h5>
            <p className="text-sm text-muted-foreground">
              Permanently delete this sequence and all its data. This action
              cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            className="min-w-40"
            onClick={handleDelete}
            disabled={isLoading}
          >
            Delete Sequence
          </Button>
        </div>
      </div>
    </div>
  );
}
