"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddSequenceStep } from "@/components/sequences/steps/add-sequence-step";
import { SequenceStepList } from "@/components/sequences/steps/sequence-step-list";
import { useSequenceSteps } from "@/hooks/use-sequence-steps";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SequenceContacts } from "@/components/sequences/sequence-contacts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { SequenceEmailEditor } from "@/components/sequences/editor/sequence-email-editor";
import { SequenceStepEditor } from "@/components/sequences/steps/sequence-step-editor";
import { toast } from "react-hot-toast";
import { LaunchSequenceModal } from "@/components/sequences/launch-sequence-modal";
import { SequenceStatusBadge } from "@/components/sequences/sequence-status-badge";
import { SequenceControls } from "@/components/sequences/sequence-controls";
import { SequenceDevSettings } from "@/components/sequences/sequence-dev-settings";
import { Loader2 } from "lucide-react";
import { SequenceStats } from "@/components/sequences/sequence-stats";
import { SequenceTabs } from "@/components/sequences/sequence-tabs";
import { BusinessHoursSettings } from "@/components/sequences/business-hours-settings";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SequenceStatus } from "@mailjot/types";

import type {
  Sequence,
  SequenceStats as SequenceStatsType,
  SequenceStep,
  SequenceContact,
} from "@mailjot/types";

interface SequencePageClientProps {
  sequence: Sequence;
  initialStats: SequenceStatsType | null;
  initialContacts: SequenceContact[];
}

type SequenceStatsDisplay = {
  totalEmails: number;
  sentEmails: number;
  openedEmails: number;
  uniqueOpens: number;
  clickedEmails: number;
  repliedEmails: number;
  bouncedEmails: number;
  unsubscribed: number;
  interested: number;
  peopleContacted: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
};

