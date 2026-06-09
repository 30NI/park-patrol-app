"use client";

import { useState } from "react";
import { parks, type ParkName } from "@/constants/parks";
import type { GarbageCheckType, TimedCheckStatus } from "@/types/activity";
import { usePatrol } from "../context/PatrolContext";

const checkTypes: {
  type: GarbageCheckType;
  label: string;
  action: string;
}[] = [
  { type: "litter", label: "Litter", action: "Check Litter" },
  {
    type: "garbageCans",
    label: "Garbage Cans",
    action: "Check Garbage Cans",
  },
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

function getParkStatus(
  statuses: Record<GarbageCheckType, TimedCheckStatus | null>,
) {
  if (statuses.litter === "Red" || statuses.garbageCans === "Red") {
    return "Red";
  }

  if (statuses.litter === "Yellow" || statuses.garbageCans === "Yellow") {
    return "Yellow";
  }

  if (statuses.litter === "Green" && statuses.garbageCans === "Green") {
    return "Green";
  }

  return null;
}

export default function GarbagePage() {
  const {
    garbageStatuses,
    garbageCheckedAt,
    checkGarbage,
    canUndoTimedCheck,
    undoGarbage,
  } = usePatrol();
  const [blockedCheck, setBlockedCheck] = useState<{
    park: ParkName;
    type: GarbageCheckType;
  } | null>(null);

  function handleCheck(park: ParkName, type: GarbageCheckType) {
    const result = checkGarbage(park, type);
    setBlockedCheck(result === "too-soon" ? { park, type } : null);
  }

  function handleUndo(park: ParkName, type: GarbageCheckType, label: string) {
    if (window.confirm(`Undo this ${label.toLowerCase()} check?`)) {
      undoGarbage(park, type);
      setBlockedCheck(null);
    }
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Garbage</h1>
        <p className="mt-1 text-slate-600">
          Check litter and garbage cans at each park. Status ages automatically.
        </p>
      </header>

      <div className="space-y-3">
        {parks.map((park) => {
          const parkStatus = getParkStatus(garbageStatuses[park]);

          return (
            <article
              key={park}
              className={`rounded-lg border p-4 shadow-sm ${
                parkStatus ? cardStyles[parkStatus] : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold">{park}</h2>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-bold ${
                    parkStatus
                      ? badgeStyles[parkStatus]
                      : "border-slate-300 bg-slate-50 text-slate-600"
                  }`}
                >
                  {parkStatus ?? ""}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {checkTypes.map(({ type, label, action }) => {
                  const status = garbageStatuses[park][type];
                  const checkedAt = garbageCheckedAt[park][type];
                  const canUndo = canUndoTimedCheck(checkedAt);
                  const isBlocked =
                    blockedCheck?.park === park && blockedCheck.type === type;

                  return (
                    <section
                      key={type}
                      className="rounded-lg border border-black/10 bg-white/70 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{label}</p>
                          <p className="mt-1 text-sm text-slate-700">
                            {status
                              ? statusText[status]
                              : "Not checked this shift"}
                          </p>
                          {checkedAt ? (
                            <p className="mt-1 text-sm text-slate-600">
                              Last checked{" "}
                              {timeFormatter.format(new Date(checkedAt))}
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
                          {status ?? ""}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          canUndo
                            ? handleUndo(park, type, label)
                            : handleCheck(park, type)
                        }
                        className="mt-3 min-h-12 w-full rounded-lg bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition active:scale-[0.99]"
                      >
                        {canUndo ? "Undo Check" : action}
                      </button>
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
