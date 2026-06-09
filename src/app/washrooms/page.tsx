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
  Green: "border-green-500 bg-green-50",
  Yellow: "border-yellow-400 bg-yellow-50",
  Red: "border-red-500 bg-red-50",
};

const badgeStyles: Record<TimedCheckStatus, string> = {
  Green: "border-green-600 bg-white text-green-800",
  Yellow: "border-yellow-500 bg-white text-yellow-800",
  Red: "border-red-600 bg-white text-red-800",
};

const statusText: Record<TimedCheckStatus, string> = {
  Green: "Checked within 2 hours",
  Yellow: "Checked 2-4 hours ago",
  Red: "Checked 4+ hours ago",
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

  function handleCheck(park: ParkName) {
    const result = checkWashroom(park);
    setBlockedPark(result === "too-soon" ? park : null);
  }

  function handleUndo(park: ParkName) {
    if (window.confirm("Undo this washroom check?")) {
      undoWashroom(park);
      setBlockedPark(null);
    }
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Washrooms</h1>
        <p className="mt-1 text-slate-600">
          Tap a washroom after checking it. Status ages automatically.
        </p>
      </header>

      <div className="space-y-3">
        {washroomParks.map(({ park, label }) => {
          const status = washroomStatuses[park];
          const checkedAt = washroomCheckedAt[park];
          const canUndo = canUndoTimedCheck(checkedAt);
          const isBlocked = blockedPark === park;

          return (
            <article
              key={park}
              className={`rounded-lg border p-4 shadow-sm ${
                status ? cardStyles[status] : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{label}</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    {status ? statusText[status] : "Not checked this shift"}
                  </p>
                  {checkedAt ? (
                    <p className="mt-1 text-sm text-slate-600">
                      Last checked {timeFormatter.format(new Date(checkedAt))}
                    </p>
                  ) : null}
                  {isBlocked ? (
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      Already checked within the last 30 minutes.
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-bold ${
                    status
                      ? badgeStyles[status]
                      : "border-slate-300 bg-slate-50 text-slate-600"
                  }`}
                >
                  {status ?? "New"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => (canUndo ? handleUndo(park) : handleCheck(park))}
                className="mt-4 min-h-14 w-full rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
              >
                {canUndo ? "Undo Check" : "Check Washroom"}
              </button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
