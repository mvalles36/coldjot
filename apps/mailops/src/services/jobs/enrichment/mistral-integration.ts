/**
 * Mistral AI Integration for Contact Enrichment
 * 
 * This module provides integration with Mistral AI for enhanced contact data enrichment,
 * including generating enriched B2C and B2B profiles, analyzing available data to fill
 * in missing information, and classifying/tagging contacts based on available data.
 */

import { EnrichedContact, EnrichmentStatus, DomainData } from '@coldjot/types';
import { logger } from '../../../lib/log';
import { RateLimiter } from '../../../lib/list-builder/utils/rate-limiter';

// Environment variable for API key
function getMistralApiKey(): string | undefined {
  return process.env.MISTRAL_API_KEY;
}

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-medium';
const MISTRAL_API_KEY = getMistralApiKey();

// Maximum number of contacts to process in a single batch
const MAX_BATCH_SIZE = 10;

// Maximum number of retries for API calls
const MAX_RETRIES = 3;

// Number of days before persona scoring is considered stale
const PERSONA_SCORE_FRESHNESS_DAYS = 30;

/**
 * Message structure for Mistral API
 */
interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Request structure for Mistral API
 */
interface MistralCompletionRequest {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  safe_prompt?: boolean;
  random_seed?: number;
}

/**
 * Response structure from Mistral API
 */
interface MistralCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: MistralMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Error structure from Mistral API
 */
interface MistralError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * B2C profile enhancement result
 */
interface B2CProfileEnhancement {
  personalInterests?: string[];
  likelyAge?: string;
  likelyIncome?: string;
  likelyEducation?: string;
  likelyHomeowner?: boolean;
  likelyHasChildren?: boolean;
  likelyProfession?: string;
  recommendedApproach?: string;
  confidenceScore: number;
}

/**
 * B2B profile enhancement result
 */
interface B2BProfileEnhancement {
  businessSize?: string;
  industry?: string;
  decisionMakerLevel?: string;
  companyRevenue?: string;
  companyFocus?: string[];
  likelyBusinessChallenges?: string[];
  recommendedApproach?: string;
  confidenceScore: number;
}

/**
 * Contact classification result
 */
interface ContactClassification {
  tags: string[];
  categories: string[];
  buyingIntent?: number;
  leadScore?: number;
  notes?: string;
}

/**
 * Missing information analysis result
 */
interface MissingInfoAnalysis {
  suggestedEmail?: string;
  suggestedPhone?: string;
  suggestedJobTitle?: string;
  suggestedCompany?: string;
  suggestedIndustry?: string;
  confidenceLevel: {
    email?: number;
    phone?: number;
    jobTitle?: number;
    company?: number;
    industry?: number;
  };
}

/**
 * Persona scoring result
 */
interface PersonaScoreResult {
  personaTags: string[];
  conversionScore: number;
  personaType: string;
  conversionFactors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }[];
  recommendedApproach?: string;
}

/**
 * Mistral Integration for Contact Enrichment
 */
export class MistralIntegration {
  private rateLimiter: RateLimiter;

  /**
   * Create a new MistralIntegration instance
   * 
   * @param rateLimiter Optional custom rate limiter
   */
  constructor(rateLimiter?: RateLimiter) {
    this.rateLimiter = rateLimiter || new RateLimiter({
      maxRequests: 20,
      interval: 60000, // 1 minute
      maxConcurrent: 5
    });
  }

  /**
   * Check if Mistral API is properly configured
   * 
   * @returns True if the API key is configured, false otherwise
   */
  isConfigured(): boolean {
    return Boolean(MISTRAL_API_KEY);
  }

