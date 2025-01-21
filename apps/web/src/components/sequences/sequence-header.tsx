"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SequenceStatusBadge } from "@/components/sequences/sequence-status-badge";
import { SequenceControls } from "@/components/sequences/sequence-controls";
import { SequenceNav } from "@/components/sequences/sequence-nav";
import { LaunchSequenceModal } from "@/components/sequences/launch-sequence-modal";
import { SequenceStatus } from "@coldjot/types";

interface SequenceHeaderProps {
  sequence: {
    id: string;
    name: string;
    status: SequenceStatus;
    contactCount: number;
    testMode?: boolean;
    disabledSending?: boolean;
  };
}

export function SequenceHeader({ sequence }: SequenceHeaderProps) {
  const router = useRouter();
  const [showLaunchModal, setShowLaunchModal] = useState(false);

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{sequence.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SequenceStatusBadge status={sequence.status} />
            <span>•</span>
            <span>{sequence.contactCount} contacts</span>
          </div>
        </div>
        <div className="flex gap-3">
          {sequence.status !== SequenceStatus.ACTIVE &&
            sequence.status !== SequenceStatus.PAUSED && (
              <Button
                variant="default"
                disabled={sequence.contactCount === 0}
                onClick={() => setShowLaunchModal(true)}
              >
                Launch Sequence
              </Button>
            )}

          <SequenceControls
            sequenceId={sequence.id}
            initialStatus={sequence.status}
            onStatusChange={() => {
              router.refresh();
            }}
          />
        </div>
      </div>

      <SequenceNav sequenceId={sequence.id} />

      <LaunchSequenceModal
        open={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        sequenceId={sequence.id}
        contactCount={sequence.contactCount}
        testMode={sequence.testMode || false}
        onStatusChange={() => {
          router.refresh();
        }}
      />
    </>
  );
}
