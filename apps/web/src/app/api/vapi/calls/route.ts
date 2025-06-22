import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { fetchVapiApi } from "@/lib/vapi/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
// OpenAI voicemail personalisation
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

/**
 * Generate a personalised voicemail message using OpenAI.
 * Falls back to the provided template if generation fails or the API key
 * is not configured.
 */
async function generatePersonalizedVoicemail(
  contact: { firstName?: string | null; lastName?: string | null; name?: string | null },
  template: string
): Promise<string> {
  try {
    if (!OPENAI_API_KEY || template.trim().length === 0) {
      return template;
    }

    const name =
      contact?.name ||
      [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
      "there";

    const prompt = `You are an SDR leaving a voicemail. Personalise the following voicemail script by addressing the contact by name and making it sound natural, without exceeding 20 seconds when spoken. Keep the core message but personalise it:\n\nContact name: ${name}\n\nScript:\n${template}\n\nPersonalised Voicemail:`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 120,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI voicemail generation error:", await res.text());
      return template;
    }

    const data = await res.json();
    const personalised =
      data.choices?.[0]?.message?.content?.trim() ?? template;
    return personalised.length > 0 ? personalised : template;
  } catch (err) {
    console.error("Voicemail personalisation failed:", err);
    return template;
  }
}

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

    /* ---------------- Personalise voicemail ---------------- */
    let voicemailMessage: string | undefined = undefined;
    if (callAssistant.leaveVoicemail) {
      voicemailMessage = await generatePersonalizedVoicemail(
        contact,
        callAssistant.voicemailText || ""
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
        voicemail_message: voicemailMessage,
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
          voicemailMessage,
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
