import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SequencePageClient from "./sequence-page-client";

export default async function SequencePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;

  const sequence = await prisma.sequence.findUnique({
    where: {
      id: await id,
    },
    include: {
      steps: {
        orderBy: {
          order: "asc",
        },
      },
      contacts: {
        include: {
          contact: {
            include: {
              company: true,
            },
          },
        },
      },
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });

  if (!sequence) {
    notFound();
  }

  const { id: sequenceId } = await params;
  const stats = await prisma.sequenceStats.findUnique({
    where: { sequenceId: sequenceId },
    include: {
      Contact: true,
    },
  });

  // return <SequencePageClient sequence={sequence} initialStats={stats} />;
  return <SequencePageClient sequence={sequence} initialStats={stats} />;
}
