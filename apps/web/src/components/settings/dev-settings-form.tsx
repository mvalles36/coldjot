"use client";

// import { useDevSettings } from "@/hooks/use-dev-settings";
import { SequenceEmailSettings } from "@/components/sequences/sequence-dev-settings";
import { useState } from "react";

export function DevSettingsForm() {
  // const { settings, isLoading, updateSettings } = useDevSettings();
  const [testMode, setTestMode] = useState(false);

  // if (isLoading) {
  //   return <div>Loading...</div>;
  // }

  return (
    <SequenceEmailSettings
      sequenceId="global"
      testMode={testMode}
      onTestModeChange={setTestMode}
    />
  );
}
