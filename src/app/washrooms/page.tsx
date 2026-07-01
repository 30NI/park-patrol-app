"use client";

import { useState } from "react";
import type { ParkName } from "@/constants/parks";
import type { TimedCheckStatus } from "@/types/activity";
import { ParkCheckCard } from "../components/ParkCheckCard";
import { usePatrol } from "../context/PatrolContext";

const washroomParks: { park: ParkName; label: string }[] = [
  { park: "Centennial Park", label: "Centennial Park" },
  { park: "Harold Black Park", label: "Harold Black Park" },
  {
    park: "Marlene Streit Stewart Park",
    label: "Marlene Streit Stewart Park",
  },
];

const cardStyles: Record<TimedCheckStatus, string> = {
  Green: "border-green-800 bg-green-500 text-white",
  Yellow: "border-yellow-700 bg-yellow-400 text-slate-950",
  Red: "border-red-900 bg-red-500 text-white",
};
const baseCardStyle = "border-[#0b1f4d] bg-[#2563eb] text-white";
const checkButtonStyle = "border-2 border-[#0b1f4d] bg-white text-[#0b1f4d]";

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});

export default function WashroomsPage() {
  const {
    washroomStatuses,
    washroomCheckedAt,
    checkWashroom,
    canUndoTimedCheck,
    undoWashroom,
  } = usePatrol();
  const [blockedPark, setBlockedPark] = useState<ParkName | null>(null);
  const [openMenuPark, setOpenMenuPark] = useState<ParkName | null>(null);

  function handleCheck(park: ParkName) {
    const result = checkWashroom(park);
    setBlockedPark(result === "too-soon" ? park : null);
  }

  function handleUndo(park: ParkName) {
    if (window.confirm("Undo this washroom check?")) {
      undoWashroom(park);
      setBlockedPark(null);
      setOpenMenuPark(null);
    }
  }

  return (
    <main className="space-y-4 p-4 pb-8">
      <header className="pt-2 text-center">
        <h1 className="page-title">Washrooms</h1>
      </header>

      {blockedPark ? (
        <p className="rounded-2xl border-4 border-white bg-white/80 p-3 text-sm font-semibold leading-snug text-slate-800 shadow-sm">
          {blockedPark} was already checked within the last 30 minutes.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {washroomParks.map(({ park, label }, index) => {
          const status = washroomStatuses[park];
          const checkedAt = washroomCheckedAt[park];
          const canUndo = canUndoTimedCheck(checkedAt);
          const isLastOddTile =
            washroomParks.length % 2 === 1 && index === washroomParks.length - 1;

          return (
            <ParkCheckCard
              key={park}
              park={park}
              label={label}
              status={status}
              checkedLabel={
                checkedAt ? timeFormatter.format(new Date(checkedAt)) : null
              }
              baseClassName={baseCardStyle}
              statusClassNames={cardStyles}
              checkButtonClassName={checkButtonStyle}
              isCentered={isLastOddTile}
              isMenuOpen={openMenuPark === park}
              canUndo={canUndo}
              undoLabel="Undo Check"
              onToggleMenu={() =>
                setOpenMenuPark((current) => (current === park ? null : park))
              }
              onCheck={() => handleCheck(park)}
              onUndo={() => handleUndo(park)}
            />
          );
        })}
      </div>
    </main>
  );
}
