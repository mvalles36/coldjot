import { prisma } from "@coldjot/database";
import { EmailAlias, Mailbox, MailboxCredentials } from "@coldjot/types";

/**
 * Get user's mailbox details
 */
export async function getSenderMailbox(
  userId: string,
  mailboxId: string
): Promise<Mailbox | null> {
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: mailboxId, userId: userId },
    include: {
      aliases: true,
    },
  });

  if (
    !mailbox?.providerAccountId ||
    !mailbox?.access_token ||
    !mailbox?.refresh_token
  ) {
    return null;
  }

  let defaultAlias: EmailAlias | undefined = undefined;
  if (mailbox.defaultAliasId && mailbox.aliases?.length) {
    defaultAlias = mailbox.aliases.find(
      (alias) => alias.id === mailbox.defaultAliasId
    );
  }

  return {
    id: mailbox.id,
    name: defaultAlias?.name || mailbox.name || "",
    email: defaultAlias?.alias || mailbox.email || "",
    accessToken: mailbox.access_token,
    refreshToken: mailbox.refresh_token,
    expiryDate: mailbox.expires_at || 0,
    // aliases: mailbox.aliases,
    // defaultAliasId: mailbox.defaultAliasId || undefined,
  };
}

/**
 * Update mailbox details
 */
export async function updateMailboxCredentials(
  mailboxId: string,
  data: Partial<MailboxCredentials>
) {
  try {
    const updatedMailbox = await prisma.mailbox.update({
      where: { id: mailboxId },
      data: {
        access_token: data.accessToken,
        expires_at: data.expiryDate ? data.expiryDate / 1000 : null,
        // id_token: credentials.id_token,
      },
    });
    console.log(`🔄 Updated mailbox: ${updatedMailbox}`);
  } catch (error) {
    console.error(`❌ Error updating mailbox: ${error}`);
  }
}
