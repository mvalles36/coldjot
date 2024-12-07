import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SequencePageClient from "./sequence-page-client";
import type {
  Sequence,
  SequenceStats,
  SequenceContact,
  StepStatus,
  SequenceStatus,
  StepType,
  StepPriority,
  StepTiming,
  BusinessHours,
} from "@/types/sequences";

export default async function SequencePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const sequence = await prisma.sequence.findUnique({
    where: {
      id: id,
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
      businessHours: true,
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
    where: {
      sequenceId: sequenceId,
    },
    include: {
      Contact: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Cast the sequence to match the expected type
  const typedSequence = {
    ...sequence,
    status: sequence.status as SequenceStatus,
    accessLevel: sequence.accessLevel as "team" | "private",
    scheduleType: sequence.scheduleType as "business" | "custom",
    businessHours: sequence.businessHours
      ? ({
          timezone: sequence.businessHours.timezone,
          workDays: sequence.businessHours.workDays,
          workHours: sequence.businessHours.workHours,
          holidays: sequence.businessHours.holidays,
        } as BusinessHours)
      : undefined,
    steps: sequence.steps.map((step) => ({
      id: step.id,
      sequenceId: step.sequenceId,
      stepType: step.stepType as StepType,
      status: step.status as StepStatus,
      priority: step.priority as StepPriority,
      timing: step.timing as StepTiming,
      delayAmount: step.delayAmount ?? undefined,
      delayUnit: step.delayUnit ?? undefined,
      subject: step.subject ?? undefined,
      content: step.content ?? undefined,
      includeSignature: step.includeSignature,
      note: step.note ?? undefined,
      order: step.order,
      previousStepId: step.previousStepId ?? undefined,
      replyToThread: step.replyToThread ?? undefined,
      threadId: step.threadId ?? undefined,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
      templateId: step.templateId ?? undefined,
    })),
    contacts: sequence.contacts.map((contact) => ({
      ...contact,
      status: contact.status as StepStatus,
      contact: {
        ...contact.contact,
        company: contact.contact.company
          ? {
              name: contact.contact.company.name,
            }
          : null,
      },
    })),
  } satisfies Sequence;

  // Cast the stats to match the expected type
  const typedStats = stats as SequenceStats | null;

  // Cast the contacts to match the expected type
  const typedContacts = sequence.contacts.map((contact) => ({
    ...contact,
    status: contact.status as StepStatus,
    contact: {
      ...contact.contact,
      company: contact.contact.company
        ? {
            name: contact.contact.company.name,
          }
        : null,
    },
  })) satisfies SequenceContact[];

  return (
    <SequencePageClient
      sequence={typedSequence}
      initialStats={typedStats}
      initialContacts={typedContacts}
    />
  );
}
