import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email-service";

export async function POST(
  req: Request,
  { params }: { params: { id: string; stepId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id, stepId } = await params;
    const { contactId } = await req.json();

    // Get step and contact details
    const step = await prisma.sequenceStep.findUnique({
      where: { id: stepId },
      include: {
        sequence: true,
      },
    });

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!step || !contact) {
      return new NextResponse("Step or contact not found", { status: 404 });
    }

    // Send email using mock service
    const result = await emailService.sendEmail({
      to: contact.email,
      subject: step.subject || "(No subject)",
      content: step.content || "",
      sequenceId: id,
      stepId,
    });

    // Update sequence contact status
    await prisma.sequenceContact.update({
      where: {
        sequenceId_contactId: {
          sequenceId: id,
          contactId,
        },
      },
      data: {
        status: result.status === "sent" ? "sent" : "failed",
        currentStep: result.status === "sent" ? { increment: 1 } : undefined,
      },
    });

    // Update step status
    await prisma.sequenceStep.update({
      where: { id: stepId },
      data: {
        status: result.status === "sent" ? "sent" : "failed",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending email:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
