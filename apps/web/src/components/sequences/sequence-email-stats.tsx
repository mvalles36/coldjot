"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Check, X, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSequenceStats } from "@/hooks/use-sequence-stats";

interface SequenceEmailStatsProps {
  sequenceId: string;
  isActive: boolean;
}

interface Activity {
  id: string;
  contactName: string;
  contactEmail: string;
  subject: string;
  stepNumber: number;
  totalSteps: number;
  stepName: string;
  status: "not_started" | "in_progress" | "completed" | "failed";
  timestamp: string;
}

export function SequenceEmailStats({
  sequenceId,
  isActive,
}: SequenceEmailStatsProps) {
  const [timeframe, setTimeframe] = useState("7d");
  const { stats, isLoading: statsLoading } = useSequenceStats(sequenceId);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  const fetchActivities = async () => {
    try {
      setIsLoadingActivities(true);
      const response = await fetch(
        `/api/sequences/${sequenceId}/emails?timeframe=${timeframe}`
      );
      if (!response.ok) throw new Error("Failed to fetch activities");
      const data = await response.json();
      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // If sequence is active, poll for updates every 30 seconds
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(fetchActivities, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sequenceId, timeframe, isActive]);

  const getStatusBadge = (status: Activity["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
          >
            <Check className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
          >
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            In Progress
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="destructive"
            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
          >
            <X className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
          >
            <Clock className="w-3 h-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingActivities ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : activities.length > 0 ? (
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{activity.contactName}</div>
                      <div className="text-sm text-muted-foreground">
                        {activity.contactEmail}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{activity.subject}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {activity.totalSteps > 0 ? (
                        <>
                          Step {activity.stepNumber} of {activity.totalSteps}
                          <div className="text-xs text-muted-foreground">
                            {activity.stepName}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {activity.stepName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(activity.status)}</TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  <div className="text-muted-foreground">
                    {isActive ? (
                      <>
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                        Waiting for email activity...
                      </>
                    ) : (
                      "No email activity yet. Launch the sequence to start sending emails."
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
