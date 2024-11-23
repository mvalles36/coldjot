import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, MoreHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddSequenceStep } from "@/components/sequences/add-sequence-step";

export default async function SequencePage({
  params,
}: {
  params: { sequenceId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { sequenceId } = await params;
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

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{sequence.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{sequence.status}</Badge>
            <span>•</span>
            <span>{sequence._count.contacts} contacts</span>
          </div>
        </div>
        <div className="flex gap-3">
          <AddSequenceStep sequenceId={sequence.id} />
          <Button variant="outline">Launch</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="font-medium">STATISTICS</h3>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Active</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Paused</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Finished
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Bounced</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Not sent
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">
                  EMAIL STATS PER INDIVIDUAL CONTACT
                </h3>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Scheduled
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Delivered
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Reply</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">
                      Interested
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">-</div>
                    <div className="text-sm text-muted-foreground">Opt out</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg divide-y">
              {sequence.steps.map((step, index) => (
                <div key={step.id} className="p-4 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        Day {index + 1}: Manual email
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {step.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {step.subject || "(No Subject)"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{step.priority}</Badge>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Add other tab contents as needed */}
      </Tabs>
    </div>
  );
}
