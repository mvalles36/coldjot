"use client";

import { EmailAccountCard } from "./email-account-card";
import type { EmailAccount } from "@prisma/client";

interface EmailAccountListProps {
  accounts: EmailAccount[];
  onAccountUpdated: (account: EmailAccount) => void;
  onAccountRemoved: (accountId: string) => void;
}

export function EmailAccountList({
  accounts,
  onAccountUpdated,
  onAccountRemoved,
}: EmailAccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/10">
        <p className="text-sm text-muted-foreground">
          No email accounts added yet. Add an account to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <EmailAccountCard
          key={account.id}
          account={account}
          onUpdate={onAccountUpdated}
          onRemove={onAccountRemoved}
        />
      ))}
    </div>
  );
}
