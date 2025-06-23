"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Sparkles,
  Info,
  Mail,
  Phone,
  Building,
  MapPin,
  Globe,
  Check,
  AlertTriangle,
  Ban,
} from "lucide-react";
import {
  EnrichmentRequest,
  ListBuilderJobType,
  ListBuilderJobStatus,
  ListBuilderSourceType,
} from "@coldjot/types";

interface EnrichmentOptions {
  fetchDomainInfo: boolean;
  validateAddresses: boolean;
  validatePhones: boolean;
  appendEmails: boolean;
  appendPhones: boolean;
  minQualityThreshold: number;
}

interface EnrichStepProps {
  sourceType: ListBuilderSourceType;
  sourceData: any;
  listId?: string;
  contactCount?: number;
  onNext: (enrichedData: any) => void;
  onBack: () => void;
}

interface EnrichmentStats {
  total: number;
  processed: number;
  enriched: number;
  validated: number;
  failed: number;
  dataQualityScore: number;
  emailsFound: number;
  phonesValidated: number;
  addressesValidated: number;
  companiesEnriched: number;
}

export default function EnrichStep({
  sourceType,
  sourceData,
  listId,
  contactCount = 0,
  onNext,
  onBack,
}: EnrichStepProps) {
  // Enrichment options state
  const [options, setOptions] = useState<EnrichmentOptions>({
    fetchDomainInfo: true,
    validateAddresses: true,
    validatePhones: true,
    appendEmails: true,
    appendPhones: true,
    minQualityThreshold: 50,
  });

  // Enrichment process state
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [isEnrichmentComplete, setIsEnrichmentComplete] = useState<boolean>(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<number>(0);
  const [enrichmentJobId, setEnrichmentJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<EnrichmentStats>({
    total: contactCount,
    processed: 0,
    enriched: 0,
    validated: 0,
    failed: 0,
    dataQualityScore: 0,
    emailsFound: 0,
    phonesValidated: 0,
    addressesValidated: 0,
    companiesEnriched: 0,
  });

  // Update stats when contactCount changes
  useEffect(() => {
    setStats(prev => ({ ...prev, total: contactCount }));
  }, [contactCount]);

  // Poll for job status if enrichment is in progress
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollJobStatus = async () => {
      if (!enrichmentJobId || !isEnriching) return;

      try {
        const response = await fetch(`/api/list-builder/jobs/${enrichmentJobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job status");
        }

        const jobData = await response.json();
        
        // Update progress
        if (jobData.status === ListBuilderJobStatus.PROCESSING) {
          setEnrichmentProgress(jobData.progress || 0);
          
          // Update stats if available
          if (jobData.results) {
            setStats({
              total: jobData.totalItems || contactCount,
              processed: jobData.processedItems || 0,
              enriched: jobData.results.enriched || 0,
              validated: jobData.results.validated || 0,
              failed: jobData.results.failed || 0,
              dataQualityScore: jobData.results.dataQualityScore || 0,
              emailsFound: jobData.results.emailsFound || 0,
              phonesValidated: jobData.results.phonesValidated || 0,
              addressesValidated: jobData.results.addressesValidated || 0,
              companiesEnriched: jobData.results.companiesEnriched || 0,
            });
          }
        }
        
        // Handle job completion
        if (jobData.status === ListBuilderJobStatus.COMPLETED) {
          setIsEnriching(false);
          setIsEnrichmentComplete(true);
          setEnrichmentProgress(100);
          
          // Final stats update
          if (jobData.results) {
            setStats({
              total: jobData.totalItems || contactCount,
              processed: jobData.totalItems || contactCount,
              enriched: jobData.results.enriched || 0,
              validated: jobData.results.validated || 0,
              failed: jobData.results.failed || 0,
              dataQualityScore: jobData.results.dataQualityScore || 0,
              emailsFound: jobData.results.emailsFound || 0,
              phonesValidated: jobData.results.phonesValidated || 0,
              addressesValidated: jobData.results.addressesValidated || 0,
              companiesEnriched: jobData.results.companiesEnriched || 0,
            });
          }
          
          toast.success("Data enrichment completed successfully!");
          clearInterval(intervalId);
        }
        
        // Handle job failure
        if (jobData.status === ListBuilderJobStatus.FAILED) {
          setIsEnriching(false);
          toast.error(`Enrichment failed: ${jobData.error || "Unknown error"}`);
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error("Error polling job status:", error);
      }
    };

    if (isEnriching && enrichmentJobId) {
      // Poll every 2 seconds
      intervalId = setInterval(pollJobStatus, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enrichmentJobId, isEnriching, contactCount]);

  // Start enrichment process
  const startEnrichment = async () => {
    try {
      setIsEnriching(true);
      setEnrichmentProgress(0);
      
      // Create enrichment request
      const enrichmentRequest: EnrichmentRequest = {
        listId,
        enrichmentOptions: {
          fetchDomainInfo: options.fetchDomainInfo,
          validateAddresses: options.validateAddresses,
          validatePhones: options.validatePhones,
          appendEmails: options.appendEmails,
        },
      };
      
      // Call API to start enrichment job
      const response = await fetch("/api/list-builder/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(enrichmentRequest),
      });
      
      if (!response.ok) {
        throw new Error("Failed to start enrichment process");
      }
      
      const data = await response.json();
      setEnrichmentJobId(data.jobId);
      
      toast.success("Enrichment process started");
    } catch (error) {
      console.error("Error starting enrichment:", error);
      toast.error("Failed to start enrichment process");
      setIsEnriching(false);
    }
  };

  // Handle continuing to the next step
  const handleContinue = () => {
    // Pass enriched data to the next step
    onNext({
      listId,
      enrichmentJobId,
      stats,
    });
  };

  // Handle option changes
  const handleOptionChange = (option: keyof EnrichmentOptions, value: boolean | number) => {
    setOptions(prev => ({
      ...prev,
      [option]: value,
    }));
  };

  // Render data quality badge
  const renderQualityBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Check className="h-3 w-3 mr-1" />
          High
        </Badge>
      );
    } else if (score >= 50) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Medium
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <Ban className="h-3 w-3 mr-1" />
          Low
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-primary" />
            Data Enrichment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium">Source Type</h3>
                <p className="text-sm text-muted-foreground">
                  {sourceType === ListBuilderSourceType.MAP && "Map-based property data"}
                  {sourceType === ListBuilderSourceType.KEYWORD && "Keyword-based business data"}
                  {sourceType === ListBuilderSourceType.CSV && "CSV imported contacts"}
                  {sourceType === ListBuilderSourceType.WEATHER && "Weather event affected properties"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Total Contacts</h3>
                <p className="text-2xl font-bold">{contactCount.toLocaleString()}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="text-sm font-medium">Email Coverage</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {isEnrichmentComplete 
                      ? `${stats.emailsFound}/${stats.total}`
                      : "Pending"}
                  </span>
                  {isEnrichmentComplete && (
                    <span className="text-sm text-muted-foreground">
                      {Math.round((stats.emailsFound / stats.total) * 100)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm font-medium">Phone Coverage</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {isEnrichmentComplete 
                      ? `${stats.phonesValidated}/${stats.total}`
                      : "Pending"}
                  </span>
                  {isEnrichmentComplete && (
                    <span className="text-sm text-muted-foreground">
                      {Math.round((stats.phonesValidated / stats.total) * 100)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center">
                  <Building className="h-4 w-4 mr-2 text-purple-500" />
                  <span className="text-sm font-medium">Company Info</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {isEnrichmentComplete 
                      ? `${stats.companiesEnriched}/${stats.total}`
                      : "Pending"}
                  </span>
                  {isEnrichmentComplete && (
                    <span className="text-sm text-muted-foreground">
                      {Math.round((stats.companiesEnriched / stats.total) * 100)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-red-500" />
                  <span className="text-sm font-medium">Address Validation</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {isEnrichmentComplete 
                      ? `${stats.addressesValidated}/${stats.total}`
                      : "Pending"}
                  </span>
                  {isEnrichmentComplete && (
                    <span className="text-sm text-muted-foreground">
                      {Math.round((stats.addressesValidated / stats.total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isEnrichmentComplete && (
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Data Quality</span>
                  {renderQualityBadge(stats.dataQualityScore)}
                </div>
                <Progress 
                  value={stats.dataQualityScore} 
                  className="h-2 mt-2"
                  // Apply color based on score
                  style={{
                    backgroundColor: '#f1f5f9',
                    '--progress-color': stats.dataQualityScore >= 80 
                      ? '#22c55e' 
                      : stats.dataQualityScore >= 50 
                        ? '#eab308' 
                        : '#ef4444'
                  } as React.CSSProperties}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enrichment Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Globe className="h-5 w-5 mr-2 text-primary" />
            Enrichment Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="fetch-domain-info" className="text-base">Domain Information</Label>
                  <p className="text-sm text-muted-foreground">
                    Lookup company information from domain names
                  </p>
                </div>
                <Switch
                  id="fetch-domain-info"
                  checked={options.fetchDomainInfo}
                  onCheckedChange={(checked) => handleOptionChange("fetchDomainInfo", checked)}
                  disabled={isEnriching || isEnrichmentComplete}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="validate-addresses" className="text-base">Address Validation</Label>
                  <p className="text-sm text-muted-foreground">
                    Validate and format physical addresses
                  </p>
                </div>
                <Switch
                  id="validate-addresses"
                  checked={options.validateAddresses}
                  onCheckedChange={(checked) => handleOptionChange("validateAddresses", checked)}
                  disabled={isEnriching || isEnrichmentComplete}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="validate-phones" className="text-base">Phone Validation</Label>
                  <p className="text-sm text-muted-foreground">
                    Validate and format phone numbers
                  </p>
                </div>
                <Switch
                  id="validate-phones"
                  checked={options.validatePhones}
                  onCheckedChange={(checked) => handleOptionChange("validatePhones", checked)}
                  disabled={isEnriching || isEnrichmentComplete}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="append-emails" className="text-base">Email Discovery</Label>
                  <p className="text-sm text-muted-foreground">
                    Find missing email addresses using domain patterns
                  </p>
                </div>
                <Switch
                  id="append-emails"
                  checked={options.appendEmails}
                  onCheckedChange={(checked) => handleOptionChange("appendEmails", checked)}
                  disabled={isEnriching || isEnrichmentComplete}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="append-phones" className="text-base">Phone Discovery</Label>
                  <p className="text-sm text-muted-foreground">
                    Find missing phone numbers from public directories
                  </p>
                </div>
                <Switch
                  id="append-phones"
                  checked={options.appendPhones}
                  onCheckedChange={(checked) => handleOptionChange("appendPhones", checked)}
                  disabled={isEnriching || isEnrichmentComplete}
                />
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="quality-threshold" className="text-base">
                    Minimum Quality Threshold
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only include contacts that meet the minimum quality score
                  </p>
                </div>
                <span className="font-medium">{options.minQualityThreshold}%</span>
              </div>

              <Slider
                id="quality-threshold"
                min={0}
                max={100}
                step={5}
                value={[options.minQualityThreshold]}
                onValueChange={(value) => handleOptionChange("minQualityThreshold", value[0])}
                disabled={isEnriching || isEnrichmentComplete}
                className="py-4"
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Include All</span>
                <span>Balanced</span>
                <span>High Quality Only</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {isEnriching && (
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enrichment Progress</span>
                <span className="text-sm">{Math.round(enrichmentProgress)}%</span>
              </div>
              <Progress value={enrichmentProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Processed {stats.processed} of {stats.total} contacts
              </p>
            </div>
          )}

          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isEnriching}
            >
              Back
            </Button>

            {!isEnrichmentComplete ? (
              <Button
                onClick={startEnrichment}
                disabled={isEnriching || isEnrichmentComplete}
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start Enrichment
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleContinue}>
                Continue to Review
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Enrichment Tips */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start space-x-4">
            <Info className="h-6 w-6 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="font-medium">Enrichment Tips</h3>
              <p className="text-sm text-muted-foreground">
                Data enrichment uses zero-cost public sources to enhance your contact data. 
                The process may take several minutes for large lists. Higher quality thresholds 
                will result in fewer but more complete contacts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
