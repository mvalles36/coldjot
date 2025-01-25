import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsChart } from "./stats-chart";
import type { ChartData } from "@/types/stats";

interface StatsChartSectionProps {
  data: ChartData[];
}

export function StatsChartSection({ data }: StatsChartSectionProps) {
  return (
    <Suspense
      fallback={
        <Card className="p-6">
          <Skeleton className="h-[400px]" />
        </Card>
      }
    >
      <StatsChart data={data} />
    </Suspense>
  );
}
