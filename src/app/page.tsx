"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { parks, type ParkName } from "@/constants/parks";
import { getLightTasks } from "@/lib/lights";
import { buildShiftTimeline } from "@/lib/shiftPlanner";
import { minutesToTime, timeToMinutes } from "@/lib/time";
import type { CustomRouteTask } from "./context/PatrolContext";
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
const routeSlotMinutes = 5;

function WashroomIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-12 w-12">
      <path
        d="M12 4v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="5" r="1.8" fill="currentColor" />
      <path
        d="M4.8 9.2h4.4l.8 6H8.4V20H5.6v-4.8H4z"
        fill="currentColor"
      />
      <circle cx="17" cy="5" r="1.8" fill="currentColor" />
      <path
        d="M15.1 9.2h3.8l1.5 6h-2V20h-2.8v-4.8h-2z"
        fill="currentColor"
      />
    </svg>
  );
}

function GarbageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-12 w-12">
      <path
        d="M7.5 8.2h9l-.8 12H8.3zM6 8.2h12M9.5 8.2V5.5h5v2.7M9.8 11.2v6M12 11.2v6M14.2 11.2v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getTimedStatus(checkedAt: string | null) {
  if (!checkedAt) {
    return "Red";
  }

  const elapsedHours =
    (Date.now() - new Date(checkedAt).getTime()) / (1000 * 60 * 60);

  if (elapsedHours < 2) {
    return "Green";
  }

  if (elapsedHours < 4) {
    return "Yellow";
  }

  return "Red";
}

function getStatusDotClass(status: "Green" | "Yellow" | "Red") {
  if (status === "Green") {
    return "bg-green-500";
  }

  if (status === "Yellow") {
    return "bg-yellow-400";
  }

  return "bg-red-500";
}

function BaseballIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-8 w-8">
      <circle cx="24" cy="24" r="21" fill="#ffffff" stroke="#020617" strokeWidth="3" />
      <path
        d="M15 8c4 5 6 10 6 16s-2 11-6 16M33 8c-4 5-6 10-6 16s2 11 6 16"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16.5 14l3 1.8M18.5 20l3.2 1M18.5 28l3.2-1M16.5 34l3-1.8M31.5 14l-3 1.8M29.5 20l-3.2 1M29.5 28l-3.2-1M31.5 34l-3-1.8"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getShiftWindow(date: Date) {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  const startHour = isWeekend ? 14 : 15;
  const endHour = isWeekend ? 22 : 23;

  return {
    startHour,
    endHour,
    label: isWeekend ? "2 PM - 10 PM" : "3 PM - 11 PM",
    startMinutes: startHour * 60,
    endMinutes: endHour * 60,
  };
}

function getShiftProgress(date: Date) {
  const shiftWindow = getShiftWindow(date);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const elapsedMinutes = currentMinutes - shiftWindow.startMinutes;
  const totalMinutes = shiftWindow.endMinutes - shiftWindow.startMinutes;
  const percent = Math.max(
    0,
    Math.min(100, (elapsedMinutes / totalMinutes) * 100),
  );

  return {
    ...shiftWindow,
    percent,
  };
}

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

function buildCustomTimelineTasks(customRouteTasks: CustomRouteTask[]) {
  return customRouteTasks.map<ShiftTimelineTask>((task) => ({
    id: task.id,
    time: task.time,
    sortOrder: timeToMinutes(task.time),
    category: "custom",
    title: task.title,
    detail: "Added task",
    href: "/",
    targetId: task.id,
  }));
}

function resolveMovedRouteTimes(
  orderedTasks: ShiftTimelineTask[],
  firstChangedIndex: number,
) {
  const nextTimes: Record<string, string> = {};
  const usedTimes = new Set<string>();

  orderedTasks.forEach((task, index) => {
    let taskMinutes = timeToMinutes(task.time);

    if (index >= firstChangedIndex && index > 0) {
      const previousTask = orderedTasks[index - 1];
      const previousTime = nextTimes[previousTask.id] ?? previousTask.time;
      const earliestMinutes = timeToMinutes(previousTime) + routeSlotMinutes;

      if (taskMinutes < earliestMinutes) {
        taskMinutes = earliestMinutes;
      }
    }

    let nextTime = minutesToTime(taskMinutes);

    while (usedTimes.has(nextTime)) {
      taskMinutes += routeSlotMinutes;
      nextTime = minutesToTime(taskMinutes);
    }

    usedTimes.add(nextTime);
    nextTimes[task.id] = nextTime;
  });

  return nextTimes;
}

