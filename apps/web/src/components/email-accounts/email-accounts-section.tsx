"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { EmailAccountList } from "./email-account-list";
import { AddEmailAccount } from "./add-email-account";
import type { EmailAccount } from "@coldjot/database";

interface EmailAccountsSectionProps {
  initialAccounts: EmailAccount[];
}

export function EmailAccountsSection({
  initialAccounts,
}: EmailAccountsSectionProps) {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [accounts, setAccounts] = useState<EmailAccount[]>(initialAccounts);

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
              setAccounts((prev) => [...prev, account]);
              setIsAddingAccount(false);
            }}
          />
        )}

        <EmailAccountList
          accounts={accounts}
          onAccountUpdated={(updatedAccount) => {
            setAccounts((prev) =>
              prev.map((acc) =>
                acc.id === updatedAccount.id ? updatedAccount : acc
              )
            );
          }}
          onAccountRemoved={(removedAccountId) => {
            setAccounts((prev) =>
              prev.filter((acc) => acc.id !== removedAccountId)
            );
          }}
        />
      </div>
    </div>
  );
}
