"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SequenceStepEditor } from "./sequence-step-editor";
import { SequenceEmailEditor } from "../editor/sequence-email-editor";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import type { SequenceStep, StepData, EmailData } from "@mailjot/types";

interface AddSequenceStepProps {
  sequenceId: string;
  onStepAdded?: () => void;
  steps: SequenceStep[];
}

type ActiveDrawer = "none" | "step" | "email";

export function AddSequenceStep({
  sequenceId,
  onStepAdded,
  steps,
}: AddSequenceStepProps) {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const [stepData, setStepData] = useState<StepData | null>(null);
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const router = useRouter();

  const handleStepSave = async (data: StepData) => {
    setStepData(data);
    setActiveDrawer("email");
  };

  const handleEmailSave = async (data: EmailData) => {
    if (!stepData) return;

    try {
      const previousStepId =
        steps.length > 0 ? steps[steps.length - 1].id : undefined;

      const response = await fetch(`/api/sequences/${sequenceId}/steps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...stepData,
          ...data,
          order: steps.length,
          previousStepId,
          replyToThread: data.replyToThread,
        }),
      });

      if (!response.ok) throw new Error("Failed to create step");

      toast.success("Step added successfully");
      setActiveDrawer("none");
      setStepData(null);
      setEmailData(null);
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
        sequenceId={sequenceId}
        previousStepId={
          steps.length > 0 ? steps[steps.length - 1].id : undefined
        }
      />
    </>
  );
}
