/**
 * SequenceSuggestionModal Component
 *
 * This component displays suggested email sequences to the user, based on
 * AI-driven recommendations. It allows the user to select a recommended
 * sequence or skip the suggestions.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecommendedSequence } from '@/lib/sequence/SequenceRecommender';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sparkles } from 'lucide-react';

interface SequenceSuggestionModalProps {
  /**
   * Controls the visibility of the modal.
   */
  isOpen: boolean;
  /**
   * Callback function to close the modal.
   */
  onClose: () => void;
  /**
   * Callback function when a user selects a sequence.
   * @param sequenceId The ID of the selected sequence.
   */
  onUseSequence: (sequenceId: string) => void;
  /**
   * Array of recommended sequences to display.
   */
  suggestions: RecommendedSequence[];
}

const SequenceSuggestionModal: React.FC<SequenceSuggestionModalProps> = ({
  isOpen,
  onClose,
  onUseSequence,
  suggestions,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" /> Smart Sequence Recommendations
          </DialogTitle>
          <DialogDescription>
            Based on your list's characteristics, here are some recommended sequences that might perform well.
          </DialogDescription>
        </DialogHeader>

        {suggestions.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No smart sequence recommendations available at this time.
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid gap-4 py-4">
              {suggestions.map((sequence) => (
                <Card key={sequence.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <CardDescription className="flex items-center justify-between">
                      <span>{sequence.description || 'No description provided.'}</span>
                      <Badge variant="secondary" className="ml-2">
                        Relevance: {sequence.relevanceScore.toFixed(0)}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 flex-grow">
                    <p className="mb-1">
                      <strong>Steps:</strong> {sequence.preview.stepsCount}
                    </p>
                    {sequence.preview.firstStepSubject && (
                      <p className="mb-1">
                        <strong>Subject:</strong> {sequence.preview.firstStepSubject}
                      </p>
                    )}
                    {sequence.preview.firstStepContentSnippet && (
                      <p className="line-clamp-2">
                        <strong>Preview:</strong> {sequence.preview.firstStepContentSnippet}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="pt-4">
                    <Button onClick={() => onUseSequence(sequence.id)} className="w-full">
                      Use This Sequence
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Skip Suggestions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SequenceSuggestionModal;
