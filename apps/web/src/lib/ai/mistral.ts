/**
 * Mistral AI API Integration
 * 
 * This module provides utilities for working with the Mistral AI API,
 * including chat completions, sentiment analysis, and text generation.
 */

// Environment variable for API key
/**
 * In production you **must** configure an environment variable called
 * `MISTRAL_API_KEY`.  The hard-coded value is kept solely for local
 * development convenience so developers can run the repo out-of-the-box.
 * DO NOT rely on the fallback in any deployable environment.
 *
 * NOTE: `NEXT_PUBLIC_` is **not** used on purpose because all calls in
 * this module are server-side.  Exposing the key to the browser would
 * be a security risk.
 */
const FALLBACK_MISTRAL_API_KEY = 'gOH9paTSjjXFf6WA4hwnvTPa1DtcG9iz';

function getMistralApiKey(): string | undefined {
  return process.env.MISTRAL_API_KEY || FALLBACK_MISTRAL_API_KEY;
}

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Default model to use
const DEFAULT_MODEL = 'mistral-medium';

// -------------------- Type Definitions --------------------

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MistralCompletionRequest {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  safe_prompt?: boolean;
  random_seed?: number;
}

export interface MistralCompletionChoice {
  index: number;
  message: MistralMessage;
  finish_reason: string;
}

export interface MistralCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: MistralCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MistralError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

// Sentiment analysis response type
export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: 'interested' | 'not_interested' | 'appointment_request' | 'question' | 'spam_complaint' | 'unsubscribe';
  intentScore: number;
  summary: string;
  appointmentRequested: boolean;
  doNotContact: boolean;
}

// Email generation types
export interface CampaignContext {
  campaignName: string;
  steps: Array<{
    type: 'email' | 'call' | 'wait';
    content: string;
    waitDays?: number;
  }>;
}

export interface EmailGenerationOptions {
  mode: 'single' | 'sequence';
  userPrompt?: string;
  tone?: string;
  currentStepNumber?: number;
}

// -------------------- Core API Functions --------------------

/**
 * Make a request to the Mistral chat completions API
 * 
 * @param messages Array of messages to send to the API
 * @param options Additional options for the API call
 * @returns The API response or null if an error occurred
 */
export async function mistralChatCompletion(
  messages: MistralMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    safePrompt?: boolean;
  } = {}
): Promise<MistralCompletionResponse | null> {
  try {
    const apiKey = getMistralApiKey();
    if (!apiKey) {
      console.warn('MISTRAL_API_KEY not configured');
      return null;
    }

    const requestBody: MistralCompletionRequest = {
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      safe_prompt: options.safePrompt ?? true,
    };

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json() as MistralError;
      console.error('Mistral API error:', errorData);
      return null;
    }

    return await response.json() as MistralCompletionResponse;
  } catch (error) {
    console.error('Error calling Mistral API:', error);
    return null;
  }
}

/**
 * Extract the assistant's response text from a completion response
 * 
 * @param response The API response
 * @returns The assistant's message content or null if not available
 */
export function extractResponseText(response: MistralCompletionResponse | null): string | null {
  if (!response || !response.choices || response.choices.length === 0) {
    return null;
  }
  
  return response.choices[0].message.content;
}

// -------------------- Text Analysis Functions --------------------

/**
 * Analyze the sentiment and intent of an email reply
 * 
 * @param content The email reply content to analyze
 * @returns Analysis of sentiment, intent, and other attributes
 */
export async function analyzeEmailSentiment(content: string): Promise<SentimentAnalysis | null> {
  try {
    const prompt = `
      Analyze the following email reply to determine:
      1. Overall sentiment (positive, negative, or neutral)
      2. Intent category (interested, not_interested, appointment_request, question, spam_complaint, unsubscribe)
      3. Intent score (0-100) representing likelihood of scheduling a meeting
      4. Brief summary (max 100 chars)
      5. Whether they're explicitly requesting an appointment (true/false)
      6. Whether they're asking not to be contacted again (true/false)
      
      Reply content:
      ---
      ${content}
      ---
      
      Format your response as JSON:
      {
        "sentiment": "positive|negative|neutral",
        "intent": "interested|not_interested|appointment_request|question|spam_complaint|unsubscribe",
        "intentScore": 0-100,
        "summary": "brief summary",
        "appointmentRequested": true|false,
        "doNotContact": true|false
      }
    `;

    const messages: MistralMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await mistralChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 200,
    });

    const responseText = extractResponseText(response);
    
    if (!responseText) {
      return null;
    }

    // Extract JSON from response (handle potential text before/after JSON)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
    
    try {
      const analysis = JSON.parse(jsonStr);
      
      return {
        sentiment: analysis.sentiment || 'neutral',
        intent: analysis.intent || 'question',
        intentScore: analysis.intentScore || 50,
        summary: analysis.summary || 'No summary available',
        appointmentRequested: analysis.appointmentRequested || false,
        doNotContact: analysis.doNotContact || false,
      };
    } catch (parseError) {
      console.error('Error parsing sentiment analysis JSON:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error analyzing email sentiment:', error);
    return null;
  }
}

/**
 * Generate a personalized voicemail message for a contact
 * 
 * @param contact The contact information
 * @param template The base voicemail template
 * @returns A personalized voicemail message or the original template if generation fails
 */
