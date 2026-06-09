import type { ReactNode } from "react";
import { BottomNavigation } from "./BottomNavigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto min-h-screen max-w-md bg-white pb-28 shadow-sm">
        {children}
      </div>
      <BottomNavigation />
    </>
  );
}
