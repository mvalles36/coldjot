import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VapiSettings } from "@/components/settings/vapi-settings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // You can keep or remove the redirect depending on navigation flow.
  // Here, we render settings directly and include the VapiSettings component.
  // redirect("/settings/profile");

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Other settings components can be rendered here */}

      {/* Vapi Voice API Settings */}
      <VapiSettings />
    </div>
  );
}
