import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for validating call assistant configuration
const callAssistantSchema = z.object({
  vapiAssistantId: z.string().min(1, "Assistant ID is required"),
  voiceId: z.string().min(1, "Voice ID is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  leaveVoicemail: z.boolean(),
  voicemailText: z.string().optional(),
  phoneNumberId: z.string().min(1, "Phone number ID is required"),
});

/**
 * GET handler for /api/sequences/[id]/call-assistant
 * Retrieves the call assistant configuration for a specific sequence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extract sequence ID from URL params
    const { id: sequenceId } = params;
    if (!sequenceId) {
      return NextResponse.json(
        { error: "Sequence ID is required" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check if the user has access to this sequence
    const sequence = await prisma.sequence.findFirst({
      where: {
        id: sequenceId,
        userId,
      },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Sequence not found or access denied" },
        { status: 404 }
      );
    }

    // Fetch call assistant configuration
    const callAssistant = await prisma.callAssistant.findFirst({
      where: {
        sequenceId,
        userId,
      },
    });

    if (!callAssistant) {
      return NextResponse.json({
        configured: false,
      });
    }

    return NextResponse.json({
      configured: true,
      callAssistant,
    });
  } catch (error) {
    console.error("Error retrieving call assistant configuration:", error);
    return NextResponse.json(
      { error: "Failed to retrieve call assistant configuration" },
      { status: 500 }
    );
  }
}

/**
 * POST handler for /api/sequences/[id]/call-assistant
 * Creates or updates the call assistant configuration for a specific sequence
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extract sequence ID from URL params
    const { id: sequenceId } = params;
    if (!sequenceId) {
      return NextResponse.json(
        { error: "Sequence ID is required" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check if the user has access to this sequence
    const sequence = await prisma.sequence.findFirst({
      where: {
        id: sequenceId,
        userId,
      },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Sequence not found or access denied" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = callAssistantSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid request data", 
          details: validationResult.error.format() 
        },
        { status: 400 }
      );
    }

    const {
      vapiAssistantId,
      voiceId,
      systemPrompt,
      leaveVoicemail,
      voicemailText,
      phoneNumberId,
    } = validationResult.data;

    // Create or update the call assistant configuration
    const callAssistant = await prisma.callAssistant.upsert({
      where: {
        sequenceId_userId: {
          sequenceId,
          userId,
        },
      },
      update: {
        vapiAssistantId,
        voiceId,
        systemPrompt,
        leaveVoicemail,
        voicemailText: leaveVoicemail ? voicemailText : null,
        phoneNumberId,
      },
      create: {
        sequenceId,
        userId,
        vapiAssistantId,
        voiceId,
        systemPrompt,
        leaveVoicemail,
        voicemailText: leaveVoicemail ? voicemailText : null,
        phoneNumberId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Call assistant configuration saved successfully",
      callAssistant,
    });
  } catch (error) {
    console.error("Error saving call assistant configuration:", error);
    return NextResponse.json(
      { error: "Failed to save call assistant configuration" },
      { status: 500 }
    );
  }
}
