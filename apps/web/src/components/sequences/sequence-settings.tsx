"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BusinessHoursSettings } from "@/components/sequences/business-hours-settings";
import { SequenceDevSettings } from "@/components/sequences/sequence-dev-settings";
import { toast } from "react-hot-toast";
import type { BusinessHours } from "@coldjot/types";

interface SequenceSettingsProps {
  sequence: {
    id: string;
    name: string;
    accessLevel: "team" | "private";
    scheduleType: "business" | "custom";
    businessHours?: BusinessHours;
    testMode: boolean;
  };
}

export function SequenceSettings({ sequence }: SequenceSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(sequence.name);
  const [accessLevel, setAccessLevel] = useState(sequence.accessLevel);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/sequences/${sequence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          accessLevel,
        }),
      });

      if (!response.ok) throw new Error("Failed to update sequence");

      toast.success("Settings updated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Sequence Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Access Level</Label>
              <Select
                value={accessLevel}
                onValueChange={(value) =>
                  setAccessLevel(value as "team" | "private")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Team can view and use</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <BusinessHoursSettings
        sequenceId={sequence.id}
        initialSettings={sequence.businessHours}
        scheduleType={sequence.scheduleType}
      />

      {process.env.NODE_ENV === "development" && (
        <div className="pt-6">
          <SequenceDevSettings
            sequenceId={sequence.id}
            testMode={sequence.testMode}
            onTestModeChange={() => {
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}
