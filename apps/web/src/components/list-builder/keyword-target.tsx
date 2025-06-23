"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "react-hot-toast";
import { Loader2, Plus, X, Info, Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  KeywordSearchParams,
  KeywordJobParams,
  RefreshFrequency,
  ListBuilderSourceType,
} from "@coldjot/types";

interface KeywordTargetProps {
  onNext: (params: {
    keywords: string[];
    location: string;
    radius: number;
    maxResults: number;
    businessType?: string;
    listName: string;
    listDescription: string;
    isDynamic: boolean;
    refreshFrequency?: RefreshFrequency;
  }) => void;
}

// Business types for dropdown
const businessTypes = [
  { value: "", label: "All Types" },
  { value: "restaurant", label: "Restaurants" },
  { value: "retail", label: "Retail" },
  { value: "professional", label: "Professional Services" },
  { value: "healthcare", label: "Healthcare" },
  { value: "realestate", label: "Real Estate" },
  { value: "construction", label: "Construction" },
  { value: "technology", label: "Technology" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "hospitality", label: "Hospitality" },
  { value: "education", label: "Education" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
];

export default function KeywordTarget({ onNext }: KeywordTargetProps) {
  // Form state
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [radius, setRadius] = useState<number>(10);
  const [maxResults, setMaxResults] = useState<number>(100);
  const [businessType, setBusinessType] = useState<string>("");
  const [listName, setListName] = useState<string>("");
  const [listDescription, setListDescription] = useState<string>("");
  const [isDynamic, setIsDynamic] = useState<boolean>(false);
  const [refreshFrequency, setRefreshFrequency] = useState<RefreshFrequency>(RefreshFrequency.WEEKLY);
  
  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [estimatedResults, setEstimatedResults] = useState<number>(0);

  // Update estimated results when form changes
  useEffect(() => {
    // Simple estimation algorithm based on inputs
    // This is just a rough estimate for UI feedback
    const keywordFactor = Math.max(1, keywords.length);
    const radiusFactor = Math.min(5, Math.max(1, radius / 5));
    const locationFactor = location.trim() ? 1 : 0.5;
    const businessTypeFactor = businessType ? 0.8 : 1; // More specific = fewer results
    
    const baseEstimate = 20; // Base number of results per keyword
    const estimate = Math.min(
      maxResults,
      Math.round(baseEstimate * keywordFactor * radiusFactor * locationFactor * businessTypeFactor)
    );
    
    setEstimatedResults(estimate);
  }, [keywords, location, radius, maxResults, businessType]);

  // Add keyword to list
  const handleAddKeyword = () => {
    const trimmedKeyword = currentKeyword.trim();
    if (trimmedKeyword && !keywords.includes(trimmedKeyword)) {
      setKeywords([...keywords, trimmedKeyword]);
      setCurrentKeyword("");
    }
  };

  // Remove keyword from list
  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  // Handle key press in keyword input
  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (keywords.length === 0) {
      toast.error("Please enter at least one keyword");
      return;
    }

    if (!location.trim()) {
      toast.error("Please enter a location");
      return;
    }

    if (!listName.trim()) {
      toast.error("Please enter a list name");
      return;
    }

    try {
      setIsLoading(true);

      // Call the onNext callback with the form data
      onNext({
        keywords,
        location,
        radius,
        maxResults,
        businessType: businessType || undefined,
        listName,
        listDescription,
        isDynamic,
        refreshFrequency: isDynamic ? refreshFrequency : undefined,
      });
      
    } catch (error) {
      console.error("Error submitting keyword search:", error);
      toast.error("Failed to process the keyword search");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Keyword and Location Search Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Keywords Input */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="keyword-input">Keywords</Label>
                <span className="text-xs text-muted-foreground">
                  {keywords.length} keyword(s) added
                </span>
              </div>
              
              <div className="flex space-x-2">
                <Input
                  id="keyword-input"
                  placeholder="Enter a keyword and press Enter or Add"
                  value={currentKeyword}
                  onChange={(e) => setCurrentKeyword(e.target.value)}
                  onKeyPress={handleKeywordKeyPress}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  onClick={handleAddKeyword}
                  disabled={!currentKeyword.trim()}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              
              {/* Keywords List */}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="pl-2 pr-1 py-1">
                      {keyword}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                        onClick={() => handleRemoveKeyword(keyword)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Add keywords like "plumber", "dentist", or "real estate agent"
              </p>
            </div>
            
            {/* Location Input */}
            <div className="space-y-2">
              <Label htmlFor="location-input">Location</Label>
              <Input
                id="location-input"
                placeholder="City, state, or zip code"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Example: "San Francisco, CA" or "10001"
              </p>
            </div>
            
            {/* Search Radius */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="radius-slider">Search Radius</Label>
                <span className="text-sm font-medium">{radius} miles</span>
              </div>
              <Slider
                id="radius-slider"
                min={1}
                max={50}
                step={1}
                value={[radius]}
                onValueChange={(values) => setRadius(values[0])}
                className="py-4"
              />
            </div>
            
            {/* Max Results */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="max-results-slider">Maximum Results</Label>
                <span className="text-sm font-medium">{maxResults}</span>
              </div>
              <Slider
                id="max-results-slider"
                min={10}
                max={500}
                step={10}
                value={[maxResults]}
                onValueChange={(values) => setMaxResults(values[0])}
                className="py-4"
              />
              <p className="text-xs text-muted-foreground">
                Limit the number of businesses to scrape (higher values take longer)
              </p>
            </div>
            
            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="business-type">Business Type (Optional)</Label>
              <Select
                value={businessType}
                onValueChange={setBusinessType}
              >
                <SelectTrigger id="business-type">
                  <SelectValue placeholder="All Business Types" />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Estimated Results */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-medium">Estimated Results</h3>
              <p className="text-sm text-muted-foreground">
                Based on your search parameters
              </p>
            </div>
            <div className="text-2xl font-bold">
              ~{estimatedResults}
              <span className="text-sm font-normal text-muted-foreground ml-1">businesses</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* List Creation Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">List Name</Label>
              <Input
                id="list-name"
                placeholder="Enter a name for your list"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="list-description">Description (Optional)</Label>
              <Textarea
                id="list-description"
                placeholder="Enter a description for your list"
                value={listDescription}
                onChange={(e) => setListDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="dynamic-list"
                checked={isDynamic}
                onCheckedChange={setIsDynamic}
              />
              <Label htmlFor="dynamic-list">
                Dynamic List (auto-refresh)
              </Label>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Dynamic lists automatically refresh on a schedule to capture new businesses</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {isDynamic && (
              <div className="space-y-2">
                <Label htmlFor="refresh-frequency">Refresh Frequency</Label>
                <Select
                  value={refreshFrequency}
                  onValueChange={(value) => setRefreshFrequency(value as RefreshFrequency)}
                >
                  <SelectTrigger id="refresh-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={RefreshFrequency.DAILY}>Daily</SelectItem>
                    <SelectItem value={RefreshFrequency.WEEKLY}>Weekly</SelectItem>
                    <SelectItem value={RefreshFrequency.MONTHLY}>Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={keywords.length === 0 || !location.trim() || !listName.trim() || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Enrichment
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
