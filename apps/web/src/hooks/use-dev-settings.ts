import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { DevSettings } from "@mailjot/types/sequence";

const DEFAULT_SETTINGS: DevSettings = {
  disableSending: false,
  testEmails: [],
};

export function useDevSettings() {
  const queryClient = useQueryClient();

  const { data: settings = DEFAULT_SETTINGS, isLoading } =
    useQuery<DevSettings>({
      queryKey: ["devSettings"],
      queryFn: async () => {
        const response = await fetch("/api/dev-settings");
        if (!response.ok) throw new Error("Failed to fetch dev settings");
        const data = await response.json();
        return data || DEFAULT_SETTINGS;
      },
    });

  const { mutate: updateSettings } = useMutation({
    mutationFn: async (
      newSettings: DevSettings | ((prev: DevSettings) => DevSettings)
    ) => {
      const settingsToUpdate =
        typeof newSettings === "function" ? newSettings(settings) : newSettings;

      const response = await fetch("/api/dev-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToUpdate),
      });
      if (!response.ok) throw new Error("Failed to update dev settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devSettings"] });
      toast({
        title: "Settings Saved",
        description: "Development settings have been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save development settings",
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings,
  };
}
