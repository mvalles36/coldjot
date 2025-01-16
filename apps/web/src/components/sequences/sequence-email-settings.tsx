"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

interface SequenceEmailSettingsState {
  testMode: boolean;
  disableSending: boolean;
  testEmails: string[];
}

interface SequenceEmailSettingsProps {
  sequenceId: string;
  initialSettings: SequenceEmailSettingsState;
}

export function SequenceEmailSettings({
  sequenceId,
  initialSettings,
}: SequenceEmailSettingsProps) {
  const [settings, setSettings] = useState<SequenceEmailSettingsState>({
    testMode: initialSettings?.testMode ?? false,
    disableSending: initialSettings?.disableSending ?? false,
    testEmails: initialSettings?.testEmails ?? [],
  });
  const [newEmail, setNewEmail] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleTestModeChange = async (checked: boolean) => {
    try {
      setIsLoading(true);
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

      setSettings((prev) => ({ ...prev, testMode: checked }));
      router.refresh();

      toast({
        title: "Success",
        description: "Test mode updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update test mode",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableSendingChange = async (checked: boolean) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disableSending: checked,
        }),
      });

      if (!response.ok) throw new Error("Failed to update sending settings");

      setSettings((prev) => ({ ...prev, disableSending: checked }));
      toast({
        title: "Success",
        description: "Email sending settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email sending settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveTestEmails = async (emails: string[]) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testEmails: emails,
        }),
      });

      if (!response.ok) throw new Error("Failed to save test emails");

      toast({
        title: "Success",
        description: "Test email added successfully",
      });

      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save test emails",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) return;

    const updatedEmails = [...settings.testEmails, newEmail];
    const success = await saveTestEmails(updatedEmails);

    if (success) {
      setSettings((prev) => ({
        ...prev,
        testEmails: updatedEmails,
      }));
      setNewEmail("");
    }
  };

  const handleRemoveEmail = async (email: string) => {
    const updatedEmails = settings.testEmails.filter((e) => e !== email);
    const success = await saveTestEmails(updatedEmails);

    if (success) {
      setSettings((prev) => ({
        ...prev,
        testEmails: updatedEmails,
      }));
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b pb-3">
        <h3 className="text-lg font-semibold">Development Settings</h3>
        <p className="text-sm text-muted-foreground mt-1">
          These settings are for development and testing purposes. They help
          ensure emails are sent correctly during testing.
        </p>
      </div>

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
              checked={settings.testMode}
              onCheckedChange={handleTestModeChange}
              disabled={isLoading}
            />
          </div>

          {settings.testMode && (
            <Alert variant="default" className="bg-yellow-50 border-yellow-200">
              <AlertDescription className="text-yellow-600">
                Emails will only be sent to test recipients for testing purposes
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
            onCheckedChange={handleDisableSendingChange}
            disabled={isLoading}
          />
        </div>

        <Separator />

        <div className="space-y-4">
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
                disabled={isLoading}
              />
              <Button onClick={handleAddEmail} disabled={isLoading}>
                {isLoading ? "Adding..." : "Add"}
              </Button>
            </div>

            <div className="space-y-2 mt-4">
              {settings.testEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-2 rounded-md border bg-muted/40"
                >
                  <span className="text-sm">{email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEmail(email)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
