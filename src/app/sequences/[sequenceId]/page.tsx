import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SequencePageComp from "./sequence-page";

async function getSequence(sequenceId: string) {
  const sequence = await prisma.sequence.findUnique({
    where: {
      id: sequenceId,
    },
    include: {
      contacts: {
        include: {
          contact: {
            include: {
              company: true,
            },
          },
        },
      },
      steps: true,
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });

  if (!sequence) {
    throw new Error("Sequence not found");
  }

  return {
    ...sequence,
    demoMode: sequence.demoMode || false,
  };
}

export default async function SequencePage({
  params,
}: {
  params: { sequenceId: string };
}) {
  const { sequenceId } = await params;
  const sequence = await getSequence(sequenceId);
  return <SequencePageComp sequence={sequence} />;
}
