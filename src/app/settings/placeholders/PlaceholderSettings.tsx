"use client";

import { useState } from "react";
import { PlaceholderFallback } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import {
  DEFAULT_PLACEHOLDERS,
  Placeholder,
} from "@/components/email/PlaceholderButton";

interface Props {
  initialFallbacks: PlaceholderFallback[];
}

export default function PlaceholderSettings({ initialFallbacks }: Props) {
  const [fallbacks, setFallbacks] = useState<Record<string, string>>(
    initialFallbacks.reduce((acc, curr) => {
      acc[curr.name] = curr.value;
      return acc;
    }, {} as Record<string, string>)
  );

  const handleSave = async (name: string, value: string) => {
    try {
      const response = await fetch("/api/placeholders/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value }),
      });

      if (!response.ok) throw new Error("Failed to save fallback");
      toast.success("Fallback value saved");
    } catch (error) {
      toast.error("Failed to save fallback value");
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Set default values for placeholders when no specific value is available.
      </p>

      <div className="grid gap-6">
        {DEFAULT_PLACEHOLDERS.map((placeholder: Placeholder) => (
          <div key={placeholder.name} className="space-y-2">
            <Label htmlFor={placeholder.name}>{placeholder.label}</Label>
            <div className="flex gap-2">
              <Input
                id={placeholder.name}
                value={fallbacks[placeholder.name] || ""}
                onChange={(e) =>
                  setFallbacks((prev) => ({
                    ...prev,
                    [placeholder.name]: e.target.value,
                  }))
                }
                placeholder={`Default value for ${placeholder.label.toLowerCase()}`}
              />
              <Button
                variant="outline"
                onClick={() =>
                  handleSave(
                    placeholder.name,
                    fallbacks[placeholder.name] || ""
                  )
                }
              >
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {placeholder.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
