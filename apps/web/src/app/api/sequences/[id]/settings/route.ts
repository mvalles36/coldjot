import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";
import type { BusinessHours } from "@mailjot/types";

interface UpdateSettingsBody {
  name?: string;
  accessLevel?: "team" | "private";
  testMode?: boolean;
  scheduleType?: "business" | "custom";
  businessHours?: BusinessHours;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as UpdateSettingsBody;
    const { id } = await params;

    // Validate sequence ownership
    const existingSequence = await prisma.sequence.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingSequence) {
      return new NextResponse("Sequence not found", { status: 404 });
    }

    // Start a transaction to update sequence and business hours
    const result = await prisma.$transaction(async (tx) => {
      // Update sequence settings
      const sequence = await tx.sequence.update({
        where: {
          id,
          userId: session.user.id,
        },
        data: {
          ...(body.name && { name: body.name }),
          ...(body.accessLevel && { accessLevel: body.accessLevel }),
          ...(typeof body.testMode === "boolean" && {
            testMode: body.testMode,
          }),
          ...(body.scheduleType && { scheduleType: body.scheduleType }),
        },
        include: {
          businessHours: true,
        },
      });

      // Handle business hours if provided
      if (body.scheduleType === "business" && body.businessHours) {
        const businessHours = await tx.businessHours.upsert({
          where: { sequenceId: id },
          create: {
            sequenceId: id,
            timezone: body.businessHours.timezone,
            workDays: body.businessHours.workDays,
            workHours: {
              start: body.businessHours.workHours.start,
              end: body.businessHours.workHours.end,
            },
            holidays: body.businessHours.holidays.map((h) => new Date(h)),
          },
          update: {
            timezone: body.businessHours.timezone,
            workDays: body.businessHours.workDays,
            workHours: {
              start: body.businessHours.workHours.start,
              end: body.businessHours.workHours.end,
            },
            holidays: body.businessHours.holidays.map((h) => new Date(h)),
          },
        });
        return { ...sequence, businessHours };
      } else if (body.scheduleType === "custom") {
        // Remove business hours if schedule type is custom
        await tx.businessHours.deleteMany({
          where: { sequenceId: id },
        });
      }

      return sequence;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[SEQUENCE_SETTINGS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
