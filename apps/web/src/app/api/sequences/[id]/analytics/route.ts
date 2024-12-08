import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@mailjot/database";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get all email events for the sequence
    const events = await prisma.emailEvent.groupBy({
      by: ["type"],
      where: {
        sequenceId: id,
      },
      _count: true,
    });

    // Calculate metrics
    const totalSent = events.find((e) => e.type === "SENT")?._count || 0;
    const metrics = {
      totalEmails: totalSent,
      openRate: calculateRate(
        events.find((e) => e.type === "OPENED")?._count || 0,
        totalSent
      ),
      clickRate: calculateRate(
        events.find((e) => e.type === "CLICKED")?._count || 0,
        totalSent
      ),
      replyRate: calculateRate(
        events.find((e) => e.type === "REPLIED")?._count || 0,
        totalSent
      ),
      bounceRate: calculateRate(
        events.find((e) => e.type === "BOUNCED")?._count || 0,
        totalSent
      ),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error fetching sequence analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

function calculateRate(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}
