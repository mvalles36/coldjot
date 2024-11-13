"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

export default function EmailSettings() {
  const [defaultSubject, setDefaultSubject] = useState("");
  const [defaultSignature, setDefaultSignature] = useState("");

  const handleSave = async () => {
    try {
      // TODO: Implement API endpoint to save email settings
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">
        Email Preferences
      </h2>

      <Card>
        <CardHeader>
          <CardTitle>Default Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultSubject">Default Subject Line</Label>
            <Input
              id="defaultSubject"
              value={defaultSubject}
              onChange={(e) => setDefaultSubject(e.target.value)}
              placeholder="Enter default subject line"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultSignature">Email Signature</Label>
            <Input
              id="defaultSignature"
              value={defaultSignature}
              onChange={(e) => setDefaultSignature(e.target.value)}
              placeholder="Enter your email signature"
            />
          </div>

          <Button onClick={handleSave}>Save Preferences</Button>
        </CardContent>
      </Card>
    </div>
  );
}
