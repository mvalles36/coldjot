"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DevSettings } from "@mailjot/types";
import { Separator } from "@/components/ui/separator";
import { useDevSettings } from "@/hooks/use-dev-settings";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { SequenceStatus } from "@mailjot/types";

interface SequenceDevSettingsProps {
  sequenceId: string;
  testMode: boolean;
  onTestModeChange: (checked: boolean) => void;
  onStatusChange?: (newStatus: SequenceStatus) => void;
}

interface GmailWatchStatus {
  watching: boolean;
  expiration: string | null;
}

export function SequenceDevSettings({
  sequenceId,
  testMode,
  onTestModeChange,
  onStatusChange,
}: SequenceDevSettingsProps) {
  const { settings, isLoading, updateSettings } = useDevSettings();
  const [newEmail, setNewEmail] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch Gmail watch status
  const { data: watchStatus, isLoading: watchStatusLoading } =
    useQuery<GmailWatchStatus>({
      queryKey: ["gmail-watch-status"],
      queryFn: async () => {
        const res = await fetch("/api/gmail/watch");
        if (!res.ok) throw new Error("Failed to fetch Gmail watch status");
        return res.json();
      },
    });

  // Toggle Gmail watch mutation
  const toggleWatch = useMutation({
    mutationFn: async (enable: boolean) => {
      setIsUpdating(true);
      const res = await fetch("/api/gmail/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: enable ? "start" : "stop" }),
      });
      if (!res.ok) throw new Error("Failed to update Gmail watch status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-watch-status"] });
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  const handleToggleWatch = useCallback(
    async (checked: boolean) => {
      try {
        await toggleWatch.mutateAsync(checked);
      } catch (error) {
        console.error("Failed to toggle Gmail watch:", error);
      }
    },
    [toggleWatch]
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleTestModeChange = async (checked: boolean) => {
    try {
      const response = await fetch(`/api/sequences/${sequenceId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testMode: checked,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update sequence test mode");
      }

      onTestModeChange(checked);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update test mode",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings(settings);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save development settings",
        variant: "destructive",
      });
    }
  };

  const handleAddEmail = () => {
    if (!newEmail || !newEmail.includes("@")) return;
    updateSettings((prev: DevSettings) => ({
      ...prev,
      testEmails: [...prev.testEmails, newEmail],
    }));
    setNewEmail("");
  };

  const handleRemoveEmail = (email: string) => {
    updateSettings((prev: DevSettings) => ({
      ...prev,
      testEmails: prev.testEmails.filter((e: string) => e !== email),
    }));
  };

  const handleReset = async () => {
    try {
      const response = await fetch(`/api/sequences/${sequenceId}/reset`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reset sequence");
      }

      onStatusChange?.(SequenceStatus.DRAFT);

      toast({
        title: "Sequence Reset",
        description: "Sequence has been reset successfully",
      });

      // Refresh the page to show updated state
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset sequence",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">
            Development Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              These settings are for development purposes only and should not be
              used in production.
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Test Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Send emails to test recipients only
                  </div>
                </div>
                <Switch
                  checked={testMode}
                  onCheckedChange={handleTestModeChange}
                />
              </div>

              {testMode && (
                <Alert
                  variant="default"
                  className="bg-yellow-50 border-yellow-200"
                >
                  <AlertDescription className="text-yellow-600">
                    Emails will only be sent to test recipients for testing
                    purposes
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Disable Email Sending</Label>
                <div className="text-sm text-muted-foreground">
                  Emails won't be sent but will be logged in the console
                </div>
              </div>
              <Switch
                checked={settings.disableSending}
                onCheckedChange={(checked) =>
                  updateSettings((prev: DevSettings) => ({
                    ...prev,
                    disableSending: checked,
                  }))
                }
              />
            </div>

            <div className="space-y-4">
              <Separator />

              <div className="space-y-2">
                <div className="space-y-1">
                  <Label>Test Recipient Emails</Label>
                  <div className="text-sm text-muted-foreground">
                    Emails will be sent to these addresses in test mode
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                  />
                  <Button onClick={handleAddEmail}>Add</Button>
                </div>

                <div className="space-y-2 mt-4">
                  {(settings.testEmails || []).map((email: string) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-2 rounded-md border bg-muted/40"
                    >
                      <span className="text-sm">{email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEmail(email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive">
                Danger Zone
              </h4>
              <p className="text-sm text-muted-foreground">
                Reset the sequence to its initial state. This will clear all
                progress and allow you to launch the sequence again.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleReset}
              className="w-full"
            >
              Reset Sequence
            </Button>
          </div>

          <Button onClick={handleSaveSettings} className="w-full">
            Save Development Settings
          </Button>

          {/* Gmail Watch Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="gmail-watch">Gmail Reply Tracking</Label>
                <div className="text-sm text-muted-foreground">
                  Monitor Gmail for replies to sequence emails
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {watchStatus?.expiration && watchStatus.watching && (
                  <Badge variant="secondary" className="mr-2">
                    Expires in{" "}
                    {formatDistanceToNow(new Date(watchStatus.expiration))}
                  </Badge>
                )}
                <Switch
                  id="gmail-watch"
                  checked={watchStatus?.watching || false}
                  onCheckedChange={handleToggleWatch}
                  disabled={isLoading || isUpdating}
                />
              </div>
            </div>
            {isUpdating && (
              <div className="text-sm text-muted-foreground">
                Updating Gmail watch status...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
