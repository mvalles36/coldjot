import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/auth";
import { prisma } from "@coldjot/database";
import { gmail_v1 } from "googleapis";

interface RouteParams {
  params: Promise<{
    accountId: string;
  }>;
}

type Schema$SendAs = gmail_v1.Schema$SendAs;

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { accountId } = await params;

    // Verify account ownership and get credentials
    const account = await prisma.emailAccount.findUnique({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      include: {
        aliases: true,
      },
    });

    if (!account) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (account.provider !== "gmail") {
      return new NextResponse("Only Gmail accounts supported", { status: 400 });
    }

    // Initialize Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID_EMAIL,
      process.env.GOOGLE_CLIENT_SECRET_EMAIL,
      `http://localhost:3000/api/email-accounts/gmail/callback`
    );

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt ? account.expiresAt * 1000 : undefined,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    try {
      // Fetch Gmail settings including send-as aliases
      const { data: settings } = await gmail.users.settings.sendAs.list({
        userId: "me",
      });

      // Get current aliases
      const currentAliases = new Set(account.aliases.map((a) => a.alias));

      // Filter out primary email and prepare alias data
      const gmailAliases = new Set(
        settings.sendAs
          ?.filter((sendAs) => !sendAs.isPrimary && sendAs.sendAsEmail)
          .map((sendAs) => sendAs.sendAsEmail as string) || []
      );

      // Find aliases to create and delete
      const aliasesToCreate = Array.from(gmailAliases)
        .filter((alias) => !currentAliases.has(alias))
        .map((alias) => {
          const sendAs = settings.sendAs?.find((s) => s.sendAsEmail === alias);
          return {
            alias,
            name: sendAs?.displayName || null,
            emailAccountId: accountId,
          };
        });

      const aliasesToDelete = Array.from(currentAliases).filter(
        (alias) => !gmailAliases.has(alias)
      );

      // Perform updates in a transaction
      await prisma.$transaction(async (tx) => {
        // Delete removed aliases
        if (aliasesToDelete.length > 0) {
          await tx.emailAlias.deleteMany({
            where: {
              emailAccountId: accountId,
              alias: { in: aliasesToDelete },
            },
          });
        }

        // Create new aliases
        if (aliasesToCreate.length > 0) {
          await tx.emailAlias.createMany({
            data: aliasesToCreate,
          });
        }
      });

      // Fetch updated account with aliases
      const updatedAccount = await prisma.emailAccount.findUnique({
        where: { id: accountId },
        include: { aliases: true },
      });

      if (!updatedAccount) {
        throw new Error("Failed to fetch updated account");
      }

      return NextResponse.json(updatedAccount);
    } catch (error: any) {
      console.error("[GMAIL_ALIASES_REFRESH] Gmail API Error:", {
        message: error.message,
        response: error.response?.data,
      });
      return new NextResponse("Failed to refresh Gmail aliases", {
        status: 500,
      });
    }
  } catch (error) {
    console.error("[EMAIL_ALIASES_REFRESH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
