"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { PlayIcon, PauseIcon } from "lucide-react";
import { SequenceStatus } from "@mailjot/types";

interface SequenceControlsProps {
  sequenceId: string;
  initialStatus: SequenceStatus;
  onStatusChange: (newStatus: SequenceStatus) => void;
}

export function SequenceControls({
  sequenceId,
  initialStatus,
  onStatusChange,
}: SequenceControlsProps) {
  const [status, setStatus] = useState<SequenceStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const handleControl = async (action: SequenceStatus) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error("Failed to update sequence");

      const newStatus =
        action === SequenceStatus.PAUSED
          ? SequenceStatus.PAUSED
          : SequenceStatus.ACTIVE;
      setStatus(newStatus);
      onStatusChange(newStatus);

      toast({
        title: "Sequence Updated",
        description: `Sequence ${action} successfully`,
      });
    } catch (error) {
      console.error("Error controlling sequence:", error);
      toast({
        title: "Error",
        description: `Failed to ${action} sequence`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Only show controls for active or paused sequences
  if (status !== SequenceStatus.ACTIVE && status !== SequenceStatus.PAUSED) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="default"
      onClick={() =>
        handleControl(
          status === SequenceStatus.ACTIVE
            ? SequenceStatus.PAUSED
            : SequenceStatus.ACTIVE
        )
      }
      disabled={isLoading}
      className="min-w-[100px]"
    >
      {status === SequenceStatus.ACTIVE ? (
        <>
          <PauseIcon className="h-4 w-4 mr-2" />
          Pause
        </>
      ) : (
        <>
          <PlayIcon className="h-4 w-4 mr-2" />
          Resume
        </>
      )}
    </Button>
  );
}
