"use client";

import { useMemo } from "react";
import { getLightTasks } from "@/lib/lights";
import type { LightTaskState } from "@/types/light";
import { usePatrol } from "../context/PatrolContext";

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});

const emptyLightState: LightTaskState = {
  turnedOn: false,
  turnedOff: false,
  turnedOnAt: null,
  turnedOffAt: null,
};

function formatActualTime(timestamp: string | null) {
  return timestamp ? timeFormatter.format(new Date(timestamp)) : "Not recorded";
}

export default function LightsPage() {
  const { rentals, lightTaskStates, turnLightOn, turnLightOff, undoLightOn, undoLightOff } =
    usePatrol();
  const lightTasks = useMemo(() => getLightTasks(rentals), [rentals]);
  const completeCount = lightTasks.filter(
    (task) => lightTaskStates[task.id]?.turnedOn && lightTaskStates[task.id]?.turnedOff,
  ).length;

  function handleUndoLightOn(taskId: string) {
    if (window.confirm("Undo this lights-on check?")) {
      undoLightOn(taskId);
    }
  }

  function handleUndoLightOff(taskId: string) {
    if (window.confirm("Undo this lights-off check?")) {
      undoLightOff(taskId);
    }
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Lights</h1>
        <p className="mt-1 text-slate-600">
          Light tasks are generated from rentals that run past 8:30 PM.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Light Checks</h2>
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-700">
            {completeCount}/{lightTasks.length}
          </span>
        </div>
      </section>

      <div className="space-y-3">
        {lightTasks.length === 0 ? (
          <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
            No lights are needed for the current rental list.
          </p>
        ) : (
          lightTasks.map((task) => {
            const state = lightTaskStates[task.id] ?? emptyLightState;
            const isComplete = state.turnedOn && state.turnedOff;
            const isInUse = state.turnedOn && !state.turnedOff;

            return (
              <article
                key={task.id}
                className={`rounded-lg border p-4 shadow-sm ${
                  isComplete
                    ? "border-green-500 bg-green-50"
                    : isInUse
                      ? "border-yellow-400 bg-yellow-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{task.facility}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      Lights {task.scheduledOnTime} - {task.scheduledOffTime}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-bold ${
                      isComplete
                        ? "border-green-600 bg-white text-green-800"
                        : isInUse
                          ? "border-yellow-500 bg-white text-yellow-800"
                          : "border-slate-300 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {isComplete ? "Done" : isInUse ? "On" : "Open"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  <p>{task.park}</p>
                  <p>{task.organization}</p>
                  <p>
                    Rental {task.rentalStartTime} - {task.rentalEndTime}
                  </p>
                  <p>On: {formatActualTime(state.turnedOnAt)}</p>
                  <p>Off: {formatActualTime(state.turnedOffAt)}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      state.turnedOn
                        ? handleUndoLightOn(task.id)
                        : turnLightOn(task.id)
                    }
                    disabled={state.turnedOff}
                    className="min-h-14 rounded-lg bg-slate-950 px-3 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:bg-slate-300 disabled:text-slate-600"
                  >
                    {state.turnedOn ? "Undo On" : "Turn On"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      state.turnedOff
                        ? handleUndoLightOff(task.id)
                        : turnLightOff(task.id)
                    }
                    disabled={!state.turnedOn}
                    className="min-h-14 rounded-lg bg-slate-950 px-3 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:bg-slate-300 disabled:text-slate-600"
                  >
                    {state.turnedOff ? "Undo Off" : "Turn Off"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

    </main>
  );
}
