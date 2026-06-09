"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parks, type ParkName } from "@/constants/parks";
import { getLightTasks } from "@/lib/lights";
import { buildShiftTimeline } from "@/lib/shiftPlanner";
import { timeToMinutes } from "@/lib/time";
import type { ShiftTimelineTask } from "@/types/shift";
import { usePatrol } from "./context/PatrolContext";

const formatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const dashboardWashroomParks: ParkName[] = [
  "Centennial Park",
  "Harold Black Park",
  "Marlene Streit Stewart Park",
];

export default function Home() {
  const router = useRouter();
  const {
    rentals,
    washroomCheckedAt,
    garbageCheckedAt,
    lightTaskStates,
  } = usePatrol();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const lightTasks = getLightTasks(rentals);
  const washroomChecksDone = dashboardWashroomParks.every(
    (park) => washroomCheckedAt[park] !== null,
  );
  const garbageChecksDone = parks.every(
    (park) =>
      garbageCheckedAt[park].litter !== null &&
      garbageCheckedAt[park].garbageCans !== null,
  );
  const timeline = buildShiftTimeline({
    rentals,
    washroomParks: dashboardWashroomParks,
    garbageParks: parks,
    lightTasks,
  });
  const sortedLightOffTasks = lightTasks
    .slice()
    .sort(
      (a, b) =>
        timeToMinutes(a.scheduledOffTime) - timeToMinutes(b.scheduledOffTime),
    );

  function isTimelineTaskDone(task: ShiftTimelineTask) {
    if (task.category === "washroom") {
      return washroomChecksDone;
    }

    if (task.category === "garbage") {
      return garbageChecksDone;
    }

    if (task.category === "rental" && task.targetId) {
      return (
        rentals.find((rental) => rental.id === task.targetId)?.checkedIn ?? false
      );
    }

    if (task.category === "lights" && task.targetId) {
      const state = lightTaskStates[task.targetId];

      return task.id.endsWith("-on")
        ? state?.turnedOn ?? false
        : state?.turnedOff ?? false;
    }

    return false;
  }

  return (
    <main className="space-y-5 p-4">
      <header className="pt-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Today
        </p>
        <h1 className="mt-1 text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-slate-600">{formatter.format(new Date())}</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-bold">Shift Rentals</h2>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-16 w-full rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
          >
            Upload Rentals
          </button>
          <button
            type="button"
            onClick={() => router.push("/rentals/new")}
            className="min-h-16 w-full rounded-lg border border-slate-300 bg-white px-4 text-base font-bold text-slate-950 shadow-sm transition active:scale-[0.99]"
          >
            Enter Rentals Manually
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.csv,.xlsx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setSelectedFileName(file?.name ?? "");
          }}
        />

        {selectedFileName ? (
          <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
            Selected: {selectedFileName}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-bold">Shift Timeline</h2>
        {sortedLightOffTasks.length > 0 ? (
          <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
            Lights off by rental end time. If missed, report defaults off time
            to 11:00 PM.
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          {timeline.map((step, index) => {
            const isDone = isTimelineTaskDone(step);

            return (
              <Link
                key={step.id}
                href={step.href}
                className={`block rounded-lg border p-4 shadow-sm transition active:scale-[0.99] ${
                  isDone
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex min-h-8 min-w-16 shrink-0 items-center justify-center rounded-full border px-2 text-xs font-bold ${
                      isDone
                        ? "border-green-600 bg-white text-green-800"
                        : "border-slate-300 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {isDone ? "OK" : step.time || index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
