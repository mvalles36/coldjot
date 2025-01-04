"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { SequenceList } from "@/components/sequences/sequence-list";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";

interface Sequence {
  id: string;
  name: string;
  status: string;
  accessLevel: string;
  scheduleType: string;
  steps: any[];
  contacts: any[];
  _count: {
    contacts: number;
  };
}

interface SequencesPageClientProps {
  initialSequences: Sequence[];
}

export function SequencesPageClient({
  initialSequences,
}: SequencesPageClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between pb-6 border-b">
        <div>
          <PageHeader
            title="Sequences"
            description="Create and manage automated email sequences."
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Sequence
        </Button>
      </div>

      <SequenceList
        initialSequences={initialSequences}
        showCreateModal={showCreateModal}
        onCloseCreateModal={() => setShowCreateModal(false)}
      />
    </div>
  );
}
