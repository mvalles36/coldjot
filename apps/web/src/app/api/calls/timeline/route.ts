import { prisma } from "@coldjot/database";
import { NextResponse } from "next/server";

// Helper function to transform raw call data
function transformCallData(call: any) {
  return {
    id: call.id,
    sequenceId: call.sequenceId,
    contactId: call.contactId,
    stepId: call.stepId,
    status: call.status,
    callId: call.callId,
    duration: call.duration,
    summary: call.summary,
    startedAt: call.startedAt,
    completedAt: call.completedAt,
    metadata: call.metadata || {},
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
    contact: call.contact
      ? {
          name: call.contact.name,
          email: call.contact.email,
          phone: call.contact.phone,
          phoneNumber: call.contact.phoneNumber,
        }
      : null,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const status = searchParams.get("status");
    const date = searchParams.get("date");
    const userId = searchParams.get("userId");
    const sequenceId = searchParams.get("sequenceId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      sequence: {
        userId,
      },
    };

    // Add optional filters
    if (status && status !== "all") {
      where.status = status;
    }

    if (sequenceId) {
      where.sequenceId = sequenceId;
    }

    if (date) {
      where.startedAt = {
        gte: new Date(date),
        lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
      };
    }

    // Get calls with tracking data
    const [rawCalls, total] = await Promise.all([
      prisma.callTracking.findMany({
        where,
        include: {
          contact: {
            select: {
              name: true,
              email: true,
              // These might not exist in the Contact model, but we'll include them just in case
              phone: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: [
          {
            startedAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        skip,
        take: limit,
      }),
      prisma.callTracking.count({ where }),
    ]);

    // Transform and sort calls
    const calls = rawCalls.map(transformCallData).sort((a, b) => {
      const dateA = a.startedAt ? new Date(a.startedAt).getTime() : a.createdAt.getTime();
      const dateB = b.startedAt ? new Date(b.startedAt).getTime() : b.createdAt.getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      calls,
      total,
      page,
      limit,
      hasMore: skip + calls.length < total,
      nextPage: skip + calls.length < total ? page + 1 : undefined,
    });
  } catch (error) {
    console.error("Failed to fetch call timeline data:", error);
    return NextResponse.json(
      { error: "Failed to fetch call timeline data" },
      { status: 500 }
    );
  }
}

// Export CSV endpoint
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const sequenceId = searchParams.get("sequenceId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      sequence: {
        userId,
      },
    };

    if (sequenceId) {
      where.sequenceId = sequenceId;
    }

    const rawCalls = await prisma.callTracking.findMany({
      where,
      include: {
        contact: {
          select: {
            name: true,
            email: true,
            phone: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    // Transform raw calls to a consistent format
    const calls = rawCalls.map(transformCallData);

    // Transform data for CSV
    const csvData = calls.map((call) => {
      const phoneNumber = call.contact?.phone || call.contact?.phoneNumber || "";
      const formattedDuration = call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "N/A";

      return {
        "Contact Name": call.contact?.name || "",
        "Contact Email": call.contact?.email || "",
        "Phone Number": phoneNumber,
        "Call Status": call.status,
        "Duration": formattedDuration,
        "Started At": call.startedAt ? new Date(call.startedAt).toISOString() : "",
        "Completed At": call.completedAt ? new Date(call.completedAt).toISOString() : "",
        "Summary": call.summary || "",
      };
    });

    // Convert to CSV string
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(","),
      ...csvData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row];
            return typeof value === "string" && value.includes(",")
              ? `"${value}"`
              : value;
          })
          .join(",")
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=call-timeline.csv",
      },
    });
  } catch (error) {
    console.error("Failed to export call timeline data:", error);
    return NextResponse.json(
      { error: "Failed to export call timeline data" },
      { status: 500 }
    );
  }
}
