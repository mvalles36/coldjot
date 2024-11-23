import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/PageHeader";
import { SequenceList } from "@/components/sequences/sequence-list";
import { prisma } from "@/lib/prisma";

export default async function SequencesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Fetch sequences server-side for initial load
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
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Sequences"
          description="Create and manage automated email sequences."
        />
        <Separator />
      </div>
      <SequenceList initialSequences={sequences} />
    </div>
  );
}
