"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/shadcn/tabs";
import type { AcademicYear, MembershipPlanWithPeriod, Semester } from "@/lib/types/membership";
import { useCallback, useState } from "react";
import { getPeriodOptions } from "./actions";
import { PlansManagementContent } from "./PlansManagementContent";
import { AcademicPeriodsTab } from "./AcademicPeriodsTab";

type Props = {
  initialPlans: MembershipPlanWithPeriod[];
  initialSemesters: Semester[];
  initialAcademicYears: AcademicYear[];
};

export function MembershipsAdminContent({
  initialPlans,
  initialSemesters,
  initialAcademicYears,
}: Props) {
  const [semesters, setSemesters] = useState(initialSemesters);
  const [academicYears, setAcademicYears] = useState(initialAcademicYears);

  const refreshPeriods = useCallback(async () => {
    const res = await getPeriodOptions();
    if (!res.error) {
      setSemesters(res.semesters);
      setAcademicYears(res.academicYears);
    }
  }, []);

  return (
    <Tabs defaultValue="plans">
      <TabsList>
        <TabsTrigger value="plans">Plans</TabsTrigger>
        <TabsTrigger value="periods">Academic periods</TabsTrigger>
      </TabsList>

      <TabsContent value="plans" className="mt-4">
        <PlansManagementContent
          initialPlans={initialPlans}
          semesters={semesters}
          academicYears={academicYears}
        />
      </TabsContent>

      <TabsContent value="periods" className="mt-4">
        <AcademicPeriodsTab
          semesters={semesters}
          academicYears={academicYears}
          onChange={refreshPeriods}
        />
      </TabsContent>
    </Tabs>
  );
}
