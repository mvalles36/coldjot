import { useState, useEffect } from "react";
import { SequenceStats } from "@mailjot/types";

export function useSequenceStats(sequenceId: string) {
  const [stats, setStats] = useState<SequenceStats>({
    active: 0,
    paused: 0,
    finished: 0,
    bounced: 0,
    notSent: 0,
    scheduled: 0,
    delivered: 0,
    replied: 0,
    interested: 0,
    optedOut: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sequences/${sequenceId}/stats`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching sequence stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [sequenceId]);

  return {
    stats,
    isLoading,
    refresh: fetchStats,
  };
}
