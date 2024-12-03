import { Card } from "@/components/ui/card";
import {
  BarChart3,
  Mail,
  MousePointerClick,
  Reply,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SequenceStatsProps {
  stats: {
    totalEmails: number;
    sentEmails: number;
    openedEmails: number;
    clickedEmails: number;
    repliedEmails: number;
    bouncedEmails: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  };
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
}

interface CustomProgressProps {
  value?: number;
  className?: string;
}

const CustomProgress = ({
  value = 0,
  className,
  ...props
}: CustomProgressProps) => {
  return (
    <div
      className={cn(
        "h-2 w-full bg-secondary overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

export const SequenceStats = ({ stats }: SequenceStatsProps) => {
  const statCards: StatCardProps[] = [
    {
      title: "Sent Emails",
      value: stats.sentEmails,
      icon: Mail,
      color: "text-blue-500",
    },
    {
      title: "Open Rate",
      value: `${stats.openRate.toFixed(1)}%`,
      icon: BarChart3,
      color: "text-green-500",
    },
    {
      title: "Click Rate",
      value: `${stats.clickRate.toFixed(1)}%`,
      icon: MousePointerClick,
      color: "text-yellow-500",
    },
    {
      title: "Reply Rate",
      value: `${stats.replyRate.toFixed(1)}%`,
      icon: Reply,
      color: "text-purple-500",
    },
    {
      title: "Bounce Rate",
      value: `${stats.bounceRate.toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <span className="text-sm text-muted-foreground">{stat.title}</span>
          </div>
          <div className="text-2xl font-bold">{stat.value}</div>
          {stat.title !== "Sent Emails" && (
            <CustomProgress
              value={
                typeof stat.value === "string"
                  ? Number(stat.value.replace("%", ""))
                  : stat.value
              }
              className={cn("mt-2", stat.color.replace("text-", "bg-"))}
            />
          )}
        </Card>
      ))}
    </div>
  );
};
