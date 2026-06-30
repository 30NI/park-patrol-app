"use client";

import { useMemo, useState } from "react";
import { getLightTasks } from "@/lib/lights";
import type { LightTaskState } from "@/types/light";
import { usePatrol } from "../context/PatrolContext";

const emptyLightState: LightTaskState = {
  turnedOn: false,
  turnedOff: false,
  turnedOnAt: null,
  turnedOffAt: null,
};

function getLightFieldClass(facility: string) {
  return /soccer/i.test(facility)
    ? "border-white bg-[#6fa85f]"
    : "border-white bg-[#a87443]";
}

export default function LightsPage() {
  const { rentals, lightTaskStates, turnLightOn, turnLightOff, undoLightOn, undoLightOff } =
    usePatrol();
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const lightTasks = useMemo(() => getLightTasks(rentals), [rentals]);

  function handleUndoLightOn(taskId: string) {
    if (window.confirm("Undo this lights-on check?")) {
      undoLightOn(taskId);
      setOpenMenuTaskId(null);
    }
  }

  function handleUndoLightOff(taskId: string) {
    if (window.confirm("Undo this lights-off check?")) {
      undoLightOff(taskId);
      setOpenMenuTaskId(null);
    }
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2 text-center">
        <h1 className="display-title text-4xl font-black">Lights</h1>
      </header>

      <div>
        {lightTasks.length === 0 ? (
          <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
            No lights are needed for the current rental list.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {lightTasks.map((task) => {
              const state = lightTaskStates[task.id] ?? emptyLightState;
              const isComplete = state.turnedOn && state.turnedOff;
              const isInUse = state.turnedOn && !state.turnedOff;
              const actionLabel = !state.turnedOn
                ? "Turn On"
                : state.turnedOff
                  ? "Done"
                  : "Turn Off";

              return (
                <article
                  key={task.id}
                  className={`relative flex aspect-square min-h-40 flex-col justify-between rounded-2xl border-[6px] p-4 shadow-sm ${getLightFieldClass(
                    task.facility,
                  )} ${
                    isComplete
                      ? "ring-2 ring-green-500"
                      : isInUse
                        ? "ring-2 ring-yellow-400"
                        : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenuTaskId((current) =>
                        current === task.id ? null : task.id,
                      )
                    }
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-black text-slate-700 shadow-sm"
                    aria-label={`Open light options for ${task.facility}`}
                  >
                    ...
                  </button>

                  {openMenuTaskId === task.id ? (
                    <div className="absolute right-3 top-14 z-10 min-w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => handleUndoLightOn(task.id)}
                        disabled={!state.turnedOn}
                        className="block min-h-10 w-full rounded-lg px-3 text-left text-xs font-bold text-slate-950 disabled:text-slate-300"
                      >
                        Undo Turn On
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUndoLightOff(task.id)}
                        disabled={!state.turnedOff}
                        className="block min-h-10 w-full rounded-lg px-3 text-left text-xs font-bold text-slate-950 disabled:text-slate-300"
                      >
                        Undo Turn Off
                      </button>
                    </div>
                  ) : null}

                  <h2 className="pr-10 text-base font-black leading-tight text-slate-950">
                    {task.facility}
                  </h2>
                  <p className="mt-2 inline-flex self-start rounded-full bg-white/90 px-2 py-1 text-xs font-black text-slate-800 shadow-sm">
                    {task.scheduledOnTime} - {task.scheduledOffTime}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!state.turnedOn) {
                        turnLightOn(task.id);
                        return;
                      }

                      if (!state.turnedOff) {
                        turnLightOff(task.id);
                      }
                    }}
                    disabled={isComplete}
                    className={`min-h-12 rounded-xl px-3 text-base font-black shadow-sm transition active:scale-[0.98] ${
                      isComplete
                        ? "bg-slate-200 text-slate-500"
                        : "bg-slate-950 text-white"
                    }`}
                  >
                    {actionLabel}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

    </main>
  );
}
