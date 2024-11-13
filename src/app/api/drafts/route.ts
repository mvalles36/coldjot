import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createGmailDraft } from "@/lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const json = await request.json();
  const { contactId, templateId, content, sections } = json;

  try {
    // Get the user's account with tokens
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
      select: {
        access_token: true,
      },
    });

    if (!account?.access_token) {
      return new NextResponse("No access token found", { status: 401 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return new NextResponse("Contact not found", { status: 404 });
    }

    const fullContent = [
      content,
      ...sections.map((section: any) => section.content),
    ].join("\n\n");

    // Create the draft in Gmail using the access token from the database
    const gmailDraftId = await createGmailDraft({
      accessToken: account.access_token,
      to: contact.email,
      subject: "Draft Email",
      content: fullContent,
    });

    // Save the draft in our database
    const draft = await prisma.draft.create({
      data: {
        userId: session.user.id,
        contactId,
        templateId,
        content: fullContent,
        gmailDraftId,
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("Failed to create draft:", error);
    return new NextResponse("Failed to create draft", { status: 500 });
  }
}
