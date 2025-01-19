"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { EmailAccountList } from "./email-account-list";
import { AddEmailAccount } from "./add-email-account";
import type { EmailAccount, EmailAlias } from "@coldjot/database";

interface EmailAccountWithAliases extends EmailAccount {
  aliases: EmailAlias[];
}

interface EmailAccountsSectionProps {
  initialAccounts: EmailAccountWithAliases[];
}

export function EmailAccountsSection({
  initialAccounts,
}: EmailAccountsSectionProps) {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [accounts, setAccounts] =
    useState<EmailAccountWithAliases[]>(initialAccounts);

  const handleAccountUpdate = async (
    accountId: string,
    data: Partial<EmailAccount>
  ) => {
    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update account");

      const updatedAccount: EmailAccountWithAliases = await response.json();
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === accountId ? updatedAccount : account
        )
      );
    } catch (error) {
      console.error("[EMAIL_ACCOUNTS_UPDATE]", error);
      throw error;
    }
  };

  const handleAccountDelete = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete account");

      setAccounts((prev) => prev.filter((account) => account.id !== accountId));
    } catch (error) {
      console.error("[EMAIL_ACCOUNTS_DELETE]", error);
      throw error;
    }
  };

  const handleAliasesRefresh = async (accountId: string) => {
    try {
      const response = await fetch(
        `/api/email-accounts/${accountId}/aliases/refresh`,
        {
          method: "POST",
        }
      );

      if (!response.ok) throw new Error("Failed to refresh aliases");

      const updatedAccount: EmailAccountWithAliases = await response.json();
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === accountId ? updatedAccount : account
        )
      );
    } catch (error) {
      console.error("[EMAIL_ACCOUNTS_REFRESH_ALIASES]", error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Email Accounts</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your email accounts and aliases. Add multiple accounts to send
          emails from different addresses.
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-sm font-medium">Your Email Accounts</h4>
            <p className="text-sm text-muted-foreground">
              {accounts.length === 0
                ? "No email accounts added yet."
                : `You have ${accounts.length} email account${accounts.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <Button
            onClick={() => setIsAddingAccount(true)}
            disabled={isAddingAccount}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>

        {isAddingAccount && (
          <AddEmailAccount
            onClose={() => setIsAddingAccount(false)}
            onAccountAdded={(account) => {
              setAccounts((prev) => [
                ...prev,
                account as EmailAccountWithAliases,
              ]);
              setIsAddingAccount(false);
            }}
          />
        )}

        <EmailAccountList
          accounts={accounts}
          onAccountUpdate={handleAccountUpdate}
          onAccountDelete={handleAccountDelete}
          onAliasesRefresh={handleAliasesRefresh}
        />
      </div>
    </div>
  );
}
