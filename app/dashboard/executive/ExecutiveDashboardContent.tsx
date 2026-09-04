"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/shadcn/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/app/components/ui/shadcn/chart";
import type { ExecutiveDashboardData } from "./actions";

const signupsConfig = {
  count: { label: "New sign-ups", color: "var(--chart-1)" },
} satisfies ChartConfig;

const membershipsConfig = {
  count: { label: "New memberships", color: "var(--chart-2)" },
} satisfies ChartConfig;

const growthConfig = {
  total: { label: "Total members", color: "var(--chart-3)" },
} satisfies ChartConfig;

const formsConfig = {
  count: { label: "Submissions", color: "var(--chart-4)" },
} satisfies ChartConfig;

function BarChartCard({
  title,
  description,
  data,
  config,
  dataKey,
}: {
  title: string;
  description: string;
  data: { date: string; count: number }[];
  config: ChartConfig;
  dataKey: "count";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function ExecutiveDashboardContent({ data }: { data: ExecutiveDashboardData }) {
  return (
    <div className="space-y-4">
      {data.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {data.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <BarChartCard
          title="New sign-ups"
          description="New user accounts, last 7 days"
          data={data.signups}
          config={signupsConfig}
          dataKey="count"
        />

        <BarChartCard
          title="New memberships"
          description="Paid memberships purchased, last 7 days"
          data={data.memberships}
          config={membershipsConfig}
          dataKey="count"
        />

        <Card>
          <CardHeader>
            <CardTitle>Member growth</CardTitle>
            <CardDescription>Cumulative total users, last 10 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={growthConfig} className="aspect-auto h-[220px] w-full">
              <LineChart data={data.growth}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="total"
                  type="monotone"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <BarChartCard
          title="Form submissions"
          description="Application/form responses, last 7 days"
          data={data.formSubmissions}
          config={formsConfig}
          dataKey="count"
        />
      </div>
    </div>
  );
}
