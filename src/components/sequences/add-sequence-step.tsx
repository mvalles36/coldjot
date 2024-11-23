"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SequenceStepEditor } from "./sequence-step-editor";
import { SequenceEmailEditor } from "./sequence-email-editor";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

interface AddSequenceStepProps {
  sequenceId: string;
}

type ActiveDrawer = "none" | "step" | "email";

export function AddSequenceStep({ sequenceId }: AddSequenceStepProps) {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const [stepData, setStepData] = useState<any>(null);
  const router = useRouter();

  const handleStepSave = async (data: any) => {
    setStepData(data);
    setActiveDrawer("email");
  };

  const handleEmailSave = async (emailData: any) => {
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
      router.refresh();
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
