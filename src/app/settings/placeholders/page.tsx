import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PlaceholderSettings from "./PlaceholderSettings";

export default async function PlaceholderSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const fallbacks = await prisma.placeholderFallback.findMany({
    where: { userId: session.user.id },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Placeholder Settings</h1>
      <PlaceholderSettings initialFallbacks={fallbacks} />
    </div>
  );
}
