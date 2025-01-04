import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/PageHeader";
import { SequenceList } from "@/components/sequences/sequence-list";
import { prisma } from "@mailjot/database";
import { SequencesPageClient } from "./sequences-page-client";

export default async function SequencesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const sequences = await prisma.sequence.findMany({
    where: {
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

  // Transform the data to match the expected interface
  const transformedSequences = sequences.map((sequence) => ({
    ...sequence,
    contacts: sequence.contacts.map((sc) => sc.contact),
    _count: {
      ...sequence._count,
      contacts: sequence._count.contacts,
    },
  }));

  return <SequencesPageClient initialSequences={transformedSequences} />;
}
