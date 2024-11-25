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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface LaunchSequenceModalProps {
  sequenceId: string;
  open: boolean;
  onClose: () => void;
  contactCount: number;
  onLaunch?: () => void;
}

export function LaunchSequenceModal({
  sequenceId,
  open,
  onClose,
  contactCount,
  onLaunch,
}: LaunchSequenceModalProps) {
  const [isTestMode, setIsTestMode] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLaunch = async () => {
    try {
      setIsLoading(true);

      // Update sequence with demo mode and status
      const response = await fetch(`/api/sequences/${sequenceId}/launch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          demoMode: isTestMode,
        }),
      });

      if (!response.ok) throw new Error("Failed to launch sequence");

      toast({
        title: "Sequence Launched",
        description: isTestMode
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

          {/* Test Mode Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Test Mode</h4>
                <p className="text-sm text-muted-foreground">
                  Send emails to test recipients only
                </p>
              </div>
              <Switch
                id="test-mode"
                checked={isTestMode}
                onCheckedChange={setIsTestMode}
              />
            </div>

            {isTestMode ? (
              <Alert
                variant="default"
                className="bg-yellow-50 border-yellow-200"
              >
                <AlertDescription className="flex flex-row items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  Emails will only be sent to demo recipients for testing.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="default" className="bg-green-50 border-green-200">
                {/* <AlertTitle>Heads up!</AlertTitle> */}
                <AlertDescription className="flex flex-row items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Emails will be sent to actual contacts in the sequence
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

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
