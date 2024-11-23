"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Settings } from "lucide-react";
import { CreateSequenceModal } from "./create-sequence-modal";
import { SequenceStepEditor } from "./sequence-step-editor";
import { SequenceOverview } from "./sequence-overview";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import Link from "next/link";

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

interface SequenceListProps {
  initialSequences: Sequence[];
}

export function SequenceList({ initialSequences }: SequenceListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [sequences, setSequences] = useState<Sequence[]>(initialSequences);
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(
    null
  );
  const router = useRouter();

  const handleCreateSuccess = async () => {
    try {
      const response = await fetch("/api/sequences");
      if (!response.ok) throw new Error("Failed to fetch sequences");
      const data = await response.json();
      setSequences(data);
      setShowCreateModal(false);
      toast.success("Sequence created successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to refresh sequences");
    }
  };

  const handleStepSave = (stepData: any) => {
    setShowStepEditor(false);
    // Handle step save logic here
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Sequence
        </Button>
      </div>

      {sequences.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            Create your first sequence
          </h3>
          <p className="text-muted-foreground mb-4">
            Build custom campaigns to automate emails, set more meetings, and
            convert more customers.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            Create a sequence
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sequences.map((sequence) => (
            <div
              key={sequence.id}
              className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{sequence.name}</h3>
                  <div className="text-sm text-muted-foreground">
                    {sequence._count.contacts} contacts •{" "}
                    {sequence.steps.length} steps • {sequence.status}
                  </div>
                </div>
                <Button variant="ghost" asChild>
                  <Link href={`/sequences/${sequence.id}`}>View Details</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateSequenceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <SequenceStepEditor
        open={showStepEditor}
        onClose={() => setShowStepEditor(false)}
        onSave={handleStepSave}
      />

      {selectedSequence && (
        <SequenceOverview
          sequence={selectedSequence}
          onClose={() => setSelectedSequence(null)}
        />
      )}
    </div>
  );
}
