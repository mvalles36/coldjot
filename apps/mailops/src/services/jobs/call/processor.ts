import { Queue, Job } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { QUEUE_NAMES, getWorkerOptions } from "@/config";
import { logger } from "@/lib/log";
import { prisma } from "@coldjot/database";

/**
 * Interface for call processing job data
 */
interface CallJobData {
  sequenceId: string;
  contactId: string;
  stepId: string;
  assistantId: string;
  phoneNumber: string;
  callbackUrl?: string;
  userId: string;
}

/**
 * Processor for handling call jobs
 * Initiates calls via the Vapi API
 */
export class CallProcessor extends BaseProcessor<CallJobData> {
  constructor(queue: Queue) {
    super(queue, QUEUE_NAMES.CALL, getWorkerOptions(QUEUE_NAMES.CALL));
  }

  /**
   * Process a call job
   */
  protected async process(job: Job<CallJobData>): Promise<void> {
    const { sequenceId, contactId, stepId, assistantId, phoneNumber, callbackUrl, userId } = job.data;

    logger.info({
      jobId: job.id,
      sequenceId,
      contactId,
      stepId,
    }, "📞 Processing call job");

    try {
      // Validate job data
      if (!sequenceId || !contactId || !stepId || !userId) {
        throw new Error("Missing required job data");
      }

      // Check if the contact exists and has a phone number
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, name: true, email: true }
      });

      if (!contact) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      if (!phoneNumber) {
        logger.error(`Contact ${contactId} has no phone number`);
        
        // Create call tracking record with failed status
        await prisma.callTracking.create({
          data: {
            sequenceId,
            contactId,
            stepId,
            status: "failed",
            metadata: {
              error: "Contact has no phone number",
              jobId: job.id
            }
          }
        });
        
        throw new Error(`Contact ${contactId} has no phone number`);
      }

      // Get call assistant configuration
      const callAssistant = await prisma.callAssistant.findFirst({
        where: {
          sequenceId,
          userId,
        },
      });

      if (!callAssistant) {
        throw new Error(`Call assistant configuration not found for sequence ${sequenceId}`);
      }

      // Create call tracking record
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
            jobId: job.id
          },
        },
      });

      // Get user's Vapi API credentials
      const vapiConfig = await prisma.vapiConfig.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });

      if (!vapiConfig) {
        throw new Error(`Vapi API configuration not found for user ${userId}`);
      }

      // Prepare voicemail message if enabled
      let voicemailMessage: string | undefined = undefined;
      if (callAssistant.leaveVoicemail && callAssistant.voicemailText) {
        // Use the raw voicemail text or generate personalized message
        // This could be enhanced to use the Mistral AI service for personalization
        voicemailMessage = callAssistant.voicemailText.replace(
          "{name}",
          contact.name || "there"
        );
      }

      // Prepare the call request payload
      const callPayload = {
        assistant_id: assistantId || callAssistant.vapiAssistantId,
        from: callAssistant.phoneNumberId,
        to: phoneNumber,
        voice_id: callAssistant.voiceId,
        first_message: `Hello, this is an automated call from ColdJot for ${contact.name || "you"}.`,
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
          callTrackingId: callTracking.id,
        },
        callback_url: callbackUrl || `${process.env.API_BASE_URL}/api/vapi/webhooks`,
      };

      // Generate JWT token for Vapi API authentication
      const token = await generateVapiToken(vapiConfig.apiKey, vapiConfig.orgId);
      if (!token) {
        throw new Error("Failed to generate Vapi API token");
      }

      // Make the API call to Vapi to initiate the call
      const response = await fetch("https://api.vapi.ai/calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(callPayload),
      });

      if (!response.ok) {
        // Try to parse error response
        const errorData = await response.json().catch(() => ({}));
        logger.error(errorData, "Error initiating call with Vapi");
        
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
        
        throw new Error(`Failed to initiate call with Vapi: ${response.status}`);
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

      logger.info({
        jobId: job.id,
        callId: callData.id,
        callTrackingId: callTracking.id,
      }, "✅ Call initiated successfully");
    } catch (error) {
      logger.error({
        jobId: job.id,
        error: error.message,
      }, "❌ Error processing call job");
      
      // Re-throw error for job processing system to handle
      throw error;
    }
  }
}

/**
 * Generate a JWT token for Vapi API authentication
 */
async function generateVapiToken(apiKey: string, orgId: string): Promise<string | null> {
  try {
    // Create token payload
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 10; // 10 minutes in seconds

    // Import the necessary crypto libraries
    const { SignJWT } = await import("jose");
    
    // Generate JWT token
    const secretKey = new TextEncoder().encode(apiKey);
    
    const token = await new SignJWT({ org_id: orgId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(orgId)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(secretKey);

    return token;
  } catch (error) {
    logger.error("Error generating Vapi token:", error);
    return null;
  }
}
