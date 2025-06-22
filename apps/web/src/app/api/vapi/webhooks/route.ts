import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";

// Schema for validating Vapi webhook payloads
const vapiWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  created_at: z.string(),
  data: z.object({
    id: z.string(),
    status: z.string(),
    from: z.string(),
    to: z.string(),
    duration: z.number().optional(),
    summary: z.string().optional(),
    transcript: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    error: z.string().optional(),
    call_result: z.string().optional(),
  }),
});

// Map Vapi call statuses to our internal statuses
const statusMapping: Record<string, string> = {
  initiated: "initial",
  ringing: "ringing",
  in_progress: "in_progress",
  completed: "completed",
  failed: "failed",
  no_answer: "no_answer",
  busy: "busy",
  voicemail: "left_voicemail",
};

// Map call results to our contact statuses
const callResultMapping: Record<string, string> = {
  appointment_set: "appointment_set",
  callback_requested: "callback_requested",
  not_interested: "no_interest",
  do_not_call: "do_not_call",
};

/**
 * Verify webhook signature from Vapi
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  // Vapi uses HMAC SHA-256 for webhook signatures
  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

/**
 * POST handler for /api/vapi/webhooks
 * Handles webhook events from Vapi
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw request body for signature verification
    const rawBody = await request.text();
    let body: any;

    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Validate the webhook payload structure
    const validationResult = vapiWebhookSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Invalid webhook payload:", validationResult.error);
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    const webhook = validationResult.data;
    const { type, data } = webhook;

    // Extract metadata from the call
    const metadata = data.metadata || {};
    const { contactId, sequenceId, stepId, userId } = metadata;

    if (!contactId || !sequenceId || !stepId) {
      console.error("Missing required metadata in webhook:", metadata);
      return NextResponse.json(
        { error: "Missing required metadata" },
        { status: 400 }
      );
    }

    // Find the call tracking record
    const callTracking = await prisma.callTracking.findFirst({
      where: {
        callId: data.id,
        sequenceId: sequenceId as string,
        contactId: contactId as string,
        stepId: stepId as string,
      },
    });

    if (!callTracking) {
      console.error("Call tracking record not found for call ID:", data.id);
      return NextResponse.json(
        { error: "Call tracking record not found" },
        { status: 404 }
      );
    }

    // Map Vapi status to our internal status
    let status = statusMapping[data.status] || data.status;

    // Check for call result and override status if needed
    if (data.call_result && callResultMapping[data.call_result]) {
      status = callResultMapping[data.call_result];
    }

    // Update the call tracking record
    const updatedCallTracking = await prisma.callTracking.update({
      where: { id: callTracking.id },
      data: {
        status,
        duration: data.duration,
        summary: data.summary,
        completedAt: ["completed", "failed", "no_answer", "left_voicemail"].includes(status)
          ? new Date()
          : undefined,
        metadata: {
          ...callTracking.metadata,
          transcript: data.transcript,
          error: data.error,
          callResult: data.call_result,
          lastEventType: type,
          lastEventTime: webhook.created_at,
        },
      },
    });

    // If call is completed and has a summary, update the contact notes
    if (
      (status === "completed" || status === "left_voicemail") &&
      data.summary
    ) {
      // Get the contact
      const contact = await prisma.contact.findUnique({
        where: { id: contactId as string },
      });

      if (contact) {
        // Update contact notes with call summary
        // This is a simplified example - in a real implementation, you might
        // want to append to existing notes or store in a dedicated notes field
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            // Assuming there's a notes field in the Contact model
            // If not, you'd need to adjust this based on your data model
            metadata: {
              ...(contact.metadata as object || {}),
              callSummary: data.summary,
              lastCallAt: new Date().toISOString(),
              lastCallStatus: status,
            },
          },
        });
      }
    }

    // If the call result indicates the contact should be removed from the sequence
    if (
      ["appointment_set", "no_interest", "do_not_call"].includes(status)
    ) {
      // Update the sequence contact status
      await prisma.sequenceContact.updateMany({
        where: {
          sequenceId: sequenceId as string,
          contactId: contactId as string,
        },
        data: {
          status: status,
          completed: true,
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      callTrackingId: updatedCallTracking.id,
    });
  } catch (error) {
    console.error("Error processing Vapi webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * GET handler for /api/vapi/webhooks
 * Simple health check endpoint for webhook configuration
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Vapi webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