export default function Home() {
  const {
    addCustomRouteTask,
    completeCustomRouteTask,
    deleteCustomRouteTask,
    rentals,
    customRouteTasks,
    washroomCheckedAt,
    garbageCheckedAt,
    endShift,
    lightTaskStates,
    routeTaskOrder,
    routeTaskHiddenIds,
    routeTaskTimes,
    hideRouteTask,
    setRouteTaskOrder,
    setRouteTaskTime,
    shiftEndedAt,
    shiftStartedAt,
    startShift,
    workerName,
  } = usePatrol();
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [isRouteMenuOpen, setIsRouteMenuOpen] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [starterName, setStarterName] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shiftProgress = getShiftProgress(currentTime);
  const lightTasks = getLightTasks(rentals);
  const washroomChecksDone = dashboardWashroomParks.every(
    (park) => washroomCheckedAt[park] !== null,
  );
  const garbageChecksDone = parks.every(
    (park) =>
      garbageCheckedAt[park].litter !== null &&
      garbageCheckedAt[park].garbageCans !== null,
  );
  const washroomStatus = dashboardWashroomParks.reduce<
    "Green" | "Yellow" | "Red"
  >((status, park) => {
    const parkStatus = getTimedStatus(washroomCheckedAt[park]);

    if (parkStatus === "Red" || status === "Red") {
      return "Red";
    }

    if (parkStatus === "Yellow" || status === "Yellow") {
      return "Yellow";
    }

    return "Green";
  }, "Green");
  const garbageStatus = parks.reduce<"Green" | "Yellow" | "Red">(
    (status, park) => {
      const litterStatus = getTimedStatus(garbageCheckedAt[park].litter);
      const cansStatus = getTimedStatus(garbageCheckedAt[park].garbageCans);

      if (litterStatus === "Red" || cansStatus === "Red" || status === "Red") {
        return "Red";
      }

      if (
        litterStatus === "Yellow" ||
        cansStatus === "Yellow" ||
        status === "Yellow"
      ) {
        return "Yellow";
      }

      return "Green";
    },
    "Green",
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
  const automaticRouteTimeline = useMemo(
    () =>
      automaticTimeline.filter(
        (task) => task.category !== "washroom" && task.category !== "garbage",
      ),
    [automaticTimeline],
  );
  const customTimeline = useMemo(
    () => buildCustomTimelineTasks(customRouteTasks),
    [customRouteTasks],
  );
  const timeline = useMemo(
    () =>
      applyRouteEdits(
        [...automaticRouteTimeline, ...customTimeline].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ).filter((task) => !routeTaskHiddenIds.includes(task.id)),
        routeTaskOrder,
        routeTaskTimes,
      ),
    [
      automaticRouteTimeline,
      customTimeline,
      routeTaskHiddenIds,
      routeTaskOrder,
      routeTaskTimes,
    ],
  );
  const nextTasks = timeline.filter((task) => !isTimelineTaskDone(task));
  const completedTasks: ShiftTimelineTask[] = [
    ...(washroomChecksDone
      ? [
          {
            id: "completed-washrooms",
            time: "",
            sortOrder: 0,
            category: "washroom" as const,
            title: "Washrooms",
            detail: "All washroom checks completed",
            href: "/washrooms",
          },
        ]
      : []),
    ...(garbageChecksDone
      ? [
          {
            id: "completed-garbage",
            time: "",
            sortOrder: 0,
            category: "garbage" as const,
            title: "Garbage",
            detail: "All garbage checks completed",
            href: "/garbage",
          },
        ]
      : []),
    ...timeline.filter((task) => isTimelineTaskDone(task)),
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

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

    if (task.category === "custom") {
      return customRouteTasks.some(
        (customTask) => customTask.id === task.id && customTask.completedAt,
      );
    }

    return false;
  }

  function moveRouteTask(taskId: string, direction: -1 | 1) {
    const currentTasks = nextTasks;
    const currentOrder = currentTasks.map((task) => task.id);
    const currentIndex = currentTasks.findIndex((task) => task.id === taskId);
    const nextIndex = currentIndex + direction;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= currentOrder.length) {
      return;
    }

    const nextOrderedTasks = [...currentTasks];
    const [movedTask] = nextOrderedTasks.splice(currentIndex, 1);

    nextOrderedTasks.splice(nextIndex, 0, movedTask);
    const nextOrder = nextOrderedTasks.map((task) => task.id);
    const firstChangedIndex = Math.min(currentIndex, nextIndex);
    const nextTimes = resolveMovedRouteTimes(nextOrderedTasks, firstChangedIndex);

    setRouteTaskOrder(nextOrder);
    nextOrderedTasks.slice(firstChangedIndex).forEach((task) => {
      setRouteTaskTime(task.id, nextTimes[task.id]);
    });
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

  function addRouteTask() {
    setIsRouteMenuOpen(false);
    const title = window.prompt("Task title");

    if (title === null) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      window.alert("Enter a task title.");
      return;
    }

    const time = window.prompt("Task time", "6:15 PM");

    if (time === null) {
      return;
    }

    const normalizedTime = normalizeTimelineTime(time.trim());

    if (!normalizedTime) {
      window.alert("Use a time like 6:15 PM.");
      return;
    }

    if (timeline.some((task) => task.time === normalizedTime)) {
      window.alert("Another task already has that time.");
      return;
    }

    addCustomRouteTask(normalizedTime, trimmedTitle);
  }

  function toggleRouteEditing() {
    setIsRouteMenuOpen(false);
    setIsEditingRoute((current) => !current);
  }

  function deleteRouteTask(task: ShiftTimelineTask) {
    if (!window.confirm(`Delete "${task.title}" from the dashboard route?`)) {
      return;
    }

    if (task.category === "custom") {
      deleteCustomRouteTask(task.id);
      return;
    }

    hideRouteTask(task.id);
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
      <header className="flex items-end justify-between gap-3 pt-5">
        <div className="min-w-0 text-left">
          <p className="meta-text uppercase text-slate-600">
            {formatter.format(new Date())}
          </p>
          <h1 className="display-title mt-1 text-3xl font-extrabold leading-tight">
            Hello {workerName || "_____"}
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/washrooms"
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#0b1f4d] bg-[#2563eb] text-white shadow-sm transition active:scale-[0.98]"
            aria-label="Washrooms"
          >
            <WashroomIcon />
            <span
              className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white ${getStatusDotClass(
                washroomStatus,
              )}`}
            />
          </Link>
          <Link
            href="/garbage"
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-slate-950 bg-slate-300 text-slate-950 shadow-sm transition active:scale-[0.98]"
            aria-label="Garbage"
          >
            <GarbageIcon />
            <span
              className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white ${getStatusDotClass(
                garbageStatus,
              )}`}
            />
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border-[4px] border-white bg-white/70 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-950">Shift Progress</p>
          <p className="meta-text text-slate-600">
            {shiftProgress.label}
          </p>
        </div>
        <div className="relative h-10">
          <div className="absolute left-0 right-0 top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-full border-2 border-slate-950 bg-white">
            <div
              className="h-full rounded-full bg-[#6fa85f]"
              style={{ width: `${shiftProgress.percent}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm"
            style={{ left: `${shiftProgress.percent}%` }}
          >
            <BaseballIcon />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-[#b9e4f7] p-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="page-title">Next Task</h2>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRouteMenuOpen((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-950 shadow-[0_1px_5px_rgba(15,23,42,0.18)]"
              aria-label="Open route options"
            >
              ...
            </button>
            {isRouteMenuOpen ? (
              <div className="absolute right-0 top-14 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={toggleRouteEditing}
                  className="block min-h-11 w-full px-4 text-left text-sm font-bold text-slate-950"
                >
                  {isEditingRoute ? "Done Editing" : "Edit Route"}
                </button>
                <button
                  type="button"
                  onClick={addRouteTask}
                  className="block min-h-11 w-full border-t border-slate-200 px-4 text-left text-sm font-bold text-slate-950"
                >
                  Add Task
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {nextTasks.length === 0 ? (
            <div className="rounded-2xl border-[4px] border-white bg-white/75 p-5 text-center shadow-sm">
              <p className="text-lg font-bold text-slate-950">
                No upcoming tasks
              </p>
            </div>
          ) : null}
          {nextTasks.map((step, index) => {
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
                      onClick={() => deleteRouteTask(step)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-2xl font-bold leading-none text-red-600"
                      aria-label={`Delete ${step.title}`}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRouteTask(step.id, -1)}
                      disabled={index === 0}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-bold text-slate-950 disabled:opacity-35"
                      aria-label={`Move ${step.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRouteTask(step.id, 1)}
                      disabled={index === nextTasks.length - 1}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-bold text-slate-950 disabled:opacity-35"
                      aria-label={`Move ${step.title} down`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </article>
            ) : step.category === "custom" ? (
              <button
                key={step.id}
                type="button"
                onClick={() => completeCustomRouteTask(step.id)}
                className={`${cardClassName} w-full text-left`}
              >
                {cardContent}
              </button>
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
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShowCompletedTasks((current) => !current)}
            className="min-h-14 rounded-lg border-2 border-slate-950 bg-white px-4 text-sm font-bold text-slate-950 shadow-sm"
          >
            {showCompletedTasks ? "Hide Completed" : "View Completed"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("End this shift and save it in history?")) {
                endShift();
              }
            }}
            disabled={Boolean(shiftEndedAt)}
            className="min-h-14 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white shadow-sm disabled:bg-slate-300 disabled:text-slate-600"
          >
            {shiftEndedAt ? "Shift Ended" : "End Shift"}
          </button>
        </div>
        {showCompletedTasks ? (
          <section className="mt-3 space-y-2 rounded-2xl border-[4px] border-white bg-white/75 p-3 shadow-sm">
            <h3 className="text-lg font-bold">Completed</h3>
            {completedTasks.length === 0 ? (
              <p className="text-sm font-semibold text-slate-600">
                Nothing completed yet.
              </p>
            ) : (
              completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl bg-white p-3 shadow-sm"
                >
                  <p className="font-bold text-slate-950">
                    {task.time ? `${formatTimelineTime(task)} - ` : ""}
                    {task.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{task.detail}</p>
                </div>
              ))
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
