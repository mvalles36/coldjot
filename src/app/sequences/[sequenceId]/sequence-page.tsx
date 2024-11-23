"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddSequenceStep } from "@/components/sequences/add-sequence-step";
import { SequenceStepList } from "@/components/sequences/sequence-step-list";
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

interface SequencePageProps {
  sequence: {
    id: string;
    name: string;
    status: string;
    steps: any[];
    contacts: any[];
    accessLevel: string;
    scheduleType: string;
    _count: {
      contacts: number;
    };
  };
}

export default function SequencePage({ sequence }: SequencePageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const {
    steps,
    setSteps,
    isLoading,
    reorderSteps,
    duplicateStep,
    deleteStep,
    fetchSteps,
  } = useSequenceSteps(sequence.id);

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

  const handleStepEdit = (step: any) => {
    // Handle step edit - will implement later
  };

  const handleStepAdded = async () => {
    await fetchSteps();
  };

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{sequence.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{sequence.status}</Badge>
            <span>•</span>
            <span>{sequence._count.contacts} contacts</span>
          </div>
        </div>
        <div className="flex gap-3">
          <AddSequenceStep
            sequenceId={sequence.id}
            onStepAdded={handleStepAdded}
          />
          <Button variant="outline">Launch</Button>
        </div>
      </div>

      <Tabs
        defaultValue="overview"
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="font-medium">STATISTICS</h3>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Active</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Paused</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Finished
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Bounced</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Not sent
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">
                  EMAIL STATS PER INDIVIDUAL CONTACT
                </h3>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Scheduled
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Delivered
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Reply</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Interested
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Opt out</div>
                  </div>
                </div>
              </div>
            </div>

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
              <SequenceStepList
                steps={steps}
                onReorder={reorderSteps}
                onEdit={handleStepEdit}
                onDuplicate={duplicateStep}
                onDelete={deleteStep}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-6">
          <SequenceContacts
            sequenceId={sequence.id}
            initialContacts={sequence.contacts}
          />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <div className="text-center text-muted-foreground py-8">
            Email tracking stats will appear here once sequence is launched
          </div>
        </TabsContent>

        <TabsContent value="report" className="mt-6">
          <div className="text-center text-muted-foreground py-8">
            Reports will be available once sequence is launched
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="space-y-6">
            <div className="grid gap-6 max-w-2xl">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Sequence Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Configure your sequence settings and preferences.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Sequence Name</Label>
                  <Input value={sequence.name} readOnly />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select defaultValue={sequence.status} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Schedule Type</Label>
                  <Select defaultValue={sequence.scheduleType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business Hours</SelectItem>
                      <SelectItem value="custom">Custom Schedule</SelectItem>
                    </SelectContent>
                  </Select>
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
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
