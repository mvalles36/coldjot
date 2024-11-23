import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SequencePage from "./sequence-page";

export default async function Page({
  params,
}: {
  params: { sequenceId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { sequenceId } = params;
  const sequence = await prisma.sequence.findUnique({
    where: {
      id: sequenceId,
      userId: session.user.id,
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
    return notFound();
  }

  const transformedSequence = {
    ...sequence,
    contacts: sequence.contacts,
    _count: {
      ...sequence._count,
      contacts: sequence._count.contacts,
    },
  };

  return <SequencePage sequence={transformedSequence} />;
}
