"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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
const fixedDashboardTaskIds = ["washrooms-start", "garbage-early", "washrooms-end"];

function parseDisplayTime(time: string) {
  const match = time.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP])M$/i);

  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: match[2] ?? "00",
    period: `${match[3].toUpperCase()}M`,
  };
}

function formatTimePart(time: ReturnType<typeof parseDisplayTime>, showPeriod: boolean) {
  if (!time) {
    return "";
  }

  const minute = time.minute === "00" ? "" : `:${time.minute}`;
  const period = showPeriod ? ` ${time.period}` : "";

  return `${time.hour}${minute}${period}`;
}

function formatTimelineTime(task: ShiftTimelineTask) {
  const start = parseDisplayTime(task.time);

  if (!start) {
    return task.time;
  }

  return formatTimePart(start, true);
}

function normalizeTimelineTime(time: string) {
  const parsedTime = parseDisplayTime(time);

  if (!parsedTime) {
    return null;
  }

  return `${parsedTime.hour}:${parsedTime.minute} ${parsedTime.period}`;
}

function getRentalFieldClass(text: string, isDone: boolean) {
  const fieldBase = /soccer/i.test(text)
    ? "border-white bg-[#6fa85f]"
    : "border-white bg-[#a87443]";

  return `${fieldBase} ${isDone ? "ring-2 ring-green-500" : ""}`;
}

function applyRouteEdits(
  timeline: ShiftTimelineTask[],
  routeTaskOrder: string[],
  routeTaskTimes: Record<string, string>,
) {
  const orderedTaskIds = new Map(
    routeTaskOrder.map((taskId, index) => [taskId, index]),
  );
  const orderedTimeline =
    routeTaskOrder.length === 0
      ? timeline
      : [
          ...timeline
            .filter((task) => orderedTaskIds.has(task.id))
            .sort(
              (a, b) =>
                (orderedTaskIds.get(a.id) ?? 0) -
                (orderedTaskIds.get(b.id) ?? 0),
            ),
          ...timeline.filter((task) => !orderedTaskIds.has(task.id)),
        ];

  return orderedTimeline.map((task) => {
    const editedTime = routeTaskTimes[task.id];

    if (!editedTime) {
      return task;
    }

    return {
      ...task,
      time: editedTime,
      sortOrder: timeToMinutes(editedTime),
    };
  });
}

