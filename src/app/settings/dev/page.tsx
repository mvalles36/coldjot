import { DevSettingsForm } from "@/components/settings/dev-settings-form";

export default function DevSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-6">Development Settings</h1>
      <DevSettingsForm />
    </div>
  );
}
