"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EmailAccount } from "@prisma/client";

interface AddEmailAccountProps {
  onClose: () => void;
  onAccountAdded: (account: EmailAccount) => void;
}

export function AddEmailAccount({
  onClose,
  onAccountAdded,
}: AddEmailAccountProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    isDefault: false,
  });
  const { toast } = useToast();

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, provider: "manual" }),
      });

      if (!response.ok) throw new Error("Failed to add email account");

      const newAccount = await response.json();
      onAccountAdded(newAccount);
      toast({
        title: "Success",
        description: "Email account added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add email account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGmailSignIn = async () => {
    try {
      setIsLoading(true);
      // Start Gmail OAuth flow
      const response = await fetch("/api/email-accounts/gmail/auth", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to start Gmail authentication");

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start Gmail authentication",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">Add Email Account</h3>
        <p className="text-sm text-muted-foreground">
          Add a new email account to send emails from
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gmail" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gmail">Gmail Account</TabsTrigger>
            <TabsTrigger value="manual">Manual Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="gmail" className="mt-4">
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Connect your Gmail account to send emails directly through
                  Gmail
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleGmailSignIn}
                disabled={isLoading}
              >
                <Mail className="w-4 h-4 mr-2" />
                {isLoading ? "Connecting..." : "Sign in with Gmail"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Display Name (Optional)</Label>
                <Input
                  id="name"
                  placeholder="Enter a display name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Set as Default</Label>
                  <p className="text-sm text-muted-foreground">
                    Use this account as the default sender
                  </p>
                </div>
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isDefault: checked }))
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Adding..." : "Add Account"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
