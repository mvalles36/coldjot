import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";
import { toast } from "react-hot-toast";
import type { BusinessHours } from "@/types/sequences";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

interface BusinessHoursSettingsProps {
  sequenceId: string;
  initialSettings?: BusinessHours;
  scheduleType: "business" | "custom";
  //   onSettingsChange?: (
  //     settings: BusinessHours & { scheduleType: "business" | "custom" }
  //   ) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  workDays: [1, 2, 3, 4, 5], // Monday to Friday
  workHours: {
    start: "09:00",
    end: "17:00",
  },
  holidays: [],
};

export function BusinessHoursSettings({
  sequenceId,
  initialSettings,
  scheduleType: initialScheduleType,
}: //   onSettingsChange,
BusinessHoursSettingsProps) {
  const [settings, setSettings] = useState<BusinessHours>(
    initialSettings || DEFAULT_BUSINESS_HOURS
  );
  const [scheduleType, setScheduleType] = useState<"business" | "custom">(
    initialScheduleType
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleWorkDayToggle = (day: number) => {
    const newWorkDays = settings.workDays.includes(day)
      ? settings.workDays.filter((d) => d !== day)
      : [...settings.workDays, day].sort();

    setSettings({ ...settings, workDays: newWorkDays });
  };

  const handleTimeChange = (type: "start" | "end", value: string) => {
    const newWorkHours = {
      ...settings.workHours,
      [type]: value,
    };
    setSettings({ ...settings, workHours: newWorkHours });
  };

  const handleTimezoneChange = (value: string) => {
    setSettings({ ...settings, timezone: value });
  };

  const handleScheduleTypeChange = (value: "business" | "custom") => {
    setScheduleType(value);
    setSettings(initialSettings || DEFAULT_BUSINESS_HOURS);
  };

  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleType,
          ...(scheduleType === "business" && {
            businessHours: {
              ...settings,
              holidays: settings.holidays || [],
            },
          }),
        }),
      });

      if (!response.ok) throw new Error("Failed to update business hours");

      const data = await response.json();
      setSettings(data.businessHours || DEFAULT_BUSINESS_HOURS);
      //   onSettingsChange?.({
      //     ...settings,
      //     scheduleType,
      //   });
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error updating business hours:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Sequence Schedule Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Schedule Type</Label>
          <Select
            value={scheduleType}
            onValueChange={handleScheduleTypeChange}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select schedule type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="business">Business Hours</SelectItem>
              <SelectItem value="custom">Custom Schedule</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-sm text-muted-foreground">
            {scheduleType === "business"
              ? "Emails will be sent during business hours only"
              : "Emails will be sent according to custom schedule"}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Timezone</Label>
            <Select
              value={settings.timezone}
              onValueChange={handleTimezoneChange}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {Intl.supportedValuesOf("timeZone").map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Active Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={
                    settings.workDays.includes(day.value)
                      ? "default"
                      : "outline"
                  }
                  onClick={() => handleWorkDayToggle(day.value)}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 min-w-[60px]",
                    settings.workDays.includes(day.value) &&
                      "bg-primary text-primary-foreground"
                  )}
                >
                  {day.label}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Select the days when emails can be sent
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time</Label>
              <TimePicker
                value={settings.workHours.start}
                onChange={(value) => handleTimeChange("start", value)}
                disabled={isLoading || scheduleType === "business"}
              />
              {scheduleType === "business" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Fixed to business hours
                </p>
              )}
            </div>
            <div>
              <Label>End Time</Label>
              <TimePicker
                value={settings.workHours.end}
                onChange={(value) => handleTimeChange("end", value)}
                disabled={isLoading || scheduleType === "business"}
              />
              {scheduleType === "business" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Fixed to business hours
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSaveSettings} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Schedule Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
