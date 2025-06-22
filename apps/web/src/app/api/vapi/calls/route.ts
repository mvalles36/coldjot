import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { fetchVapiApi } from "@/lib/vapi/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for validating call creation request
const createCallSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  sequenceId: z.string().min(1, "Sequence ID is required"),
  stepId: z.string().min(1, "Step ID is required"),
  assistantId: z.string().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  callbackUrl: z.string().optional(),
});

/**
 * POST handler for /api/vapi/calls
 * Initiates a new call via the Vapi API
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createCallSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid request data", 
          details: validationResult.error.format() 
        },
        { status: 400 }
      );
    }

    const { contactId, sequenceId, stepId, assistantId, phoneNumber, callbackUrl } = validationResult.data;

    // Check if the user has access to the sequence
    const sequence = await prisma.sequence.findFirst({
      where: {
        id: sequenceId,
        userId,
      },
      include: {
        CallAssistant: true,
      },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Sequence not found or access denied" },
        { status: 404 }
      );
    }

    // Check if the contact exists and belongs to the user
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found or access denied" },
        { status: 404 }
      );
    }

    // Get call assistant configuration
    const callAssistant = sequence.CallAssistant || 
      await prisma.callAssistant.findFirst({
        where: {
          sequenceId,
          userId,
        },
      });

    if (!callAssistant) {
      return NextResponse.json(
        { error: "Call assistant configuration not found" },
        { status: 404 }
      );
    }

    // Prepare the call request payload
    const callPayload = {
      assistant_id: assistantId || callAssistant.vapiAssistantId,
      from: callAssistant.phoneNumberId,
      to: phoneNumber,
      voice_id: callAssistant.voiceId,
      first_message: "Hello, this is an automated call from ColdJot.",
      system_prompt: callAssistant.systemPrompt,
      options: {
        leave_voicemail: callAssistant.leaveVoicemail,
        voicemail_message: callAssistant.leaveVoicemail ? callAssistant.voicemailText : undefined,
      },
      metadata: {
        contactId,
        sequenceId,
        stepId,
        userId,
      },
      callback_url: callbackUrl,
    };

    // Create call tracking record in database
    const callTracking = await prisma.callTracking.create({
      data: {
        sequenceId,
        contactId,
        stepId,
        status: "initial",
        startedAt: new Date(),
        metadata: {
          phoneNumber,
          assistantId: callAssistant.vapiAssistantId,
          voiceId: callAssistant.voiceId,
        },
      },
    });

    // Make the API call to Vapi to initiate the call
    const response = await fetchVapiApi(
      userId,
      "/calls",
      {
        method: "POST",
        body: JSON.stringify(callPayload),
      }
    );

    if (!response.ok) {
      // Try to parse error response
      const errorData = await response.json().catch(() => ({}));
      console.error("Error initiating call with Vapi:", errorData);
      
      // Update call tracking status to failed
      await prisma.callTracking.update({
        where: { id: callTracking.id },
        data: {
          status: "failed",
          metadata: {
            ...callTracking.metadata,
            error: errorData,
            statusCode: response.status,
          },
        },
      });
      
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Invalid Vapi API credentials" },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to initiate call with Vapi", details: errorData },
        { status: response.status }
      );
    }

    // Parse successful response
    const callData = await response.json();
    
    // Update call tracking with Vapi call ID
    await prisma.callTracking.update({
      where: { id: callTracking.id },
      data: {
        callId: callData.id,
        status: "initiated",
        metadata: {
          ...callTracking.metadata,
          vapiCallId: callData.id,
          vapiResponse: callData,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Call initiated successfully",
      call: {
        id: callTracking.id,
        vapiCallId: callData.id,
        status: "initiated",
      },
    });
  } catch (error) {
    console.error("Error initiating call:", error);
    return NextResponse.json(
      { error: "Failed to initiate call" },
      { status: 500 }
    );
  }
}
