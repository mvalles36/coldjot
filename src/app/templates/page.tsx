import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import TemplateList from "./TemplateList";
import { Separator } from "@/components/ui/separator";
import { Template } from "@/types";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const templates = await prisma.template.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
        <p className="text-muted-foreground">
          Create and manage your email templates.
        </p>
      </div>
      <Separator />
      <TemplateList initialTemplates={templates} />
    </div>
  );
}
