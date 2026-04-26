"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DashboardNavbar } from "./DashboardNavbar";
import { DashboardSidebar } from "./DashboardSidebar";

type DashboardShellContextValue = {
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
};

const DashboardShellContext = createContext<DashboardShellContextValue | null>(
  null,
);

export function useDashboardShellOptional() {
  return useContext(DashboardShellContext);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const toggleMobileSidebar = useCallback(
    () => setMobileSidebarOpen((v) => !v),
    [],
  );

  const value = useMemo(
    () => ({
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
    }),
    [mobileSidebarOpen, openMobileSidebar, closeMobileSidebar, toggleMobileSidebar],
  );

  return (
    <DashboardShellContext.Provider value={value}>
      <div className="relative flex h-dvh min-h-0 overflow-hidden bg-background">
        <DashboardSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardNavbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </DashboardShellContext.Provider>
  );
}