  /**
   * Enrich a contact with Mistral AI
   * 
   * @param contact Contact to enrich
   * @returns Enriched contact
   */
  async enrichContact(contact: EnrichedContact): Promise<EnrichedContact> {
    try {
      if (!this.isConfigured()) {
        logger.warn('[MistralIntegration] Mistral API key not configured, skipping enrichment');
        return contact;
      }

      logger.info(`[MistralIntegration] Enriching contact ${contact.id}`);

      // Determine if this is a B2B or B2C contact
      const isB2B = this.isB2BContact(contact);

      // Create a copy of the contact to enrich
      let enrichedContact: EnrichedContact = {
        ...contact,
        enrichmentStatus: EnrichmentStatus.PROCESSING
      };

      // Analyze missing information
      if (this.hasMissingCriticalInfo(contact)) {
        const missingInfoAnalysis = await this.analyzeMissingInfo(contact);
        enrichedContact = this.applyMissingInfoSuggestions(enrichedContact, missingInfoAnalysis);
      }

      // Enhance with B2B or B2C profile
      if (isB2B) {
        const b2bProfile = await this.enhanceB2BProfile(enrichedContact);
        enrichedContact = this.applyB2BEnhancements(enrichedContact, b2bProfile);
      } else {
        const b2cProfile = await this.enhanceB2CProfile(enrichedContact);
        enrichedContact = this.applyB2CEnhancements(enrichedContact, b2cProfile);
      }

      // Classify and tag the contact
      const classification = await this.classifyContact(enrichedContact);
      enrichedContact = this.applyClassification(enrichedContact, classification);

      // Generate persona score if needed
      if (this.needsPersonaScoring(enrichedContact)) {
        const personaScore = await this.generatePersonaScore(enrichedContact);
        enrichedContact = this.applyPersonaScore(enrichedContact, personaScore);
      } else {
        logger.info(`[MistralIntegration] Skipping persona scoring for contact ${contact.id} - recent score exists`);
      }

      // Calculate new quality score based on enriched data
      enrichedContact.dataQualityScore = this.calculateQualityScore(enrichedContact);
      enrichedContact.enrichmentStatus = EnrichmentStatus.COMPLETED;

      // Add metadata about the enrichment
      enrichedContact.metadata = {
        ...(enrichedContact.metadata || {}),
        lastEnrichedWith: 'mistral',
        lastEnrichedAt: new Date().toISOString(),
        enrichmentVersion: '1.0'
      };

      logger.info(`[MistralIntegration] Successfully enriched contact ${contact.id}`);
      return enrichedContact;
    } catch (error) {
      logger.error(`[MistralIntegration] Error enriching contact ${contact.id}:`, error);
      
      // Return the original contact with error status
      return {
        ...contact,
        enrichmentStatus: EnrichmentStatus.FAILED,
        metadata: {
          ...(contact.metadata || {}),
          enrichmentError: error.message,
          lastEnrichmentAttempt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Enrich multiple contacts in batch
   * 
   * @param contacts Array of contacts to enrich
   * @returns Array of enriched contacts
   */
  async enrichContactsBatch(contacts: EnrichedContact[]): Promise<EnrichedContact[]> {
    if (!this.isConfigured()) {
      logger.warn('[MistralIntegration] Mistral API key not configured, skipping batch enrichment');
      return contacts;
    }

    logger.info(`[MistralIntegration] Enriching batch of ${contacts.length} contacts`);

    // Process contacts in batches to avoid overloading the API
    const enrichedContacts: EnrichedContact[] = [];
    const batches = this.createBatches(contacts, MAX_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(`[MistralIntegration] Processing batch ${i + 1}/${batches.length} (${batch.length} contacts)`);

      // Process each contact in the batch
      const batchPromises = batch.map(contact => this.enrichContact(contact));
      
      try {
        // Wait for all contacts in the batch to be processed
        const batchResults = await Promise.all(batchPromises);
        enrichedContacts.push(...batchResults);
      } catch (error) {
        logger.error(`[MistralIntegration] Error processing batch ${i + 1}:`, error);
        
        // For failed batches, return the original contacts with error status
        const failedContacts = batch.map(contact => ({
          ...contact,
          enrichmentStatus: EnrichmentStatus.FAILED,
          metadata: {
            ...(contact.metadata || {}),
            enrichmentError: `Batch processing error: ${error.message}`,
            lastEnrichmentAttempt: new Date().toISOString()
          }
        }));
        
        enrichedContacts.push(...failedContacts);
      }
      
      // Add a small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`[MistralIntegration] Completed batch enrichment for ${contacts.length} contacts`);
    return enrichedContacts;
  }

  /**
   * Generate persona score for a contact
   * 
   * @param contact Contact to analyze
   * @returns Persona scoring result
   */
  async generatePersonaScore(contact: EnrichedContact): Promise<PersonaScoreResult> {
    try {
      logger.info(`[MistralIntegration] Generating persona score for contact ${contact.id}`);
      
      // Acquire rate limiting token
      await this.rateLimiter.acquire('mistral');

      // Prepare the prompt for persona scoring
      const prompt = this.buildPersonaScoringPrompt(contact);
      
      // Call Mistral API
      const response = await this.callMistralAPI([
        {
          role: 'system',
          content: 'You are an expert in customer personas and lead scoring. Analyze the provided contact information and generate a persona profile with relevant tags and a conversion likelihood score. Provide your response in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      if (!response) {
        throw new Error('Failed to get response from Mistral API for persona scoring');
      }

      // Extract and parse the JSON response
      const jsonResponse = this.extractJsonFromResponse(response);
      
      return {
        personaTags: jsonResponse.personaTags || [],
        conversionScore: jsonResponse.conversionScore || 50, // Default to middle score if missing
        personaType: jsonResponse.personaType || 'Unknown',
        conversionFactors: jsonResponse.conversionFactors || [],
        recommendedApproach: jsonResponse.recommendedApproach
      };
    } catch (error) {
      logger.error(`[MistralIntegration] Error generating persona score:`, error);
      return {
        personaTags: [],
        conversionScore: 50, // Default to middle score on error
        personaType: 'Unknown',
        conversionFactors: []
      };
    }
  }

  /**
   * Build a prompt for persona scoring
   * 
   * @param contact Contact to analyze
   * @returns Prompt string
   */
  private buildPersonaScoringPrompt(contact: EnrichedContact): string {
    const isB2B = this.isB2BContact(contact);
    
    // Collect all available information about the contact
    const contactInfo = {
      name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      email: contact.email || 'Unknown',
      phone: contact.phoneData?.formatted || 'Unknown',
      address: contact.addressData?.formatted || 'Unknown',
      company: contact.domainData?.company?.name || 'Unknown',
      industry: contact.domainData?.company?.industry || 'Unknown',
      jobTitle: contact.metadata?.jobTitle || 'Unknown',
      source: contact.source || 'Unknown',
      tags: contact.metadata?.tags || [],
      categories: contact.metadata?.categories || []
    };
    
    // Include B2B or B2C specific information
    const specificInfo = isB2B
      ? `
        B2B Specific Information:
        - Company Size: ${contact.domainData?.company?.size || 'Unknown'}
        - Decision Maker Level: ${contact.metadata?.decisionMakerLevel || 'Unknown'}
        - Company Revenue: ${contact.metadata?.b2bInsights?.companyRevenue || 'Unknown'}
        - Business Challenges: ${JSON.stringify(contact.metadata?.b2bInsights?.likelyBusinessChallenges || [])}
      `
      : `
        B2C Specific Information:
        - Likely Age: ${contact.metadata?.b2cInsights?.likelyAge || 'Unknown'}
        - Likely Income: ${contact.metadata?.b2cInsights?.likelyIncome || 'Unknown'}
        - Likely Education: ${contact.metadata?.b2cInsights?.likelyEducation || 'Unknown'}
        - Homeowner: ${contact.metadata?.b2cInsights?.likelyHomeowner || 'Unknown'}
        - Has Children: ${contact.metadata?.b2cInsights?.likelyHasChildren || 'Unknown'}
        - Property Type: ${contact.metadata?.propertyType || 'Unknown'}
        - Property Value: ${contact.metadata?.propertyValue || 'Unknown'}
      `;
    
    return `
      Analyze the following contact information and generate a persona profile with relevant tags and a conversion likelihood score.
      
      Contact Information:
      - Name: ${contactInfo.name}
      - Email: ${contactInfo.email}
      - Phone: ${contactInfo.phone}
      - Address: ${contactInfo.address}
      - Company: ${contactInfo.company}
      - Industry: ${contactInfo.industry}
      - Job Title: ${contactInfo.jobTitle}
      - Source: ${contactInfo.source}
      - Existing Tags: ${JSON.stringify(contactInfo.tags)}
      - Existing Categories: ${JSON.stringify(contactInfo.categories)}
      
      ${specificInfo}
      
      Based on the above information, please provide:
      1. A set of persona tags that describe this contact (e.g., "tech-savvy", "budget-conscious", "decision-maker")
      2. A conversion score from 0-100 indicating how likely this contact is to convert
      3. The primary persona type that best describes this contact
      4. Key factors that influence the conversion score (positive and negative)
      5. A recommended approach for engaging with this contact
      
      Please provide your response in JSON format:
      {
        "personaTags": ["tag1", "tag2", "tag3"],
        "conversionScore": 75,
        "personaType": "Primary persona category",
        "conversionFactors": [
          {
            "factor": "Factor description",
            "impact": "positive|negative|neutral",
            "weight": 0.8
          }
        ],
        "recommendedApproach": "Brief recommendation for engagement"
      }
    `;
  }

  /**
   * Apply persona score to a contact
   * 
   * @param contact Contact to update
   * @param personaScore Persona scoring result
   * @returns Updated contact
   */
  private applyPersonaScore(
    contact: EnrichedContact,
    personaScore: PersonaScoreResult
  ): EnrichedContact {
    const updatedContact = { ...contact };
    
    // Update persona tags
    updatedContact.personaTags = [
      ...(updatedContact.personaTags || []),
      ...personaScore.personaTags
    ];
    
    // Update conversion score
    updatedContact.conversionScore = personaScore.conversionScore;
    
    // Update last persona score timestamp
    updatedContact.lastMistralPersonaScoreAt = new Date();
    
    // Add persona details to metadata
    updatedContact.metadata = {
      ...(updatedContact.metadata || {}),
      personaType: personaScore.personaType,
      conversionFactors: personaScore.conversionFactors,
      personaRecommendedApproach: personaScore.recommendedApproach,
      personaScoredAt: new Date().toISOString()
    };
    
    logger.info(`[MistralIntegration] Applied persona score to contact ${contact.id}: score=${personaScore.conversionScore}, tags=${personaScore.personaTags.join(', ')}`);
    
    return updatedContact;
  }

  /**
   * Check if a contact needs persona scoring
   * 
   * @param contact Contact to check
   * @returns True if contact needs persona scoring
   */
  private needsPersonaScoring(contact: EnrichedContact): boolean {
    // If no previous persona score, definitely needs scoring
    if (!contact.lastMistralPersonaScoreAt) {
      return true;
    }
    
    // Check if the existing score is recent enough
    const now = new Date();
    const lastScored = new Date(contact.lastMistralPersonaScoreAt);
    const daysSinceLastScore = (now.getTime() - lastScored.getTime()) / (1000 * 60 * 60 * 24);
    
    // If score is older than the freshness threshold, needs rescoring
    return daysSinceLastScore > PERSONA_SCORE_FRESHNESS_DAYS;
  }

  /**
   * Analyze missing information in a contact
   * 
   * @param contact Contact to analyze
   * @returns Analysis of missing information
   */
  private async analyzeMissingInfo(contact: EnrichedContact): Promise<MissingInfoAnalysis> {
    try {
      // Acquire rate limiting token
      await this.rateLimiter.acquire('mistral');

      // Prepare the prompt for missing information analysis
      const prompt = this.buildMissingInfoPrompt(contact);
      
      // Call Mistral API
      const response = await this.callMistralAPI([
        {
          role: 'system',
          content: 'You are an expert data analyst specializing in contact enrichment. Your task is to analyze the provided contact information and suggest missing fields based on available data. Provide your response in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      if (!response) {
        throw new Error('Failed to get response from Mistral API');
      }

      // Extract and parse the JSON response
      const jsonResponse = this.extractJsonFromResponse(response);
      
      return {
        suggestedEmail: jsonResponse.suggestedEmail,
        suggestedPhone: jsonResponse.suggestedPhone,
        suggestedJobTitle: jsonResponse.suggestedJobTitle,
        suggestedCompany: jsonResponse.suggestedCompany,
        suggestedIndustry: jsonResponse.suggestedIndustry,
        confidenceLevel: jsonResponse.confidenceLevel || {
          email: jsonResponse.emailConfidence,
          phone: jsonResponse.phoneConfidence,
          jobTitle: jsonResponse.jobTitleConfidence,
          company: jsonResponse.companyConfidence,
          industry: jsonResponse.industryConfidence
        }
      };
    } catch (error) {
      logger.error(`[MistralIntegration] Error analyzing missing info:`, error);
      return {
        confidenceLevel: {}
      };
    }
  }

  /**
   * Enhance a B2B contact profile
   * 
   * @param contact B2B contact to enhance
   * @returns Enhanced B2B profile
   */
  private async enhanceB2BProfile(contact: EnrichedContact): Promise<B2BProfileEnhancement> {
    try {
      // Acquire rate limiting token
      await this.rateLimiter.acquire('mistral');

      // Prepare the prompt for B2B profile enhancement
      const prompt = this.buildB2BProfilePrompt(contact);
      
      // Call Mistral API
      const response = await this.callMistralAPI([
        {
          role: 'system',
          content: 'You are an expert B2B sales consultant. Analyze the provided business contact information and generate insights that would be valuable for sales outreach. Provide your response in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      if (!response) {
        throw new Error('Failed to get response from Mistral API');
      }

      // Extract and parse the JSON response
      const jsonResponse = this.extractJsonFromResponse(response);
      
      return {
        businessSize: jsonResponse.businessSize,
        industry: jsonResponse.industry,
        decisionMakerLevel: jsonResponse.decisionMakerLevel,
        companyRevenue: jsonResponse.companyRevenue,
        companyFocus: jsonResponse.companyFocus,
        likelyBusinessChallenges: jsonResponse.likelyBusinessChallenges,
        recommendedApproach: jsonResponse.recommendedApproach,
        confidenceScore: jsonResponse.confidenceScore || 0.5
      };
    } catch (error) {
      logger.error(`[MistralIntegration] Error enhancing B2B profile:`, error);
      return {
        confidenceScore: 0
      };
    }
  }

  /**
   * Enhance a B2C contact profile
   * 
   * @param contact B2C contact to enhance
   * @returns Enhanced B2C profile
   */
  private async enhanceB2CProfile(contact: EnrichedContact): Promise<B2CProfileEnhancement> {
    try {
      // Acquire rate limiting token
      await this.rateLimiter.acquire('mistral');

      // Prepare the prompt for B2C profile enhancement
      const prompt = this.buildB2CProfilePrompt(contact);
      
      // Call Mistral API
      const response = await this.callMistralAPI([
        {
          role: 'system',
          content: 'You are an expert consumer marketing analyst. Analyze the provided individual contact information and generate insights that would be valuable for personalized marketing. Provide your response in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      if (!response) {
        throw new Error('Failed to get response from Mistral API');
      }

      // Extract and parse the JSON response
      const jsonResponse = this.extractJsonFromResponse(response);
      
      return {
        personalInterests: jsonResponse.personalInterests,
        likelyAge: jsonResponse.likelyAge,
        likelyIncome: jsonResponse.likelyIncome,
        likelyEducation: jsonResponse.likelyEducation,
        likelyHomeowner: jsonResponse.likelyHomeowner,
        likelyHasChildren: jsonResponse.likelyHasChildren,
        likelyProfession: jsonResponse.likelyProfession,
        recommendedApproach: jsonResponse.recommendedApproach,
        confidenceScore: jsonResponse.confidenceScore || 0.5
      };
    } catch (error) {
      logger.error(`[MistralIntegration] Error enhancing B2C profile:`, error);
      return {
        confidenceScore: 0
      };
    }
  }

  /**
   * Classify and tag a contact
   * 
   * @param contact Contact to classify
   * @returns Classification and tags
   */
  private async classifyContact(contact: EnrichedContact): Promise<ContactClassification> {
    try {
      // Acquire rate limiting token
      await this.rateLimiter.acquire('mistral');

      // Prepare the prompt for contact classification
      const prompt = this.buildClassificationPrompt(contact);
      
      // Call Mistral API
      const response = await this.callMistralAPI([
        {
          role: 'system',
          content: 'You are an expert in lead scoring and classification. Analyze the provided contact information and generate relevant tags, categories, and scores. Provide your response in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      if (!response) {
        throw new Error('Failed to get response from Mistral API');
      }

      // Extract and parse the JSON response
      const jsonResponse = this.extractJsonFromResponse(response);
      
      return {
        tags: jsonResponse.tags || [],
        categories: jsonResponse.categories || [],
        buyingIntent: jsonResponse.buyingIntent,
        leadScore: jsonResponse.leadScore,
        notes: jsonResponse.notes
      };
    } catch (error) {
      logger.error(`[MistralIntegration] Error classifying contact:`, error);
      return {
        tags: [],
        categories: []
      };
    }
  }

  /**
   * Call the Mistral API
   * 
   * @param messages Array of messages to send to the API
   * @param retryCount Current retry count
   * @returns API response or null if failed
   */
  private async callMistralAPI(
    messages: MistralMessage[],
    retryCount: number = 0
  ): Promise<MistralCompletionResponse | null> {
    try {
      if (!MISTRAL_API_KEY) {
        logger.warn('[MistralIntegration] Mistral API key not configured');
        return null;
      }

      const requestBody: MistralCompletionRequest = {
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.3, // Lower temperature for more deterministic results
        max_tokens: 1000,
        safe_prompt: true,
      };

      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json() as MistralError;
        logger.error('[MistralIntegration] Mistral API error:', errorData);
        
        // Retry on rate limiting or temporary server errors
        if (retryCount < MAX_RETRIES && 
            (response.status === 429 || (response.status >= 500 && response.status < 600))) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          logger.info(`[MistralIntegration] Retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.callMistralAPI(messages, retryCount + 1);
        }
        
        return null;
      }

      return await response.json() as MistralCompletionResponse;
    } catch (error) {
      logger.error('[MistralIntegration] Error calling Mistral API:', error);
      
      // Retry on network errors
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        logger.info(`[MistralIntegration] Retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callMistralAPI(messages, retryCount + 1);
      }
      
      return null;
    }
  }

  /**
   * Extract JSON from Mistral API response
   * 
   * @param response Mistral API response
   * @returns Parsed JSON object
   */
  private extractJsonFromResponse(response: MistralCompletionResponse): any {
    try {
      if (!response || !response.choices || response.choices.length === 0) {
        return {};
      }
      
      const content = response.choices[0].message.content;
      
      // Extract JSON from response (handle potential text before/after JSON)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
      
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('[MistralIntegration] Error parsing JSON response:', error);
      return {};
    }
  }

  /**
   * Build a prompt for missing information analysis
   * 
   * @param contact Contact to analyze
   * @returns Prompt string
   */
  private buildMissingInfoPrompt(contact: EnrichedContact): string {
    return `
      Analyze the following contact information and suggest values for any missing fields.
      For each suggestion, provide a confidence level between 0 and 1.
      
      Contact Information:
      - First Name: ${contact.firstName || 'Unknown'}
      - Last Name: ${contact.lastName || 'Unknown'}
      - Email: ${contact.email || 'Unknown'}
      - Phone: ${contact.phoneData?.formatted || 'Unknown'}
      - Company: ${contact.domainData?.company?.name || 'Unknown'}
      - Domain: ${contact.domainData?.domain || 'Unknown'}
      - Industry: ${contact.domainData?.company?.industry || 'Unknown'}
      - Address: ${contact.addressData?.formatted || 'Unknown'}
      
      Please provide suggestions in JSON format:
      {
        "suggestedEmail": "email@example.com", // Only if email is unknown
        "suggestedPhone": "+1234567890", // Only if phone is unknown
        "suggestedJobTitle": "Job Title", // Based on available information
        "suggestedCompany": "Company Name", // Only if company is unknown
        "suggestedIndustry": "Industry", // Only if industry is unknown
        "confidenceLevel": {
          "email": 0.8, // Confidence between 0-1
          "phone": 0.7,
          "jobTitle": 0.6,
          "company": 0.9,
          "industry": 0.8
        }
      }
    `;
  }

  /**
   * Build a prompt for B2B profile enhancement
   * 
   * @param contact B2B contact to enhance
   * @returns Prompt string
   */
  private buildB2BProfilePrompt(contact: EnrichedContact): string {
    return `
      Analyze the following B2B contact information and generate insights for sales outreach.
      
      Contact Information:
      - Name: ${contact.firstName || ''} ${contact.lastName || ''}
      - Email: ${contact.email || 'Unknown'}
      - Company: ${contact.domainData?.company?.name || 'Unknown'}
      - Domain: ${contact.domainData?.domain || 'Unknown'}
      - Industry: ${contact.domainData?.company?.industry || 'Unknown'}
      - Company Size: ${contact.domainData?.company?.size || 'Unknown'}
      - Job Title: ${contact.metadata?.jobTitle || 'Unknown'}
      - LinkedIn: ${contact.domainData?.company?.socialProfiles?.linkedin || 'Unknown'}
      
      Please provide B2B insights in JSON format:
      {
        "businessSize": "Small/Medium/Enterprise",
        "industry": "Specific industry classification",
        "decisionMakerLevel": "C-Level/Director/Manager/Individual Contributor",
        "companyRevenue": "Estimated revenue range",
        "companyFocus": ["Primary business areas"],
        "likelyBusinessChallenges": ["Challenge 1", "Challenge 2"],
        "recommendedApproach": "Suggested sales approach",
        "confidenceScore": 0.8 // Confidence between 0-1
      }
    `;
  }

  /**
   * Build a prompt for B2C profile enhancement
   * 
   * @param contact B2C contact to enhance
   * @returns Prompt string
   */
  private buildB2CProfilePrompt(contact: EnrichedContact): string {
    return `
      Analyze the following individual consumer contact information and generate insights for personalized marketing.
      
      Contact Information:
      - Name: ${contact.firstName || ''} ${contact.lastName || ''}
      - Email: ${contact.email || 'Unknown'}
      - Phone: ${contact.phoneData?.formatted || 'Unknown'}
      - Address: ${contact.addressData?.formatted || 'Unknown'}
      - City: ${contact.addressData?.city || 'Unknown'}
      - State: ${contact.addressData?.state || 'Unknown'}
      - Postal Code: ${contact.addressData?.postalCode || 'Unknown'}
      
      Additional Information:
      - Property Type: ${contact.metadata?.propertyType || 'Unknown'}
      - Property Value: ${contact.metadata?.propertyValue || 'Unknown'}
      - Year Built: ${contact.metadata?.yearBuilt || 'Unknown'}
      
      Please provide B2C insights in JSON format:
      {
        "personalInterests": ["Interest 1", "Interest 2"],
        "likelyAge": "Age range",
        "likelyIncome": "Income range",
        "likelyEducation": "Education level",
        "likelyHomeowner": true/false,
        "likelyHasChildren": true/false,
        "likelyProfession": "Profession category",
        "recommendedApproach": "Suggested marketing approach",
        "confidenceScore": 0.8 // Confidence between 0-1
      }
    `;
  }

  /**
   * Build a prompt for contact classification
   * 
   * @param contact Contact to classify
   * @returns Prompt string
   */
  private buildClassificationPrompt(contact: EnrichedContact): string {
    return `
      Analyze the following contact information and generate relevant tags, categories, and scores.
      
      Contact Information:
      - Name: ${contact.firstName || ''} ${contact.lastName || ''}
      - Email: ${contact.email || 'Unknown'}
      - Company: ${contact.domainData?.company?.name || 'Unknown'}
      - Industry: ${contact.domainData?.company?.industry || 'Unknown'}
      - Address: ${contact.addressData?.formatted || 'Unknown'}
      
      ${contact.domainData?.company ? 'B2B Insights:' : 'B2C Insights:'}
      ${contact.domainData?.company ? 
        `- Company Size: ${contact.domainData.company.size || 'Unknown'}
        - Decision Maker Level: ${contact.metadata?.decisionMakerLevel || 'Unknown'}` 
        : 
        `- Property Type: ${contact.metadata?.propertyType || 'Unknown'}
        - Property Value: ${contact.metadata?.propertyValue || 'Unknown'}`
      }
      
      Please provide classification in JSON format:
      {
        "tags": ["Tag1", "Tag2", "Tag3"],
        "categories": ["Category1", "Category2"],
        "buyingIntent": 75, // Score from 0-100
        "leadScore": 80, // Score from 0-100
        "notes": "Brief analysis of the contact's potential"
      }
    `;
  }

  /**
   * Apply missing information suggestions to a contact
   * 
   * @param contact Contact to update
   * @param analysis Missing information analysis
   * @returns Updated contact
   */
  private applyMissingInfoSuggestions(
    contact: EnrichedContact,
    analysis: MissingInfoAnalysis
  ): EnrichedContact {
    const updatedContact = { ...contact };
    const confidenceThreshold = 0.7; // Only apply suggestions with confidence above this threshold
    
    // Apply email suggestion if missing and confidence is high enough
    if (!contact.email && analysis.suggestedEmail && 
        (analysis.confidenceLevel.email || 0) >= confidenceThreshold) {
      updatedContact.email = analysis.suggestedEmail;
      updatedContact.metadata = {
        ...(updatedContact.metadata || {}),
        emailSource: 'mistral_suggestion',
        emailConfidence: analysis.confidenceLevel.email
      };
    }
    
    // Apply phone suggestion if missing and confidence is high enough
    if (!contact.phoneData?.formatted && analysis.suggestedPhone && 
        (analysis.confidenceLevel.phone || 0) >= confidenceThreshold) {
      updatedContact.phoneData = {
        ...(updatedContact.phoneData || {}),
        formatted: analysis.suggestedPhone,
        isValid: true,
        validationMethod: 'mistral_suggestion'
      };
      updatedContact.metadata = {
        ...(updatedContact.metadata || {}),
        phoneSource: 'mistral_suggestion',
        phoneConfidence: analysis.confidenceLevel.phone
      };
    }
    
    // Apply job title suggestion if missing and confidence is high enough
    if (!updatedContact.metadata?.jobTitle && analysis.suggestedJobTitle && 
        (analysis.confidenceLevel.jobTitle || 0) >= confidenceThreshold) {
      updatedContact.metadata = {
        ...(updatedContact.metadata || {}),
        jobTitle: analysis.suggestedJobTitle,
        jobTitleSource: 'mistral_suggestion',
        jobTitleConfidence: analysis.confidenceLevel.jobTitle
      };
    }
    
    // Apply company suggestion if missing and confidence is high enough
    if (!updatedContact.domainData?.company?.name && analysis.suggestedCompany && 
        (analysis.confidenceLevel.company || 0) >= confidenceThreshold) {
      updatedContact.domainData = {
        ...(updatedContact.domainData || {}),
        company: {
          ...(updatedContact.domainData?.company || {}),
          name: analysis.suggestedCompany
        }
      };
      updatedContact.metadata = {
        ...(updatedContact.metadata || {}),
        companySource: 'mistral_suggestion',
        companyConfidence: analysis.confidenceLevel.company
      };
    }
    
    // Apply industry suggestion if missing and confidence is high enough
    if (!updatedContact.domainData?.company?.industry && analysis.suggestedIndustry && 
        (analysis.confidenceLevel.industry || 0) >= confidenceThreshold) {
      updatedContact.domainData = {
        ...(updatedContact.domainData || {}),
        company: {
          ...(updatedContact.domainData?.company || {}),
          industry: analysis.suggestedIndustry
        }
      };
      updatedContact.metadata = {
        ...(updatedContact.metadata || {}),
        industrySource: 'mistral_suggestion',
        industryConfidence: analysis.confidenceLevel.industry
      };
    }
    
    return updatedContact;
  }

  /**
   * Apply B2B profile enhancements to a contact
   * 
   * @param contact Contact to update
   * @param profile B2B profile enhancement
   * @returns Updated contact
   */
  private applyB2BEnhancements(
    contact: EnrichedContact,
    profile: B2BProfileEnhancement
  ): EnrichedContact {
    // Only apply enhancements if confidence is reasonable
    if (profile.confidenceScore < 0.5) {
      return contact;
    }
    
    const updatedContact = { ...contact };
    
    // Update company information
    updatedContact.domainData = {
      ...(updatedContact.domainData || {}),
      company: {
        ...(updatedContact.domainData?.company || {}),
        industry: updatedContact.domainData?.company?.industry || profile.industry,
        size: updatedContact.domainData?.company?.size || profile.businessSize
      }
    };
    
    // Update metadata with B2B insights
    updatedContact.metadata = {
      ...(updatedContact.metadata || {}),
      b2bInsights: {
        decisionMakerLevel: profile.decisionMakerLevel,
        companyRevenue: profile.companyRevenue,
        companyFocus: profile.companyFocus,
        likelyBusinessChallenges: profile.likelyBusinessChallenges,
        recommendedApproach: profile.recommendedApproach,
        confidenceScore: profile.confidenceScore
      },
      enrichmentType: 'b2b'
    };
    
    return updatedContact;
  }

  /**
   * Apply B2C profile enhancements to a contact
   * 
   * @param contact Contact to update
   * @param profile B2C profile enhancement
   * @returns Updated contact
   */
  private applyB2CEnhancements(
    contact: EnrichedContact,
    profile: B2CProfileEnhancement
  ): EnrichedContact {
    // Only apply enhancements if confidence is reasonable
    if (profile.confidenceScore < 0.5) {
      return contact;
    }
    
    const updatedContact = { ...contact };
    
    // Update metadata with B2C insights
    updatedContact.metadata = {
      ...(updatedContact.metadata || {}),
      b2cInsights: {
        personalInterests: profile.personalInterests,
        likelyAge: profile.likelyAge,
        likelyIncome: profile.likelyIncome,
        likelyEducation: profile.likelyEducation,
        likelyHomeowner: profile.likelyHomeowner,
        likelyHasChildren: profile.likelyHasChildren,
        likelyProfession: profile.likelyProfession,
        recommendedApproach: profile.recommendedApproach,
        confidenceScore: profile.confidenceScore
      },
      enrichmentType: 'b2c'
    };
    
    return updatedContact;
  }

  /**
   * Apply classification to a contact
   * 
   * @param contact Contact to update
   * @param classification Contact classification
   * @returns Updated contact
   */
  private applyClassification(
    contact: EnrichedContact,
    classification: ContactClassification
  ): EnrichedContact {
    const updatedContact = { ...contact };
    
    // Update metadata with classification
    updatedContact.metadata = {
      ...(updatedContact.metadata || {}),
      tags: [...(updatedContact.metadata?.tags || []), ...classification.tags],
      categories: classification.categories,
      buyingIntent: classification.buyingIntent,
      leadScore: classification.leadScore,
      classificationNotes: classification.notes
    };
    
    return updatedContact;
  }

  /**
   * Calculate quality score for a contact
   * 
   * @param contact Contact to score
   * @returns Quality score (0-100)
   */
  private calculateQualityScore(contact: EnrichedContact): number {
    let score = 0;
    let maxScore = 0;
    
    // Email (highest weight)
    maxScore += 30;
    if (contact.email) {
      score += 30;
    }
    
    // Phone
    maxScore += 20;
    if (contact.phoneData?.formatted && contact.phoneData.isValid) {
      score += 20;
    } else if (contact.phoneData?.formatted) {
      score += 10;
    }
    
    // Name
    maxScore += 15;
    if (contact.firstName && contact.lastName) {
      score += 15;
    } else if (contact.firstName || contact.lastName) {
      score += 7;
    }
    
    // Address
    maxScore += 15;
    if (contact.addressData?.formatted && contact.addressData.isValid) {
      score += 15;
    } else if (contact.addressData?.formatted) {
      score += 7;
    }
    
    // Company
    maxScore += 10;
    if (contact.domainData?.company?.name) {
      score += 10;
    } else if (contact.domainData?.domain) {
      score += 5;
    }
    
    // Additional data points from enrichment
    maxScore += 10;
    if (contact.metadata?.b2bInsights || contact.metadata?.b2cInsights) {
      score += 5;
    }
    if (contact.metadata?.tags && contact.metadata.tags.length > 0) {
      score += 3;
    }
    if (contact.metadata?.leadScore) {
      score += 2;
    }
    
    // Persona scoring (Phase 4)
    maxScore += 10;
    if (contact.personaTags && contact.personaTags.length > 0) {
      score += 5;
    }
    if (contact.conversionScore !== undefined && contact.conversionScore !== null) {
      score += 5;
    }
    
    // Calculate percentage
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * Check if a contact has missing critical information
   * 
   * @param contact Contact to check
   * @returns True if contact has missing critical information
   */
  private hasMissingCriticalInfo(contact: EnrichedContact): boolean {
    // Check for missing email
    const missingEmail = !contact.email;
    
    // Check for missing phone
    const missingPhone = !contact.phoneData?.formatted;
    
    // Check for missing company (for B2B contacts)
    const isB2B = this.isB2BContact(contact);
    const missingCompany = isB2B && !contact.domainData?.company?.name;
    
    // Return true if any critical info is missing
    return missingEmail || missingPhone || missingCompany;
  }

  /**
   * Check if a contact is a B2B contact
   * 
   * @param contact Contact to check
   * @returns True if contact is B2B
   */
  private isB2BContact(contact: EnrichedContact): boolean {
    // Check for company domain
    if (contact.domainData?.domain) {
      return true;
    }
    
    // Check for company name
    if (contact.domainData?.company?.name) {
      return true;
    }
    
    // Check for business email
    if (contact.email && !contact.email.includes('@gmail.com') && 
        !contact.email.includes('@yahoo.com') && !contact.email.includes('@hotmail.com') &&
        !contact.email.includes('@outlook.com') && !contact.email.includes('@aol.com')) {
      return true;
    }
    
    // Default to B2C
    return false;
  }

  /**
   * Create batches from an array
   * 
   * @param items Array of items
   * @param batchSize Size of each batch
   * @returns Array of batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * Helper function to enrich a contact with Mistral AI
 * 
 * @param contact Contact to enrich
 * @returns Enriched contact
 */
export async function enrichContactWithMistral(contact: EnrichedContact): Promise<EnrichedContact> {
  const mistralIntegration = new MistralIntegration();
  return mistralIntegration.enrichContact(contact);
}

/**
 * Helper function to enrich multiple contacts in batch with Mistral AI
 * 
 * @param contacts Array of contacts to enrich
 * @returns Array of enriched contacts
 */
export async function enrichContactsBatchWithMistral(contacts: EnrichedContact[]): Promise<EnrichedContact[]> {
  const mistralIntegration = new MistralIntegration();
  return mistralIntegration.enrichContactsBatch(contacts);
}
