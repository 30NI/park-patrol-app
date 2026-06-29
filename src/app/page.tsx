"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { parks, type ParkName } from "@/constants/parks";
import { getLightTasks } from "@/lib/lights";
import { buildShiftTimeline } from "@/lib/shiftPlanner";
import { minutesToTime, timeToMinutes } from "@/lib/time";
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
  const minutes = timeToMinutes(time);

  if (minutes === 0 && time !== "12:00 AM") {
    return null;
  }

  return minutesToTime(minutes);
}

function applyRouteEdits(
  timeline: ShiftTimelineTask[],
  rentals: ReturnType<typeof usePatrol>["rentals"],
  routeTaskOrder: string[],
  routeTaskTimes: Record<string, string>,
) {
  const rentalByTaskId = new Map(
    rentals.map((rental) => [`rental-check-${rental.id}`, rental]),
  );
  const fixedTasks = timeline.filter((task) => task.category !== "rental");
  const rentalTasks = timeline.filter((task) => task.category === "rental");
  const rentalOrderMap = new Map(
    routeTaskOrder.map((taskId, index) => [taskId, index]),
  );
  const orderedRentalTasks =
    routeTaskOrder.length === 0
      ? rentalTasks
      : [
          ...rentalTasks
            .filter((task) => rentalOrderMap.has(task.id))
            .sort(
              (a, b) =>
                (rentalOrderMap.get(a.id) ?? 0) -
                (rentalOrderMap.get(b.id) ?? 0),
            ),
          ...rentalTasks.filter((task) => !rentalOrderMap.has(task.id)),
        ];
  let previousPark: string | null = null;
  let previousWorkflowMinutes: number | null = null;

  const editedRentalTasks = orderedRentalTasks.map((task) => {
    const rental = rentalByTaskId.get(task.id);
    const rentalStartMinutes = rental ? timeToMinutes(rental.startTime) : task.sortOrder;
    const travelMinutes =
      previousWorkflowMinutes === null
        ? 0
        : rental?.park === previousPark
          ? 5
          : 15;
    const workflowMinutes =
      previousWorkflowMinutes === null
        ? rentalStartMinutes
        : Math.max(rentalStartMinutes, previousWorkflowMinutes + travelMinutes);
    const overrideTime = routeTaskTimes[task.id];
    const overrideMinutes = overrideTime ? timeToMinutes(overrideTime) : null;
    const finalMinutes =
      overrideMinutes !== null &&
      (overrideMinutes !== 0 || overrideTime === "12:00 AM")
        ? overrideMinutes
        : workflowMinutes;

    previousPark = rental?.park ?? previousPark;
    previousWorkflowMinutes = finalMinutes;

    return {
      ...task,
      time: minutesToTime(finalMinutes),
      sortOrder: finalMinutes,
    };
  });

  return [...fixedTasks, ...editedRentalTasks].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export default function Home() {
  const {
    rentals,
    washroomCheckedAt,
    garbageCheckedAt,
    endShift,
    lightTaskStates,
    resetRouteEdits,
    routeTaskOrder,
    routeTaskTimes,
    setRouteTaskOrder,
    setRouteTaskTime,
    shiftEndedAt,
    shiftStartedAt,
    startShift,
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
  const timeline = useMemo(
    () => applyRouteEdits(automaticTimeline, rentals, routeTaskOrder, routeTaskTimes),
    [automaticTimeline, rentals, routeTaskOrder, routeTaskTimes],
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

  function moveRouteTask(taskId: string, direction: -1 | 1) {
    const currentOrder = timeline
      .filter((task) => task.category === "rental")
      .map((task) => task.id);
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

  function adjustRouteTaskTime(task: ShiftTimelineTask, minutes: number) {
    const currentMinutes = timeToMinutes(task.time);

    if (currentMinutes === 0 && task.time !== "12:00 AM") {
      return;
    }

    setRouteTaskTime(task.id, minutesToTime(currentMinutes + minutes));
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

    setRouteTaskTime(task.id, normalizedTime);
  }

  function resetRoute() {
    if (window.confirm("Reset the dashboard back to the automatic route?")) {
      resetRouteEdits();
    }
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
    <main className="space-y-6 p-4">
      <header className="pt-10">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {formatter.format(new Date())}
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">Hello B</h1>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Shift Timeline</h2>
          <button
            type="button"
            onClick={() => setIsEditingRoute((current) => !current)}
            className="min-h-11 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white"
          >
            {isEditingRoute ? "Done" : "Edit Route"}
          </button>
        </div>
        {isEditingRoute ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetRoute}
              className="col-span-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950"
            >
              Reset Auto Route
            </button>
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {timeline.map((step, index) => {
            const isDone = isTimelineTaskDone(step);
            const rentalTimeline = timeline.filter(
              (task) => task.category === "rental",
            );
            const rentalIndex = rentalTimeline.findIndex(
              (task) => task.id === step.id,
            );
            const timeChipClassName = `flex min-h-9 items-center justify-center rounded-full border px-3 text-sm font-bold ${
              isDone
                ? "border-green-600 bg-white text-green-800"
                : "border-slate-300 bg-slate-50 text-slate-700"
            }`;
            const cardContent = (
              <div className="grid grid-cols-[2.75rem_minmax(4.75rem,auto)_1fr] items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-lg font-bold ${
                    isDone
                      ? "border-green-600 bg-white text-green-800"
                      : "border-slate-300 bg-slate-50 text-slate-500"
                  }`}
                >
                  {isDone ? "OK" : "="}
                </span>
                {isEditingRoute && step.category === "rental" ? (
                  <button
                    type="button"
                    onClick={() => {
                      editRouteTaskTime(step);
                    }}
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
                  <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
                </div>
              </div>
            );
            const cardClassName = `block rounded-lg border p-4 shadow-sm transition active:scale-[0.99] ${
              isDone
                ? "border-green-500 bg-green-50"
                : "border-slate-200 bg-white"
            }`;

            return isEditingRoute ? (
              <article key={step.id} className={cardClassName}>
                {cardContent}
                {step.category === "rental" ? (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => moveRouteTask(step.id, -1)}
                      disabled={rentalIndex === 0}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-950 disabled:opacity-40"
                      aria-label={`Move ${step.title} earlier`}
                    >
                      Earlier
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRouteTask(step.id, 1)}
                      disabled={rentalIndex === rentalTimeline.length - 1}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-950 disabled:opacity-40"
                      aria-label={`Move ${step.title} later`}
                    >
                      Later
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustRouteTaskTime(step, 5)}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-950"
                      aria-label={`Move ${step.title} five minutes later`}
                    >
                      +5 min
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustRouteTaskTime(step, 15)}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-950"
                      aria-label={`Move ${step.title} fifteen minutes later`}
                    >
                      +15 min
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-bold text-slate-600">
                    Locked
                  </p>
                )}
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