export default function Home() {
  const {
    rentals,
    washroomCheckedAt,
    garbageCheckedAt,
    endShift,
    lightTaskStates,
    routeTaskOrder,
    routeTaskTimes,
    setRouteTaskOrder,
    setRouteTaskTime,
    shiftEndedAt,
    shiftStartedAt,
    startShift,
    workerName,
  } = usePatrol();
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [starterName, setStarterName] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightTasks = getLightTasks(rentals);
  const washroomChecksDone = dashboardWashroomParks.every(
    (park) => washroomCheckedAt[park] !== null,
  );
  const garbageChecksDone = parks.every(
    (park) =>
      garbageCheckedAt[park].litter !== null &&
      garbageCheckedAt[park].garbageCans !== null,
  );
  const automaticTimeline = useMemo(
    () =>
      buildShiftTimeline({
        rentals,
        washroomParks: dashboardWashroomParks,
        garbageParks: parks,
        lightTasks,
      }),
    [lightTasks, rentals],
  );
  const fixedDashboardTasks = useMemo(
    () =>
      automaticTimeline.filter((task) =>
        fixedDashboardTaskIds.includes(task.id),
      ),
    [automaticTimeline],
  );
  const automaticRouteTimeline = useMemo(
    () =>
      automaticTimeline.filter(
        (task) => !fixedDashboardTaskIds.includes(task.id),
      ),
    [automaticTimeline],
  );
  const timeline = useMemo(
    () =>
      applyRouteEdits(automaticRouteTimeline, routeTaskOrder, routeTaskTimes),
    [automaticRouteTimeline, routeTaskOrder, routeTaskTimes],
  );

  useEffect(() => {
    const canvas = signatureCanvasRef.current;

    if (!canvas || !isStartOpen) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#020617";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, [isStartOpen]);

  function isTimelineTaskDone(task: ShiftTimelineTask) {
    if (task.category === "washroom") {
      return washroomChecksDone;
    }

    if (task.category === "garbage") {
      return garbageChecksDone;
    }

    if (task.category === "rental" && task.targetId) {
      const targetIds = task.targetIds ?? [task.targetId];

      return targetIds.every(
        (targetId) =>
          rentals.find((rental) => rental.id === targetId)?.checkedIn ?? false,
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

  function moveRouteTask(taskId: string, direction: -1 | 1) {
    const currentOrder = timeline.map((task) => task.id);
    const currentIndex = currentOrder.indexOf(taskId);
    const nextIndex = currentIndex + direction;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [movedTask] = nextOrder.splice(currentIndex, 1);

    nextOrder.splice(nextIndex, 0, movedTask);
    setRouteTaskOrder(nextOrder);
  }

  function editRouteTaskTime(task: ShiftTimelineTask) {
    const nextTime = window.prompt("Set task time", task.time);

    if (nextTime === null) {
      return;
    }

    const normalizedTime = normalizeTimelineTime(nextTime.trim());

    if (!normalizedTime) {
      window.alert("Use a time like 6:15 PM.");
      return;
    }

    if (
      timeline.some(
        (otherTask) => otherTask.id !== task.id && otherTask.time === normalizedTime,
      )
    ) {
      window.alert("Another task already has that time.");
      return;
    }

    setRouteTaskTime(task.id, normalizedTime);
  }

  function getSignaturePoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startSignature(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getSignaturePoint(event);

    if (!canvas || !context || !point) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsSigning(true);
  }

  function drawSignature(event: PointerEvent<HTMLCanvasElement>) {
    const context = signatureCanvasRef.current?.getContext("2d");
    const point = getSignaturePoint(event);

    if (!isSigning || !context || !point) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endSignature() {
    setIsSigning(false);
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function submitStartShift() {
    const trimmedName = starterName.trim();

    if (!trimmedName) {
      window.alert("Enter your name first.");
      return;
    }

    const signature = signatureCanvasRef.current?.toDataURL("image/png") ?? "";

    startShift(trimmedName, signature);
    setIsStartOpen(false);
  }

  if (!shiftStartedAt) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-4">
        <button
          type="button"
          onClick={() => setIsStartOpen(true)}
          className="min-h-16 w-full max-w-sm rounded-lg bg-slate-950 px-4 text-xl font-bold text-white shadow-sm transition active:scale-[0.99]"
        >
          Start Shift
        </button>

        {isStartOpen ? (
          <div className="fixed inset-0 z-30 flex items-end bg-black/40 p-4">
            <section className="mx-auto w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
              <h1 className="text-2xl font-bold">Start Shift</h1>
              <label className="mt-4 block">
                <span className="text-sm font-bold text-slate-700">Name</span>
                <input
                  value={starterName}
                  onChange={(event) => setStarterName(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-slate-950"
                  autoFocus
                />
              </label>
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-700">Signature</p>
                <canvas
                  ref={signatureCanvasRef}
                  width={480}
                  height={180}
                  onPointerDown={startSignature}
                  onPointerMove={drawSignature}
                  onPointerUp={endSignature}
                  onPointerCancel={endSignature}
                  className="mt-1 h-36 w-full touch-none rounded-lg border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={clearSignature}
                  className="mt-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950"
                >
                  Clear Signature
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsStartOpen(false)}
                  className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitStartShift}
                  className="min-h-12 rounded-lg bg-slate-950 px-4 font-bold text-white"
                >
                  Start
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-8 text-center">
        <p className="display-title text-sm font-black uppercase text-slate-600">
          {formatter.format(new Date())}
        </p>
        <h1 className="display-title mt-3 text-4xl font-black leading-tight">
          Hello {workerName || "_____"}
        </h1>
      </header>

      <section className="grid grid-cols-3 gap-3">
        {fixedDashboardTasks.map((task) => {
          const isDone = isTimelineTaskDone(task);
          const isWashroomTask =
            task.id === "washrooms-start" || task.id === "washrooms-end";
          const cardClassName = isWashroomTask
            ? "border-[#0b1f4d] bg-[#2563eb] text-white"
            : "border-slate-950 bg-slate-300 text-slate-950";
          const timeClassName = isWashroomTask
            ? "border-[#0b1f4d] bg-white text-[#0b1f4d]"
            : "border-slate-950 bg-white text-slate-950";

          return (
            <Link
              key={task.id}
              href={task.href}
              className={`flex aspect-square min-h-28 flex-col justify-between rounded-2xl border-[3px] p-3 shadow-sm transition active:scale-[0.98] ${cardClassName} ${
                isDone ? "ring-4 ring-green-400/80" : ""
              }`}
            >
              <span className="text-sm font-black leading-tight">
                {task.id === "washrooms-start"
                  ? "Washrooms-Start"
                  : task.id === "washrooms-end"
                    ? "Washroom-End"
                    : "Garbages"}
              </span>
              <span
                className={`self-start rounded-full border px-2 py-1 text-xs font-bold ${timeClassName}`}
              >
                {formatTimelineTime(task)}
              </span>
            </Link>
          );
        })}
      </section>

      <section className="rounded-2xl bg-[#b9e4f7] p-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Shift Timeline</h2>
          <button
            type="button"
            onClick={() => setIsEditingRoute((current) => !current)}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
          >
            {isEditingRoute ? "Done" : "Edit Route"}
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {timeline.map((step, index) => {
            const isDone = isTimelineTaskDone(step);
            const isLightsOffTask =
              step.category === "lights" && step.title === "Turn Lights Off";
            const timeChipClassName = `flex min-h-9 items-center justify-center rounded-full border px-3 text-sm font-bold ${
              isDone
                ? "border-green-600 bg-white text-green-800"
                : isLightsOffTask
                  ? "border-[#facc15] bg-slate-950 text-[#facc15]"
                : "border-slate-300 bg-slate-50 text-slate-700"
            }`;
            const cardContent = (
              <div className="grid grid-cols-[minmax(4.75rem,auto)_1fr] items-start gap-4">
                {isEditingRoute ? (
                  <button
                    type="button"
                    onClick={() => editRouteTaskTime(step)}
                    className={timeChipClassName}
                  >
                    {step.time ? formatTimelineTime(step) : index + 1}
                  </button>
                ) : (
                  <span className={timeChipClassName}>
                    {step.time ? formatTimelineTime(step) : index + 1}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-snug">{step.title}</h3>
                  <p
                    className={`mt-1 text-sm ${
                      isLightsOffTask ? "text-yellow-100" : "text-slate-600"
                    }`}
                  >
                    {step.detail}
                  </p>
                </div>
              </div>
            );
            const cardClassName =
              step.category === "rental"
                ? `block rounded-2xl border-[6px] p-4 shadow-sm transition active:scale-[0.99] ${getRentalFieldClass(
                    `${step.title} ${step.detail}`,
                    isDone,
                  )}`
                : step.category === "lights"
                  ? step.title === "Turn Lights Off"
                    ? `block rounded-2xl border-[4px] border-[#facc15] bg-slate-950 p-4 text-[#facc15] shadow-sm transition active:scale-[0.99] ${
                        isDone ? "ring-2 ring-green-500" : ""
                      }`
                    : `block rounded-2xl border-[4px] border-slate-950 bg-[#facc15] p-4 shadow-sm transition active:scale-[0.99] ${
                        isDone ? "ring-2 ring-green-500" : ""
                      }`
                : `block rounded-2xl border p-4 shadow-sm transition active:scale-[0.99] ${
                    isDone
                      ? "border-green-500 bg-green-50"
                      : "border-slate-200 bg-white"
                  }`;

            return isEditingRoute ? (
              <article key={step.id} className={cardClassName}>
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  {cardContent}
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => moveRouteTask(step.id, -1)}
                      disabled={index === 0}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-xl font-black text-slate-950 disabled:opacity-35"
                      aria-label={`Move ${step.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRouteTask(step.id, 1)}
                      disabled={index === timeline.length - 1}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-xl font-black text-slate-950 disabled:opacity-35"
                      aria-label={`Move ${step.title} down`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </article>
            ) : (
              <Link
                key={step.id}
                href={step.href}
                className={cardClassName}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("End this shift and save it in history?")) {
              endShift();
            }
          }}
          disabled={Boolean(shiftEndedAt)}
          className="mt-6 min-h-14 w-full rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm disabled:bg-slate-300 disabled:text-slate-600"
        >
          {shiftEndedAt ? "Shift Ended" : "End Shift"}
        </button>
      </section>
    </main>
  );
}
