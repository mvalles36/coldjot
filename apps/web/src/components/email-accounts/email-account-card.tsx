"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Mail, Trash2, Settings, Tag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AliasList } from "./alias-list";
import { useToast } from "@/hooks/use-toast";
import type { EmailAccount } from "@prisma/client";

interface EmailAccountCardProps {
  account: EmailAccount;
  onUpdate: (account: EmailAccount) => void;
  onRemove: (accountId: string) => void;
}

export function EmailAccountCard({
  account,
  onUpdate,
  onRemove,
}: EmailAccountCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showAliases, setShowAliases] = useState(false);
  const { toast } = useToast();

  const handleToggleActive = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/email-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update account status");

      const updatedAccount = await response.json();
      onUpdate(updatedAccount);

      toast({
        title: "Success",
        description: `Account ${account.isActive ? "disabled" : "enabled"} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update account status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Are you sure you want to remove this email account?")) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/email-accounts/${account.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove account");

      onRemove(account.id);
      toast({
        title: "Success",
        description: "Email account removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove email account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium">
                {account.name || account.email}
              </h4>
              <p className="text-sm text-muted-foreground">{account.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant={account.isDefault ? "default" : "secondary"}>
              {account.isDefault ? "Default" : "Secondary"}
            </Badge>
            <Switch
              checked={account.isActive}
              onCheckedChange={handleToggleActive}
              disabled={isLoading}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowAliases(!showAliases)}>
                  <Tag className="h-4 w-4 mr-2" />
                  {showAliases ? "Hide Aliases" : "Show Aliases"}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleRemove}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {showAliases && (
        <CardContent className="p-4 pt-0">
          <AliasList accountId={account.id} />
        </CardContent>
      )}
    </Card>
  );
}
