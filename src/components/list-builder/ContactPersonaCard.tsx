/**
 * ContactPersonaCard Component
 *
 * This component displays AI-generated persona information for a contact,
 * including a color-coded conversion score, persona tags, and detailed
 * recommendations. It supports a compact and expandable view using shadcn/ui.
 */

import React, { useState } from 'react';
import { Contact } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils'; // Utility for conditional class names

interface ContactPersonaCardProps {
  /**
   * The contact object containing persona data.
   */
  contact: Contact & {
    metadata?: any;
  };
  /**
   * Optional: If true, the card will be in a compact view by default.
   */
  isCompact?: boolean;
}

const ContactPersonaCard: React.FC<ContactPersonaCardProps> = ({ contact, isCompact = false }) => {
  const { personaTags, conversionScore, metadata } = contact;
  const personaRecommendedApproach = metadata?.personaRecommendedApproach;
  const personaType = metadata?.personaType;
  const conversionFactors = metadata?.conversionFactors || [];
  
  // State for expanded/collapsed view
  const [isExpanded, setIsExpanded] = useState(!isCompact);

  // Determine the color class for the conversion score
  const getScoreColorClass = (score: number | undefined) => {
    if (score === undefined || score === null) return 'bg-gray-200 text-gray-800';
    if (score >= 80) return 'bg-green-100 text-green-800'; // High
    if (score >= 50) return 'bg-yellow-100 text-yellow-800'; // Medium
    return 'bg-red-100 text-red-800'; // Low
  };

  const getScoreLabel = (score: number | undefined) => {
    if (score === undefined || score === null) return 'N/A';
    if (score >= 80) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
  };

  // Only render if there's relevant persona data
  if (
    (!personaTags || personaTags.length === 0) && 
    (conversionScore === undefined || conversionScore === null) && 
    !personaRecommendedApproach
  ) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" /> AI Persona
        </CardTitle>
        <Badge className={cn("text-xs font-semibold", getScoreColorClass(conversionScore))}>
          Score: {getScoreLabel(conversionScore)} ({conversionScore !== undefined && conversionScore !== null ? conversionScore : 'N/A'})
        </Badge>
      </CardHeader>
      <CardContent>
        {personaType && (
          <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {personaType}
          </div>
        )}
        
        {personaTags && personaTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {personaTags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <Collapsible
          open={isExpanded}
          onOpenChange={setIsExpanded}
          className="w-full space-y-2"
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-0">
              <span className="text-sm font-medium">AI Insights</span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="sr-only">Toggle insights</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
            {personaRecommendedApproach && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                  Recommended Approach
                </h4>
                <p className="text-sm">{personaRecommendedApproach}</p>
              </div>
            )}
            
            {conversionFactors && conversionFactors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                  Key Factors
                </h4>
                <ul className="space-y-1">
                  {conversionFactors.slice(0, 3).map((factor: any, index: number) => (
                    <li key={index} className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        factor.impact === 'positive' ? 'bg-green-500' : 
                        factor.impact === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                      )}></span>
                      {factor.factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default ContactPersonaCard;
