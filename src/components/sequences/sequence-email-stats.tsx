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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Check, X, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSequenceStats } from "@/hooks/use-sequence-stats";

interface SequenceEmailStatsProps {
  sequenceId: string;
  isActive: boolean;
}

interface EmailStats {
  active: number;
  paused: number;
  finished: number;
  bounced: number;
  notSent: number;
  scheduled: number;
  delivered: number;
  replied: number;
  interested: number;
  optedOut: number;
}

export function SequenceEmailStats({
  sequenceId,
  isActive,
}: SequenceEmailStatsProps) {
  const [timeframe, setTimeframe] = useState("7d");
  const { stats, isLoading: statsLoading } = useSequenceStats(sequenceId);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  const fetchActivities = async () => {
    try {
      setIsLoadingActivities(true);
      const response = await fetch(
        `/api/sequences/${sequenceId}/activities?timeframe=${timeframe}`
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "in_progress":
        return <Badge variant="secondary">In Progress</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const deliveryRate =
    stats.notSent > 0
      ? ((stats.delivered / (stats.delivered + stats.notSent)) * 100).toFixed(1)
      : "N/A";

  const replyRate =
    stats.delivered > 0
      ? ((stats.replied / stats.delivered) * 100).toFixed(1)
      : "N/A";

  const interestRate =
    stats.delivered > 0
      ? ((stats.interested / stats.delivered) * 100).toFixed(1)
      : "N/A";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Email Activity</h3>
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Delivery Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deliveryRate === "N/A" ? "N/A" : `${deliveryRate}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reply Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {replyRate === "N/A" ? "N/A" : `${replyRate}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Interest Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interestRate === "N/A" ? "N/A" : `${interestRate}%`}
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <div className="space-y-1">
                      {getStatusBadge(activity.status)}
                      <div className="text-xs text-muted-foreground">
                        Step {activity.stepNumber} of {activity.totalSteps}
                      </div>
                    </div>
                  </TableCell>
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
