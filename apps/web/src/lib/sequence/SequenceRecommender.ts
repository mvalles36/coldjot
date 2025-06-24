/**
 * SequenceRecommender Service
 *
 * This service provides intelligent recommendations for email sequences based on
 * contact persona data and list source type. It aims to help users select the
 * most effective campaigns for their generated lists.
 */

import { prisma } from '@coldjot/database';
import { EmailList, Sequence, SequenceStep } from '@prisma/client';
import { ListBuilderSourceType } from '@coldjot/types'; // Assuming this type is available

// Define an interface for the recommended sequence output
export interface RecommendedSequence {
  id: string;
  name: string;
  description?: string;
  relevanceScore: number;
  preview: {
    stepsCount: number;
    firstStepSubject?: string;
    firstStepContentSnippet?: string;
  };
}

// Simple in-memory cache for recommendations
// In a production environment, consider Redis or a more robust caching solution
const recommendationCache = new Map<string, { timestamp: number; data: RecommendedSequence[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class SequenceRecommender {
  constructor() {}

  /**
   * Recommends the best-matching sequences based on aggregated persona tags and source type.
   *
   * @param personaTags Aggregated persona tags from the contact list.
   * @param sourceType The source type of the list (e.g., 'map', 'keyword', 'csv', 'weather').
   * @returns A promise that resolves to an array of top 3 recommended sequences.
   */
  public async recommendSequences(
    personaTags: string[],
    sourceType: ListBuilderSourceType
  ): Promise<RecommendedSequence[]> {
    const cacheKey = `${[...personaTags].sort().join(',')}-${sourceType}`;
    const cached = recommendationCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      console.log(`[SequenceRecommender] Returning cached recommendations for ${cacheKey}`);
      return cached.data;
    }

    console.log(`[SequenceRecommender] Generating new recommendations for ${cacheKey}`);

    // Fetch all active sequences with their steps
    const allSequences = await prisma.sequence.findMany({
      where: {
        status: 'active', // Only recommend active sequences
      },
      include: {
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    const scoredSequences: RecommendedSequence[] = [];

    for (const sequence of allSequences) {
      const relevanceScore = this.calculateRelevance(sequence, personaTags, sourceType);
      if (relevanceScore > 0) { // Only include sequences with a positive relevance
        scoredSequences.push({
          id: sequence.id,
          name: sequence.name,
          description: sequence.metadata?.description as string || undefined,
          relevanceScore,
          preview: this.getSequencePreview(sequence),
        });
      }
    }

    // Sort by relevance score in descending order and take the top 3
    const topRecommendations = scoredSequences
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);

    // Cache the results
    recommendationCache.set(cacheKey, { timestamp: Date.now(), data: topRecommendations });

    return topRecommendations;
  }

  /**
   * Calculates a relevance score for a sequence based on persona tags and source type.
   * This is a simplified scoring model and can be expanded with more sophisticated logic.
   *
   * @param sequence The sequence to score.
   * @param personaTags The persona tags from the contact list.
   * @param sourceType The source type of the list.
   * @returns The relevance score.
   */
  private calculateRelevance(
    sequence: Sequence & { steps: SequenceStep[] },
    personaTags: string[],
    sourceType: ListBuilderSourceType
  ): number {
    let score = 0;

    // 1. Persona Tag Matching (strongest factor)
    const sequenceKeywords = [
      sequence.name.toLowerCase(),
      (sequence.metadata?.description as string || '').toLowerCase(),
      ...sequence.steps.map(step => (step.subject || '').toLowerCase()),
      ...sequence.steps.map(step => (step.content || '').toLowerCase()),
    ].join(' ');

    for (const tag of personaTags) {
      if (sequenceKeywords.includes(tag.toLowerCase())) {
        score += 10; // Award points for each matching persona tag
      }
    }

    // 2. Source Type Matching (moderate factor)
    // Assume sequences might have internal tags or naming conventions indicating source suitability
    // For example, a sequence named "Hailstorm Follow-up" would be highly relevant for 'weather' sourceType
    if (sourceType === ListBuilderSourceType.WEATHER && sequence.name.toLowerCase().includes('weather')) {
      score += 15;
    }
    if (sourceType === ListBuilderSourceType.MAP && sequence.name.toLowerCase().includes('property')) {
      score += 10;
    }
    if (sourceType === ListBuilderSourceType.KEYWORD && sequence.name.toLowerCase().includes('b2b')) {
      score += 10;
    }
    if (sourceType === ListBuilderSourceType.CSV && sequence.name.toLowerCase().includes('import')) {
      score += 5;
    }

    // 3. General Quality/Completeness (minor factor)
    // Sequences with more steps might be considered more comprehensive
    score += Math.min(sequence.steps.length * 2, 10); // Max 10 points for steps

    // Add a base score to ensure all active sequences have some chance, unless explicitly filtered
    score += 1;

    return score;
  }

  /**
   * Extracts preview data for a given sequence.
   *
   * @param sequence The sequence object.
   * @returns An object containing preview data.
   */
  private getSequencePreview(sequence: Sequence & { steps: SequenceStep[] }): RecommendedSequence['preview'] {
    const firstStep = sequence.steps.length > 0 ? sequence.steps[0] : undefined;

    return {
      stepsCount: sequence.steps.length,
      firstStepSubject: firstStep?.subject || undefined,
      firstStepContentSnippet: firstStep?.content ? firstStep.content.substring(0, 100) + '...' : undefined,
    };
  }
}

/**
 * Helper function to get sequence recommendations.
 *
 * @param personaTags Aggregated persona tags from the contact list.
 * @param sourceType The source type of the list.
 * @returns A promise that resolves to an array of top 3 recommended sequences.
 */
export async function getSequenceRecommendations(
  personaTags: string[],
  sourceType: ListBuilderSourceType
): Promise<RecommendedSequence[]> {
  const recommender = new SequenceRecommender();
  return recommender.recommendSequences(personaTags, sourceType);
}
