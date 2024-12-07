"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { PlayIcon, PauseIcon } from "lucide-react";

interface SequenceControlsProps {
  sequenceId: string;
  initialStatus: string;
}

export function SequenceControls({
  sequenceId,
  initialStatus,
}: SequenceControlsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleControl = async (action: "pause" | "resume") => {
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

      const newStatus = action === "pause" ? "paused" : "active";
      setStatus(newStatus);

      toast({
        title: "Sequence Updated",
        description: `Sequence ${action}d successfully`,
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

  if (status !== "active" && status !== "paused") return null;

  return (
    <Button
      variant="outline"
      size="default"
      onClick={() => handleControl(status === "active" ? "pause" : "resume")}
      disabled={isLoading}
      className="min-w-[100px]"
    >
      {status === "active" ? (
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
