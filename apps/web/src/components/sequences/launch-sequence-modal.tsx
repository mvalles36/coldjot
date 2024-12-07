"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";

interface LaunchSequenceModalProps {
  sequenceId: string;
  open: boolean;
  onClose: () => void;
  contactCount: number;
  onLaunch?: () => void;
  testMode?: boolean;
}

export function LaunchSequenceModal({
  sequenceId,
  open,
  onClose,
  contactCount,
  onLaunch,
  testMode = false,
}: LaunchSequenceModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLaunch = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/sequences/${sequenceId}/launch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testMode,
        }),
      });

      if (!response.ok) throw new Error("Failed to launch sequence");

      toast({
        title: "Sequence Launched",
        description: testMode
          ? "Sequence started in test mode"
          : "Sequence started successfully",
      });

      onLaunch?.();
      onClose();
    } catch (error) {
      console.error("Error launching sequence:", error);
      toast({
        title: "Error",
        description: "Failed to launch sequence",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Launch Sequence</DialogTitle>
          <DialogDescription>
            Review your sequence settings before launching
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Contact Count Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Contacts to process</h4>
                <p className="text-sm text-muted-foreground">
                  {contactCount} contact{contactCount !== 1 ? "s" : ""} will be
                  processed
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Test Mode Info */}
          {testMode && (
            <>
              <Alert
                variant="default"
                className="bg-yellow-50 border-yellow-200"
              >
                <AlertDescription className="text-yellow-600">
                  Test Mode is enabled. Emails will only be sent to test
                  recipients.
                </AlertDescription>
              </Alert>
              <Separator />
            </>
          )}

          {/* Pre-launch Checklist */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Pre-launch checklist</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                All steps are configured correctly
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Email content has been reviewed
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Contact list has been verified
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleLaunch}
              disabled={isLoading}
              className="min-w-[100px]"
            >
              {isLoading ? "Launching..." : "Launch"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
