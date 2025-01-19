"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Mail,
  MoreVertical,
  RefreshCw,
  Check,
} from "lucide-react";
import { Mailbox, EmailAlias } from "@coldjot/database";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type EmailAccountWithAliases = Mailbox & {
  aliases: EmailAlias[];
  defaultAliasId: string | null;
};

interface EmailAccountListProps {
  accounts: EmailAccountWithAliases[];
  onAccountUpdate: (
    accountId: string,
    data: Partial<EmailAccountWithAliases>
  ) => Promise<void>;
  onAccountDelete: (accountId: string) => Promise<void>;
  onAliasesRefresh: (accountId: string) => Promise<void>;
}

export function EmailAccountList({
  accounts,
  onAccountUpdate,
  onAccountDelete,
  onAliasesRefresh,
}: EmailAccountListProps) {
  const { toast } = useToast();
  const [expandedAccounts, setExpandedAccounts] = useState<
    Record<string, boolean>
  >({});
  const [selectedAliases, setSelectedAliases] = useState<
    Record<string, string>
  >(() => {
    // Initialize with defaultAliasId or primary email
    return accounts.reduce(
      (acc, account) => {
        const defaultAlias = account.aliases.find(
          (a) => a.id === account.defaultAliasId
        );
        acc[account.id] = defaultAlias?.alias || account.email;
        return acc;
      },
      {} as Record<string, string>
    );
  });

  const handleToggleExpand = (accountId: string) => {
    setExpandedAccounts((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const handleRefreshAliases = async (accountId: string) => {
    try {
      await onAliasesRefresh(accountId);
      toast({
        title: "Aliases refreshed",
        description: "Your email aliases have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh aliases. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAliasSelect = async (accountId: string, alias: string) => {
    try {
      // Find the alias ID
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;

      const selectedAlias = account.aliases.find((a) => a.alias === alias);
      const defaultAliasId = selectedAlias?.id;

      // Update the selected alias in state
      setSelectedAliases((prev) => ({
        ...prev,
        [accountId]: alias,
      }));

      // Update the account settings in the database
      await onAccountUpdate(accountId, {
        defaultAliasId: defaultAliasId || null,
      });

      toast({
        title: "Alias selected",
        description: "Your default sending alias has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update sending alias. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {accounts.map((account) => {
        const selectedAlias = selectedAliases[account.id] || account.email;
        const allAliases = [
          { alias: account.email, name: account.name || account.email },
          ...account.aliases,
        ];

        return (
          <div
            key={account.id}
            className="rounded-lg border bg-card text-card-foreground shadow-sm"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="-ml-2 h-auto justify-start px-2 py-1.5 focus-visible:ring-0"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="flex flex-col items-start">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">
                                {account.name || account.email}
                              </span>
                              {account.isDefault && (
                                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                  Default
                                </span>
                              )}
                              {!account.isActive && (
                                <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                              <span>Send as:</span>
                              <span className="font-medium text-foreground">
                                {selectedAlias}
                              </span>
                              <ChevronDown className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[300px]">
                      <DropdownMenuLabel>Send As</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={selectedAlias}
                        onValueChange={(value) =>
                          handleAliasSelect(account.id, value)
                        }
                      >
                        {allAliases.map((alias) => (
                          <DropdownMenuRadioItem
                            key={alias.alias}
                            value={alias.alias}
                            className="flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {alias.name || alias.alias}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {alias.alias}
                              </span>
                            </div>
                            {selectedAlias === alias.alias && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {account.provider === "gmail" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRefreshAliases(account.id)}
                    title="Refresh Aliases"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleExpand(account.id)}
                  title={
                    expandedAccounts[account.id]
                      ? "Hide Aliases"
                      : "Show Aliases"
                  }
                >
                  {expandedAccounts[account.id] ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() =>
                        onAccountUpdate(account.id, { isDefault: true })
                      }
                      className={cn(account.isDefault && "bg-accent")}
                    >
                      Set as Default
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onAccountUpdate(account.id, {
                          isActive: !account.isActive,
                        })
                      }
                    >
                      {account.isActive ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onAccountDelete(account.id)}
                      className="text-destructive"
                    >
                      Remove Account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {expandedAccounts[account.id] && (
              <div className="border-t p-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Aliases</h4>
                  {account.aliases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No aliases found
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {account.aliases.map((alias) => (
                        <div
                          key={alias.id}
                          className="flex items-center justify-between rounded-md border p-2"
                        >
                          <div>
                            <div className="font-medium">
                              {alias.name || alias.alias}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {alias.alias}
                            </div>
                          </div>
                          {selectedAlias === alias.alias && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
