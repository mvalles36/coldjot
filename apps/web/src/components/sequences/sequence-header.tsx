"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SequenceStatusBadge } from "@/components/sequences/sequence-status-badge";
import { SequenceControls } from "@/components/sequences/sequence-controls";
import { SequenceNav } from "@/components/sequences/sequence-nav";
import { SequenceStatus } from "@coldjot/types";

interface SequenceHeaderProps {
  sequence: {
    id: string;
    name: string;
    status: SequenceStatus;
    contactCount: number;
  };
}

export function SequenceHeader({ sequence }: SequenceHeaderProps) {
  const router = useRouter();

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
              <Link href={`/sequences/${sequence.id}/launch`}>
                <Button
                  variant="default"
                  disabled={sequence.contactCount === 0}
                >
                  Launch Sequence
                </Button>
              </Link>
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
    </>
  );
}
