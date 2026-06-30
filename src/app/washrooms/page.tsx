"use client";

import { useState } from "react";
import type { ParkName } from "@/constants/parks";
import type { TimedCheckStatus } from "@/types/activity";
import { usePatrol } from "../context/PatrolContext";

const washroomParks: { park: ParkName; label: string }[] = [
  { park: "Centennial Park", label: "Centennial Park" },
  { park: "Harold Black Park", label: "Harold Black Park" },
  { park: "Marlene Streit Stewart Park", label: "MSSP" },
];

const cardStyles: Record<TimedCheckStatus, string> = {
  Green: "border-green-800 bg-green-500 text-white",
  Yellow: "border-yellow-700 bg-yellow-400 text-slate-950",
  Red: "border-red-900 bg-red-500 text-white",
};

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
        <h1 className="display-title text-4xl font-black">Washrooms</h1>
      </header>

      {blockedPark ? (
        <p className="rounded-2xl border-4 border-white bg-white/80 p-3 text-sm font-black text-slate-800 shadow-sm">
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
            <article
              key={park}
              className={`relative aspect-square min-h-36 rounded-2xl border-[6px] p-3 shadow-sm ${
                isLastOddTile ? "col-span-2 mx-auto w-[calc(50%-0.375rem)]" : ""
              } ${
                status
                  ? cardStyles[status]
                  : "border-[#0b1f4d] bg-[#2563eb] text-white"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenuPark((current) => (current === park ? null : park))
                }
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-black text-[#0b1f4d] shadow-sm"
                aria-label={`Open washroom options for ${park}`}
              >
                ...
              </button>

              <button
                type="button"
                onClick={() => handleCheck(park)}
                className="absolute inset-3 flex flex-col items-start justify-between rounded-xl text-left transition active:scale-[0.98]"
              >
                <span className="pr-10 text-lg font-black leading-tight">
                  {label}
                </span>
                <span className="max-w-full rounded-full border-2 border-[#0b1f4d] bg-white px-3 py-1.5 text-sm font-black text-[#0b1f4d] shadow-sm">
                  {checkedAt
                    ? timeFormatter.format(new Date(checkedAt))
                    : "Check Washroom"}
                </span>
              </button>

              {openMenuPark === park ? (
                <div className="absolute right-3 top-14 z-30 min-w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleUndo(park)}
                    disabled={!canUndo}
                    className="block min-h-10 w-full rounded-lg px-3 text-left text-xs font-bold text-slate-950 disabled:text-slate-300"
                  >
                    Undo Check
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </main>
  );
}