export async function generatePersonalizedVoicemail(
  contact: { firstName?: string | null; lastName?: string | null; name?: string | null },
  template: string
): Promise<string> {
  try {
    const apiKey = getMistralApiKey();
    if (!apiKey || template.trim().length === 0) {
      return template;
    }

    const name =
      contact?.name ||
      [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') ||
      'there';

    const prompt = `You are an SDR leaving a voicemail. Personalize the following voicemail script by addressing the contact by name and making it sound natural, without exceeding 20 seconds when spoken. Keep the core message but personalize it:

Contact name: ${name}

Script:
${template}

Personalized Voicemail:`;

    const messages: MistralMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await mistralChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 150,
    });

    const personalizedMessage = extractResponseText(response);
    
    return personalizedMessage && personalizedMessage.trim().length > 0
      ? personalizedMessage.trim()
      : template;
  } catch (error) {
    console.error('Error generating personalized voicemail:', error);
    return template;
  }
}

/**
 * Generate email content for a campaign sequence
 * 
 * @param campaignContext Information about the campaign
 * @param options Generation options including mode, tone, and user prompt
 * @returns Generated email content (single string or array of strings)
 */
export async function generateEmailContent(
  campaignContext: CampaignContext,
  options: EmailGenerationOptions
): Promise<string | string[] | null> {
  try {
    const apiKey = getMistralApiKey();
    if (!apiKey) {
      console.warn('MISTRAL_API_KEY not configured');
      return null;
    }

    const { mode, userPrompt, tone, currentStepNumber = 0 } = options;
    
    // Format previous steps for context
    const previousStepsText = campaignContext.steps
      .map((step, index) => {
        if (step.type === 'email') {
          return `- Step ${index + 1}: Email - "${step.content.substring(0, 150)}${step.content.length > 150 ? '...' : ''}"`;
        } else if (step.type === 'call') {
          return `- Step ${index + 1}: Call - "${step.content}"`;
        } else if (step.type === 'wait') {
          return `- Step ${index + 1}: Wait - ${step.waitDays} days`;
        }
        return '';
      })
      .join('\n');

    // Construct the prompt based on mode
    let systemPrompt = '';
    let userPromptText = '';
    
    if (mode === 'single') {
      systemPrompt = `You are an expert cold email copywriter. Write persuasive, concise emails that encourage replies and meetings.`;
      
      userPromptText = `You are assisting with writing step ${currentStepNumber + 1} of an outreach campaign called "${campaignContext.campaignName}".

${previousStepsText ? `Here are previous steps:\n${previousStepsText}\n` : ''}

${userPrompt ? `Additional context: ${userPrompt}\n` : ''}
${tone ? `Write in a ${tone} tone.\n` : ''}

Now generate the next email that encourages a reply or books a meeting. Focus on value proposition and clear call-to-action.

Only return the email body content, no subject line.`;
    } else {
      // Sequence mode
      systemPrompt = `You are an expert cold email sequence copywriter. Create a series of persuasive, concise emails that work together to nurture leads and drive responses.`;
      
      userPromptText = `Create a sequence of ${Math.min(3, 5 - campaignContext.steps.length)} follow-up emails for an outreach campaign called "${campaignContext.campaignName}".

${previousStepsText ? `Here are previous steps:\n${previousStepsText}\n` : ''}

${userPrompt ? `Additional context: ${userPrompt}\n` : ''}
${tone ? `Write all emails in a ${tone} tone.\n` : ''}

For each email:
1. Focus on value proposition and clear call-to-action
2. Vary the approach (e.g. case study, question, social proof)
3. Keep each email concise (100-200 words)

Format your response as separate emails with "EMAIL 1:", "EMAIL 2:", etc. before each one.
Only return the email body content for each, no subject lines.`;
    }

    const messages: MistralMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptText }
    ];

    const response = await mistralChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: mode === 'single' ? 500 : 1500,
    });

    const generatedContent = extractResponseText(response);
    
    if (!generatedContent) {
      return null;
    }

    // For sequence mode, split the response into separate emails
    if (mode === 'sequence') {
      const emailRegex = /EMAIL\s*\d+\s*:/gi;
      const emails = generatedContent.split(emailRegex).filter(email => email.trim().length > 0);
      
      // If the splitting didn't work as expected, return the whole content
      if (emails.length <= 1) {
        return [generatedContent.trim()];
      }
      
      return emails.map(email => email.trim());
    }
    
    return generatedContent.trim();
  } catch (error) {
    console.error('Error generating email content:', error);
    return null;
  }
}

/**
 * Check if the Mistral API is properly configured
 * 
 * @returns True if the API key is configured, false otherwise
 */
export function isMistralConfigured(): boolean {
  return Boolean(getMistralApiKey());
}

/**
 * Fallback to OpenAI if Mistral is not configured
 * This allows the system to work with either API
 * 
 * @param fn The function to execute with the OpenAI API
 * @returns The result of the function or null if OpenAI is not configured
 */
export async function withOpenAIFallback<T>(
  fn: (openaiApiKey: string) => Promise<T>,
  fallbackValue: T
): Promise<T> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    return fallbackValue;
  }
  
  try {
    return await fn(OPENAI_API_KEY);
  } catch (error) {
    console.error('Error using OpenAI fallback:', error);
    return fallbackValue;
  }
}
