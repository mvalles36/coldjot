"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface LaunchSequenceModalProps {
  open: boolean;
  onClose: () => void;
  sequence: {
    id: string;
    name: string;
    steps: any[];
    _count: {
      contacts: number;
    };
  };
}

export function LaunchSequenceModal({
  open,
  onClose,
  sequence,
}: LaunchSequenceModalProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const router = useRouter();

  const handleLaunch = async () => {
    try {
      setIsLaunching(true);
      const response = await fetch(`/api/sequences/${sequence.id}/launch`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to launch sequence");

      toast.success("Sequence launched successfully");
      router.refresh();
      onClose();
    } catch (error) {
      toast.error("Failed to launch sequence");
    } finally {
      setIsLaunching(false);
    }
  };

  const canLaunch = sequence.steps.length > 0 && sequence._count.contacts > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Launch Sequence</DialogTitle>
          <DialogDescription>
            Are you sure you want to launch this sequence?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm space-y-2">
            <p>
              <strong>Sequence:</strong> {sequence.name}
            </p>
            <p>
              <strong>Steps:</strong> {sequence.steps.length}
            </p>
            <p>
              <strong>Contacts:</strong> {sequence._count.contacts}
            </p>
          </div>

          {!canLaunch && (
            <div className="text-sm text-destructive">
              {sequence.steps.length === 0 && (
                <p>• Add at least one step to launch the sequence</p>
              )}
              {sequence._count.contacts === 0 && (
                <p>• Add contacts to launch the sequence</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleLaunch} disabled={!canLaunch || isLaunching}>
              {isLaunching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Launching...
                </>
              ) : (
                "Launch Sequence"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
