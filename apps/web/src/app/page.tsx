import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, Users, FileText, Building2 } from "lucide-react";
import { StatsGrid } from "@/components/stats/stats-grid";
import { StatsChartSection } from "@/components/stats/stats-chart-section";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatsData, ChartData } from "@/types/stats";

// Demo data for development and preview
const DEMO_MODE = true; // Toggle this to switch between real and demo data

const DEMO_STATS: StatsData = {
  totalEmails: 22453,
  sentEmails: 22453,
  openedEmails: 17234,
  uniqueOpens: 11560,
  clickedEmails: 8231,
  repliedEmails: 974,
  bouncedEmails: 0,
  unsubscribed: 3,
  interested: 105,
  peopleContacted: 8560,
  openRate: 67.85,
  replyRate: 7.87,
  bounceRate: 0,
};

const DEMO_CHART_DATA: ChartData[] = Array.from({ length: 30 }).map((_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const dateStr = date.toISOString().split("T")[0];

  // Create more natural variations in the data
  const baseValue = 500;
  const randomFactor = Math.random() * 0.4 + 0.8; // Random between 0.8 and 1.2
  const sent = Math.round(baseValue * randomFactor);
  const openRate = 0.67 * (Math.random() * 0.2 + 0.9); // Random between 0.9 and 1.1 of base rate
  const replyRate = 0.08 * (Math.random() * 0.3 + 0.85); // Random between 0.85 and 1.15 of base rate
  const uniqueOpenRate = 0.45 * (Math.random() * 0.2 + 0.9); // Random between 0.9 and 1.1 of base rate

  return {
    date: dateStr,
    sent,
    opened: Math.round(sent * openRate),
    replied: Math.round(sent * replyRate),
    uniqueOpens: Math.round(sent * uniqueOpenRate),
  };
});

async function getOverallStats(): Promise<StatsData> {
  if (DEMO_MODE) {
    return DEMO_STATS;
  }

  const stats = await prisma.sequenceStats.aggregate({
    _sum: {
      totalEmails: true,
      sentEmails: true,
      openedEmails: true,
      uniqueOpens: true,
      clickedEmails: true,
      repliedEmails: true,
      bouncedEmails: true,
      unsubscribed: true,
      interested: true,
      peopleContacted: true,
    },
  });

  const totalSent = stats._sum.sentEmails || 0;
  const totalReplies = stats._sum.repliedEmails || 0;

  return {
    totalEmails: stats._sum.totalEmails || 0,
    sentEmails: totalSent,
    openedEmails: stats._sum.openedEmails || 0,
    uniqueOpens: stats._sum.uniqueOpens || 0,
    clickedEmails: stats._sum.clickedEmails || 0,
    repliedEmails: totalReplies,
    bouncedEmails: stats._sum.bouncedEmails || 0,
    unsubscribed: stats._sum.unsubscribed || 0,
    interested: stats._sum.interested || 0,
    peopleContacted: stats._sum.peopleContacted || 0,
    openRate:
      totalSent > 0 ? ((stats._sum.openedEmails || 0) / totalSent) * 100 : 0,
    replyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
    bounceRate:
      totalSent > 0 ? ((stats._sum.bouncedEmails || 0) / totalSent) * 100 : 0,
  };
}

async function getChartData(): Promise<ChartData[]> {
  if (DEMO_MODE) {
    return DEMO_CHART_DATA;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const events = await prisma.emailEvent.findMany({
    where: {
      timestamp: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  const dailyStats: Record<string, ChartData> = events.reduce(
    (acc, event) => {
      const date = event.timestamp.toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          sent: 0,
          opened: 0,
          replied: 0,
          uniqueOpens: 0,
        };
      }

      switch (event.type) {
        case "sent":
          acc[date].sent++;
          break;
        case "opened":
          acc[date].opened++;
          break;
        case "replied":
          acc[date].replied++;
          break;
        case "uniqueOpen":
          acc[date].uniqueOpens++;
          break;
      }

      return acc;
    },
    {} as Record<string, ChartData>
  );

  return Object.values(dailyStats);
}

function StatsLoadingCard() {
  return (
    <Card className="p-4 shadow-none">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-32 mt-2" />
      <Skeleton className="h-4 w-16 mt-1" />
      <Skeleton className="h-2 w-full mt-2 rounded-full" />
    </Card>
  );
}

function StatsLoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <StatsLoadingCard key={i} />
      ))}
    </div>
  );
}

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  const stats = await getOverallStats();
  const chartData = await getChartData();

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-8">
      <h1 className="text-4xl font-semibold mb-8">Welcome to ColdJot</h1>

      <Suspense fallback={<StatsLoadingGrid />}>
        <StatsGrid stats={stats} />
      </Suspense>

      <StatsChartSection data={chartData} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/sequences">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <Mail className="h-8 w-8" />
            <span>Email Sequences</span>
          </Button>
        </Link>

        <Link href="/contacts">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <Users className="h-8 w-8" />
            <span>Contacts</span>
          </Button>
        </Link>

        <Link href="/templates">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <FileText className="h-8 w-8" />
            <span>Templates</span>
          </Button>
        </Link>

        <Link href="/organizations">
          <Button
            variant="outline"
            className="w-full h-32 flex flex-col items-center justify-center gap-2"
          >
            <Building2 className="h-8 w-8" />
            <span>Organizations</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
