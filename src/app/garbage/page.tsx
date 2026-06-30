"use client";

import { useState } from "react";
import { parks, type ParkName } from "@/constants/parks";
import type { GarbageCheckType, TimedCheckStatus } from "@/types/activity";
import { usePatrol } from "../context/PatrolContext";

const garbageCheckTypes: GarbageCheckType[] = ["garbageCans", "litter"];

const cardStyles: Record<TimedCheckStatus, string> = {
  Green: "border-green-800 bg-green-500 text-white",
  Yellow: "border-yellow-700 bg-yellow-400 text-slate-950",
  Red: "border-red-900 bg-red-500 text-white",
};

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});

export default function GarbagePage() {
  const {
    garbageStatuses,
    garbageCheckedAt,
    checkGarbage,
    canUndoTimedCheck,
    undoGarbage,
  } = usePatrol();
  const [blockedPark, setBlockedPark] = useState<ParkName | null>(null);
  const [openMenuPark, setOpenMenuPark] = useState<ParkName | null>(null);

  function getGarbageStatus(park: ParkName) {
    const statuses = garbageStatuses[park];

    if (statuses.garbageCans === "Red" || statuses.litter === "Red") {
      return "Red";
    }

    if (statuses.garbageCans === "Yellow" || statuses.litter === "Yellow") {
      return "Yellow";
    }

    if (statuses.garbageCans === "Green" && statuses.litter === "Green") {
      return "Green";
    }

    return null;
  }

  function getLastCheckedAt(park: ParkName) {
    const checkedTimes = garbageCheckTypes
      .map((type) => garbageCheckedAt[park][type])
      .filter((checkedAt): checkedAt is string => Boolean(checkedAt))
      .map((checkedAt) => new Date(checkedAt).getTime());

    if (checkedTimes.length === 0) {
      return null;
    }

    return new Date(Math.max(...checkedTimes));
  }

  function canUndoGarbage(park: ParkName) {
    return garbageCheckTypes.some((type) =>
      canUndoTimedCheck(garbageCheckedAt[park][type]),
    );
  }

  function handleCheck(park: ParkName) {
    const results = garbageCheckTypes.map((type) => checkGarbage(park, type));
    setBlockedPark(results.every((result) => result === "too-soon") ? park : null);
  }

  function handleUndo(park: ParkName) {
    if (window.confirm("Undo this garbage check?")) {
      garbageCheckTypes.forEach((type) => {
        if (canUndoTimedCheck(garbageCheckedAt[park][type])) {
          undoGarbage(park, type);
        }
      });
      setBlockedPark(null);
      setOpenMenuPark(null);
    }
  }

  return (
    <main className="space-y-4 p-4 pb-8">
      <header className="pt-2 text-center">
        <h1 className="display-title text-4xl font-black">Garbage</h1>
      </header>

      {blockedPark ? (
        <p className="rounded-2xl border-4 border-white bg-white/80 p-3 text-sm font-black text-slate-800 shadow-sm">
          {blockedPark} garbage was already checked within the last 30 minutes.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {parks.map((park, index) => {
          const isLastOddTile = parks.length % 2 === 1 && index === parks.length - 1;
          const status = getGarbageStatus(park);
          const checkedAt = getLastCheckedAt(park);
          const canUndo = canUndoGarbage(park);

          return (
            <article
              key={park}
              className={`relative aspect-square min-h-36 rounded-2xl border-[6px] p-3 shadow-sm ${
                isLastOddTile ? "col-span-2 mx-auto w-[calc(50%-0.375rem)]" : ""
              } ${
                status
                  ? cardStyles[status]
                  : "border-slate-950 bg-slate-300 text-slate-950"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenuPark((current) => (current === park ? null : park))
                }
                className="absolute right-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-lg font-black text-slate-700 shadow-sm"
                aria-label={`Open garbage options for ${park}`}
              >
                ...
              </button>

              {openMenuPark === park ? (
                <div className="absolute right-3 top-14 z-30 min-w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleUndo(park)}
                    disabled={!canUndo}
                    className="block min-h-10 w-full rounded-lg px-3 text-left text-xs font-bold text-slate-950 disabled:text-slate-300"
                  >
                    Undo Garbage
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => handleCheck(park)}
                className="absolute inset-3 flex flex-col items-start justify-between rounded-xl text-left transition active:scale-[0.98]"
              >
                <span className="pr-10 text-lg font-black leading-tight">
                  {park}
                </span>
                <span className="max-w-full rounded-full border-2 border-slate-950 bg-white px-3 py-1.5 text-sm font-black text-slate-950 shadow-sm">
                  {checkedAt ? timeFormatter.format(checkedAt) : "Check Garbage"}
                </span>
              </button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
