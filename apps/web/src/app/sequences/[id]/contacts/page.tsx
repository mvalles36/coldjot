import { prisma } from "@coldjot/database";
import { notFound } from "next/navigation";
import { SequenceContacts } from "@/components/sequences/sequence-contacts";
import { SequenceStatus } from "@coldjot/types";

export default async function SequenceContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sequence = await prisma.sequence.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!sequence) {
    notFound();
  }

  return (
    <SequenceContacts
      sequenceId={sequence.id}
      isActive={sequence.status === SequenceStatus.ACTIVE}
    />
  );
}
