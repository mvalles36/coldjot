"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SequenceStepEditor } from "./sequence-step-editor";
import { SequenceEmailEditor } from "./sequence-email-editor";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  SequenceStep,
  StepType,
  StepTiming,
  StepPriority,
} from "@/types/sequences";

interface AddSequenceStepProps {
  sequenceId: string;
  onStepAdded?: () => void;
}

type ActiveDrawer = "none" | "step" | "email";

interface StepData {
  stepType: StepType;
  timing: StepTiming;
  priority: StepPriority;
  delayAmount?: number;
  delayUnit?: "minutes" | "hours" | "days";
  maxEmailsPerDay?: number;
  skipIfPastDue?: boolean;
  note?: string;
}

interface EmailData {
  subject: string;
  content: string;
  includeSignature: boolean;
  templateId?: string;
}

export function AddSequenceStep({
  sequenceId,
  onStepAdded,
}: AddSequenceStepProps) {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const [stepData, setStepData] = useState<StepData | null>(null);
  const router = useRouter();

  const handleStepSave = async (data: StepData) => {
    setStepData(data);
    setActiveDrawer("email");
  };

  const handleEmailSave = async (emailData: EmailData) => {
    if (!stepData) return;

    try {
      const response = await fetch(`/api/sequences/${sequenceId}/steps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...stepData,
          ...emailData,
        }),
      });

      if (!response.ok) throw new Error("Failed to create step");

      toast.success("Step added successfully");
      setActiveDrawer("none");
      setStepData(null);
      onStepAdded?.();
    } catch (error) {
      toast.error("Failed to add step");
    }
  };

  return (
    <>
      <Button onClick={() => setActiveDrawer("step")}>
        <Plus className="h-4 w-4 mr-2" />
        Add a step
      </Button>

      <SequenceStepEditor
        open={activeDrawer === "step"}
        onClose={() => setActiveDrawer("none")}
        onSave={handleStepSave}
      />

      <SequenceEmailEditor
        open={activeDrawer === "email"}
        onClose={() => setActiveDrawer("none")}
        onSave={handleEmailSave}
      />
    </>
  );
}
