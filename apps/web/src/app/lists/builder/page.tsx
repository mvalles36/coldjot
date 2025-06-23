"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Map, 
  Search, 
  FileSpreadsheet, 
  Target, 
  Sparkles, 
  CheckCircle2, 
  Save, 
  ArrowRight, 
  ArrowLeft 
} from "lucide-react";

// Step types and current step tracking
type StepType = "target" | "enrich" | "review" | "save";
type TabType = "map" | "keyword" | "csv";

// Stepper component for showing the current step
const ListBuilderStepper = ({ currentStep }: { currentStep: StepType }) => {
  const steps: { id: StepType; label: string; icon: React.ReactNode }[] = [
    { id: "target", label: "Target", icon: <Target className="h-5 w-5" /> },
    { id: "enrich", label: "Enrich", icon: <Sparkles className="h-5 w-5" /> },
    { id: "review", label: "Review", icon: <CheckCircle2 className="h-5 w-5" /> },
    { id: "save", label: "Save", icon: <Save className="h-5 w-5" /> },
  ];

  return (
    <div className="flex items-center justify-center my-6">
      <div className="flex items-center w-full max-w-3xl">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step item */}
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : index < steps.findIndex(s => s.id === currentStep)
                    ? "bg-primary/80 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.icon}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  currentStep === step.id
                    ? "text-primary"
                    : index < steps.findIndex(s => s.id === currentStep)
                    ? "text-primary/80"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`w-full h-0.5 mx-2 ${
                  index < steps.findIndex(s => s.id === currentStep)
                    ? "bg-primary/80"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Placeholder components for each tab content
const MapTargetContent = () => (
  <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[400px]">
    <Map className="h-16 w-16 mb-4 text-muted-foreground" />
    <h3 className="text-xl font-medium mb-2">Map-Based Lead Capture</h3>
    <p className="text-muted-foreground text-center max-w-md mb-4">
      Draw an area on the map to find property owners. The system will extract owner names and addresses from public records.
    </p>
    <Button variant="outline" disabled>
      Map Component Loading...
    </Button>
  </div>
);

const KeywordTargetContent = () => (
  <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[400px]">
    <Search className="h-16 w-16 mb-4 text-muted-foreground" />
    <h3 className="text-xl font-medium mb-2">Keyword-Based Scraper</h3>
    <p className="text-muted-foreground text-center max-w-md mb-4">
      Search for businesses by keyword and location. The system will extract business names, addresses, and contact information.
    </p>
    <Button variant="outline" disabled>
      Keyword Search Loading...
    </Button>
  </div>
);

const CSVTargetContent = () => (
  <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[400px]">
    <FileSpreadsheet className="h-16 w-16 mb-4 text-muted-foreground" />
    <h3 className="text-xl font-medium mb-2">CSV Import</h3>
    <p className="text-muted-foreground text-center max-w-md mb-4">
      Upload a CSV file with contact information. The system will parse and validate the data before importing.
    </p>
    <Button variant="outline" disabled>
      Upload CSV
    </Button>
  </div>
);

export default function ListBuilderPage() {
  const [currentStep, setCurrentStep] = useState<StepType>("target");
  const [activeTab, setActiveTab] = useState<TabType>("map");

  const handleNextStep = () => {
    if (currentStep === "target") setCurrentStep("enrich");
    else if (currentStep === "enrich") setCurrentStep("review");
    else if (currentStep === "review") setCurrentStep("save");
  };

  const handlePreviousStep = () => {
    if (currentStep === "save") setCurrentStep("review");
    else if (currentStep === "review") setCurrentStep("enrich");
    else if (currentStep === "enrich") setCurrentStep("target");
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="List Builder"
          description="Create targeted contact lists from various sources"
        />
        <Separator />
      </div>

      <ListBuilderStepper currentStep={currentStep} />

      <Card>
        <CardContent className="p-6">
          {currentStep === "target" && (
            <>
              <Tabs
                defaultValue="map"
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as TabType)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 mb-6">
                  <TabsTrigger value="map">
                    <Map className="h-4 w-4 mr-2" />
                    Map
                  </TabsTrigger>
                  <TabsTrigger value="keyword">
                    <Search className="h-4 w-4 mr-2" />
                    Keyword
                  </TabsTrigger>
                  <TabsTrigger value="csv">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="map">
                  <MapTargetContent />
                </TabsContent>
                <TabsContent value="keyword">
                  <KeywordTargetContent />
                </TabsContent>
                <TabsContent value="csv">
                  <CSVTargetContent />
                </TabsContent>
              </Tabs>
            </>
          )}

          {currentStep === "enrich" && (
            <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[400px]">
              <Sparkles className="h-16 w-16 mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">Enrich Your Data</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Enhance your contact data with additional information like email addresses, phone numbers, and more.
              </p>
            </div>
          )}

          {currentStep === "review" && (
            <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[400px]">
              <CheckCircle2 className="h-16 w-16 mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">Review Contacts</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Review and edit your contacts before saving them to your list.
              </p>
            </div>
          )}

          {currentStep === "save" && (
            <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[400px]">
              <Save className="h-16 w-16 mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">Save Your List</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Name your list and choose whether to make it dynamic or static.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handlePreviousStep}
          disabled={currentStep === "target"}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button onClick={handleNextStep} disabled={currentStep === "save"}>
          {currentStep === "save" ? "Finish" : "Next"}
          {currentStep !== "save" && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}
