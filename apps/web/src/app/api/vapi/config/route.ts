import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { fetchVapiApi, clearVapiTokenCache } from "@/lib/vapi/auth";
import { z } from "zod";

// Schema for validating Vapi configuration
const vapiConfigSchema = z.object({
  apiKey: z.string().min(10, "API key is required"),
  orgId: z.string().min(1, "Organization ID is required"),
  testConnection: z.boolean().optional(),
});

/**
 * GET handler for /api/vapi/config
 * Retrieves the Vapi configuration for the authenticated user
 */
export async function GET() {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch Vapi configuration from database
    const config = await prisma.vapiConfig.findFirst({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        orgId: true,
        // We don't return the full API key for security reasons
        apiKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return NextResponse.json({ 
        configured: false 
      });
    }

    // Mask the API key for security
    const maskedApiKey = config.apiKey.substring(0, 4) + 
      "•".repeat(config.apiKey.length - 8) + 
      config.apiKey.substring(config.apiKey.length - 4);

    return NextResponse.json({
      configured: true,
      config: {
        ...config,
        apiKey: maskedApiKey,
      },
    });
  } catch (error) {
    console.error("Error retrieving Vapi configuration:", error);
    return NextResponse.json(
      { error: "Failed to retrieve Vapi configuration" },
      { status: 500 }
    );
  }
}

/**
 * POST handler for /api/vapi/config
 * Saves or updates the Vapi configuration for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Validate request body
    const validationResult = vapiConfigSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { apiKey, orgId, testConnection } = validationResult.data;

    // Test the connection if requested
    if (testConnection) {
      try {
        // Save temporary credentials for testing
        await prisma.vapiConfig.upsert({
          where: {
            id: `temp_${userId}`,
          },
          update: {
            apiKey,
            orgId,
            isActive: true,
          },
          create: {
            id: `temp_${userId}`,
            userId,
            apiKey,
            orgId,
            isActive: true,
          },
        });

        // Clear any cached tokens
        clearVapiTokenCache(userId);

        // Test the connection by fetching assistants
        const response = await fetchVapiApi(
          userId,
          "/assistants",
          { method: "GET" }
        );

        // Delete temporary credentials
        await prisma.vapiConfig.delete({
          where: {
            id: `temp_${userId}`,
          },
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: "Invalid Vapi credentials", status: response.status },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("Error testing Vapi credentials:", error);
        return NextResponse.json(
          { error: "Failed to test Vapi credentials" },
          { status: 500 }
        );
      }
    }

    // Save or update the configuration
    const config = await prisma.vapiConfig.upsert({
      where: {
        userId_isActive: {
          userId,
          isActive: true,
        },
      },
      update: {
        apiKey,
        orgId,
      },
      create: {
        userId,
        apiKey,
        orgId,
        isActive: true,
      },
    });

    // Clear any cached tokens
    clearVapiTokenCache(userId);

    return NextResponse.json({
      success: true,
      message: "Vapi configuration saved successfully",
      configId: config.id,
    });
  } catch (error) {
    console.error("Error saving Vapi configuration:", error);
    return NextResponse.json(
      { error: "Failed to save Vapi configuration" },
      { status: 500 }
    );
  }
}