export default function SequencePageClient({
  sequence,
  initialStats,
  initialContacts,
}: SequencePageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [sequenceStatus, setSequenceStatus] = useState<SequenceStatus>(
    sequence.status as SequenceStatus
  );
  const {
    steps,
    setSteps,
    isLoading,
    reorderSteps,
    duplicateStep,
    deleteStep,
    fetchSteps,
  } = useSequenceSteps(sequence.id);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  const [editingStep, setEditingStep] = useState<any>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [currentStats, setCurrentStats] = useState(initialStats);

  // Initial setup of steps
  useEffect(() => {
    setSteps(sequence.steps);
  }, [sequence.steps, setSteps]);

  // Fetch steps when needed
  useEffect(() => {
    if (activeTab === "overview") {
      fetchSteps();
    }
  }, [activeTab, fetchSteps]);

  const handleStepReorder = async (reorderedSteps: SequenceStep[]) => {
    try {
      // Update the order and previousStepId for each step
      const updatedSteps = reorderedSteps.map((step, index) => ({
        ...step,
        order: index,
        previousStepId: index > 0 ? reorderedSteps[index - 1].id : undefined,
      }));

      // Update the steps in the database
      const response = await fetch(
        `/api/sequences/${sequence.id}/steps/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steps: updatedSteps.map((step) => ({
              ...step,
              previousStepId: step.previousStepId ?? null,
            })),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to reorder steps");

      // Update local state
      setSteps(updatedSteps as []);
      toast.success("Steps reordered successfully");
    } catch (error) {
      toast.error("Failed to reorder steps");
    }
  };

  const handleStepEdit = (step: SequenceStep) => {
    setEditingStep(step);
    setShowStepEditor(true);
  };

  const handleTemplateEdit = (step: SequenceStep) => {
    const currentStepIndex = steps.findIndex((s) => s.id === step.id);
    const previousStepId =
      currentStepIndex > 0 ? steps[currentStepIndex - 1].id : undefined;

    const emailData = {
      subject: step.subject,
      content: step.content,
      includeSignature: step.includeSignature,
      replyToThread: step.replyToThread,
    };
    setEditingStep({ ...step, ...emailData, previousStepId });
    setShowEmailEditor(true);
  };

  const handleStepAdded = async () => {
    await fetchSteps();
  };

  const handleEmailSave = async (emailData: any) => {
    try {
      const response = await fetch(
        `/api/sequences/${sequence.id}/steps/${editingStep.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editingStep,
            ...emailData,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update step");

      await fetchSteps();
      setShowEmailEditor(false);
      setEditingStep(null);
      toast.success("Step updated successfully");
    } catch (error) {
      toast.error("Failed to update step");
    }
  };

  const handleStepSave = async (stepData: any) => {
    try {
      const response = await fetch(
        `/api/sequences/${sequence.id}/steps/${editingStep.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editingStep,
            ...stepData,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update step");

      await fetchSteps();
      setShowStepEditor(false);
      setEditingStep(null);
      toast.success("Step settings updated successfully");
    } catch (error) {
      toast.error("Failed to update step settings");
    }
  };

  const mapStatsToDisplay = (stats: any): SequenceStatsDisplay => ({
    totalEmails: stats?.totalEmails || 0,
    sentEmails: stats?.sentEmails || 0,
    openedEmails: stats?.openedEmails || 0,
    uniqueOpens: stats?.uniqueOpens || 0,
    clickedEmails: stats?.clickedEmails || 0,
    repliedEmails: stats?.repliedEmails || 0,
    bouncedEmails: stats?.bouncedEmails || 0,
    unsubscribed: stats?.unsubscribed || 0,
    interested: stats?.interested || 0,
    peopleContacted: stats?.peopleContacted || 0,
    openRate: stats?.openRate || 0,
    clickRate: stats?.clickRate || 0,
    replyRate: stats?.replyRate || 0,
    bounceRate: stats?.bounceRate || 0,
  });

  const handleStatusChange = (newStatus: SequenceStatus) => {
    setSequenceStatus(newStatus);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{sequence.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SequenceStatusBadge status={sequenceStatus} />
            <span>•</span>
            <span>{sequence._count.contacts} contacts</span>
          </div>
        </div>
        <div className="flex gap-3">
          {sequenceStatus !== SequenceStatus.ACTIVE &&
            sequenceStatus !== SequenceStatus.PAUSED && (
              <Button
                variant="default"
                onClick={() => setShowLaunchModal(true)}
                disabled={sequence._count.contacts === 0}
              >
                Launch
              </Button>
            )}
          <SequenceControls
            sequenceId={sequence.id}
            initialStatus={sequenceStatus}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      <SequenceTabs activeTab={activeTab} onTabChange={setActiveTab}>
        <TabsContent value="overview" className="mt-6">
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Sequence Statistics
              </h2>
              <SequenceStats stats={mapStatsToDisplay(currentStats)} />
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Loading steps...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Sequence Steps</h2>
                  </div>
                  <SequenceStepList
                    steps={steps}
                    onReorder={handleStepReorder}
                    onEdit={handleStepEdit}
                    onEditTemplate={handleTemplateEdit}
                    onDuplicate={duplicateStep}
                    onDelete={deleteStep}
                  />
                  <AddSequenceStep
                    sequenceId={sequence.id}
                    onStepAdded={handleStepAdded}
                    steps={steps}
                  />
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-6">
          <SequenceContacts
            sequenceId={sequence.id}
            isActive={sequenceStatus === "active"}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Sequence Name</Label>
                    <Input defaultValue={sequence.name} />
                  </div>
                  <div>
                    <Label>Access Level</Label>
                    <Select defaultValue={sequence.accessLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team">
                          Team can view and use
                        </SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>

            <BusinessHoursSettings
              sequenceId={sequence.id}
              initialSettings={sequence.businessHours}
              scheduleType={sequence.scheduleType as "business" | "custom"}
            />

            {process.env.NODE_ENV === "development" && (
              <div className="pt-6">
                <SequenceDevSettings
                  sequenceId={sequence.id}
                  testMode={sequence.testMode}
                  onTestModeChange={() => {
                    router.refresh();
                  }}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </SequenceTabs>

      <SequenceStepEditor
        open={showStepEditor}
        onClose={() => {
          setShowStepEditor(false);
          setEditingStep(null);
        }}
        onSave={handleStepSave}
        initialData={editingStep}
      />

      <SequenceEmailEditor
        open={showEmailEditor}
        onClose={() => {
          setShowEmailEditor(false);
          setEditingStep(null);
        }}
        onSave={handleEmailSave}
        initialData={editingStep}
        sequenceId={sequence.id}
        stepId={editingStep?.id}
        previousStepId={editingStep?.previousStepId}
      />

      <LaunchSequenceModal
        open={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        sequenceId={sequence.id}
        contactCount={sequence._count.contacts}
        testMode={sequence.testMode}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
