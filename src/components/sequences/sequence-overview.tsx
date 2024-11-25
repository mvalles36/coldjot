"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SequenceStepEditor } from "./steps/sequence-step-editor";
import { SequenceEmailEditor } from "./editor/sequence-email-editor";

interface Sequence {
  id: string;
  name: string;
  status: string;
  accessLevel: string;
  scheduleType: string;
  steps: any[];
  _count: {
    contacts: number;
  };
}

export interface SequenceOverviewProps {
  sequence: Sequence;
  onClose: () => void;
}

type ActiveDrawer = "overview" | "step" | "email";

export function SequenceOverview({ sequence, onClose }: SequenceOverviewProps) {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("overview");
  const [selectedStep, setSelectedStep] = useState<any>(null);

  const handleStepSave = (data: any) => {
    setActiveDrawer("email");
  };

  const handleEmailSave = (data: any) => {
    setActiveDrawer("overview");
    // Handle email save
  };

  const handleClose = () => {
    if (activeDrawer !== "overview") {
      setActiveDrawer("overview");
    } else {
      onClose();
    }
  };

  return (
    <>
      <Sheet open={true} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          className="w-full lg:w-[1000px] sm:max-w-[1000px] p-6"
        >
          {activeDrawer === "overview" && (
            <div className="space-y-6">
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
                  <Button onClick={() => setActiveDrawer("step")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add a step
                  </Button>
                  <Button variant="outline">Launch</Button>
                </div>
              </div>

              <div className="border rounded-lg divide-y">
                {sequence.steps.map((step, index) => (
                  <div key={step.id} className="p-4 flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Day {index + 1}: Manual email
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {step.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {step.subject || "(No Subject)"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{step.priority}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedStep(step);
                              setActiveDrawer("email");
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === "step" && (
            <SequenceStepEditor
              open={true}
              onClose={() => setActiveDrawer("overview")}
              onSave={handleStepSave}
            />
          )}

          {activeDrawer === "email" && (
            <SequenceEmailEditor
              open={true}
              onClose={() => setActiveDrawer("overview")}
              onSave={handleEmailSave}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
