import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Separator } from "@/components/ui/separator";
import ProfileSettings from "./ProfileSettings";
import EmailSettings from "./EmailSettings";
import GoogleIntegration from "./GoogleIntegration";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "google",
    },
    select: {
      access_token: true,
      refresh_token: true,
      providerAccountId: true,
      expires_at: true,
    },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      <Separator />

      <div className="space-y-10">
        <ProfileSettings user={session.user} />
        <Separator />

        <EmailSettings />
        <Separator />

        <GoogleIntegration account={account} />
      </div>
    </div>
  );
}
