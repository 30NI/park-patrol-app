"use client";

import { useRef, useState } from "react";
import {
  generateShiftReportPdf,
  generateWeeklyLightReportPdf,
} from "@/lib/reportPdf";
import type { ActivityLogEntry } from "@/types/activity";
import { usePatrol } from "../context/PatrolContext";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});

const compactTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const lightFields = [
  { sport: "Soccer", label: "CP1", facilityPattern: /CP - Soccer #1/i },
  { sport: "Soccer", label: "CP2", facilityPattern: /CP - Soccer #2/i },
  { sport: "Soccer", label: "HBP", facilityPattern: /HBP - Soccer Field/i },
  { sport: "Baseball", label: "CP1", facilityPattern: /CP - Diamond #1/i },
  { sport: "Baseball", label: "CP2", facilityPattern: /CP - Diamond #2/i },
  { sport: "Baseball", label: "CP3", facilityPattern: /CP - Diamond #3/i },
  { sport: "Baseball", label: "HB1", facilityPattern: /HBP - Diamond #1/i },
];
type LightField = (typeof lightFields)[number];
type LightLog = {
  sport: string;
  label: string;
  on: string;
  off: string;
};
type WeeklyLightRow = {
  sport: string;
  label: string;
  days: { on: string; off: string }[];
};
function CameraIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-14 w-14">
      <rect
        x="9"
        y="18"
        width="46"
        height="34"
        rx="8"
        fill="#eef6ff"
        stroke="#020617"
        strokeWidth="4"
      />
      <path
        d="M23 18l4-7h10l4 7"
        fill="#c8d7ee"
        stroke="#020617"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="35" r="10" fill="#93c5fd" stroke="#020617" strokeWidth="4" />
      <circle cx="48" cy="26" r="3" fill="#020617" />
    </svg>
  );
}

async function compressReportPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare photo.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.78);
}

function formatShiftDate(shiftDate: string) {
  return dateFormatter.format(new Date(`${shiftDate}T12:00:00`));
}

const shortDateFormatter = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
});

const weeklyHeaderDateFormatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(12, 0, 0, 0);

  return weekStart;
}

function getReportDateRange(shiftDate: string) {
  const start = getWeekStart(new Date(`${shiftDate}T12:00:00`));
  const end = new Date(start);

  end.setDate(start.getDate() + 6);

  return {
    start,
    end,
    days: Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    }),
  };
}

function getEntryDateKey(entry: ActivityLogEntry) {
  return new Date(entry.timestamp).toLocaleDateString("en-CA");
}

function getLightField(entry: ActivityLogEntry): LightField | null {
  const text = `${entry.action} ${entry.notes ?? ""}`;

  return lightFields.find((field) => field.facilityPattern.test(text)) ?? null;
}

function getLightTime(entry: ActivityLogEntry) {
  return timeFormatter.format(new Date(entry.timestamp)).replace(/\s/g, " ");
}

function getCompactLightTime(entry: ActivityLogEntry) {
  return compactTimeFormatter
    .format(new Date(entry.timestamp))
    .replace(/\s/g, "")
    .replace(/a\.?m\.?|p\.?m\.?/i, "");
}

function buildLightLogs(entries: ActivityLogEntry[]) {
  const logs = lightFields.map<LightLog>((field) => ({
    sport: field.sport,
    label: field.label,
    on: "",
    off: "",
  }));

  entries
    .filter((entry) => entry.category === "lights")
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .forEach((entry) => {
      const field = getLightField(entry);

      if (!field) {
        return;
      }

      const log = logs.find(
        (item) => item.sport === field.sport && item.label === field.label,
      );

      if (!log) {
        return;
      }

      if (/turned on/i.test(entry.action)) {
        log.on = getLightTime(entry);
      }

      if (/turned off/i.test(entry.action)) {
        log.off = getLightTime(entry);
      }
    });

  return logs;
}

function buildWeeklyLightRows(entries: ActivityLogEntry[], days: Date[]) {
  const dayKeys = days.map((day) => day.toLocaleDateString("en-CA"));
  const rows = lightFields.map<WeeklyLightRow>((field) => ({
    sport: field.sport,
    label: field.label,
    days: dayKeys.map(() => ({ on: "", off: "" })),
  }));

  entries
    .filter((entry) => entry.category === "lights")
    .forEach((entry) => {
      const field = getLightField(entry);
      const dayIndex = dayKeys.indexOf(getEntryDateKey(entry));

      if (!field || dayIndex === -1) {
        return;
      }

      const row = rows.find(
        (item) => item.sport === field.sport && item.label === field.label,
      );

      if (!row) {
        return;
      }

      if (/turned on/i.test(entry.action)) {
        row.days[dayIndex].on = getCompactLightTime(entry);
      }

      if (/turned off/i.test(entry.action)) {
        row.days[dayIndex].off = getCompactLightTime(entry);
      }
    });

  return rows;
}

export default function ActivityPage() {
  const {
    activeShiftDate,
    activityLog,
    addActivity,
    addReportPhoto,
    addReportNote,
    clearLocalData,
    markShiftReportGenerated,
    reportPhotos,
    reportNotes,
    shiftHistory,
    workerName,
    workerSignature,
  } = usePatrol();
  const [noteDraft, setNoteDraft] = useState("");
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  function generateLightReport() {
    const { start, end, days } = getReportDateRange(activeShiftDate);
    const startTime = new Date(start);
    const endTime = new Date(end);

    startTime.setHours(0, 0, 0, 0);
    endTime.setHours(23, 59, 59, 999);

    const lightEntries = Object.values(shiftHistory)
      .flatMap((shift) => shift.activityLog)
      .filter(
        (entry) => {
          const entryTime = new Date(entry.timestamp).getTime();

          return (
            entry.category === "lights" &&
            entryTime >= startTime.getTime() &&
            entryTime <= endTime.getTime()
          );
        },
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    generateWeeklyLightReportPdf({
      rangeLabel: `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(end)}`,
      dayLabels: days.map((day) =>
        weeklyHeaderDateFormatter.format(day).replace(", ", "\n"),
      ),
      weeklyRows: buildWeeklyLightRows(lightEntries, days),
    });
    addActivity({
      category: "report",
      action: "Light usage report generated",
    });
  }

  function generateShiftReport() {
    markShiftReportGenerated();
    addActivity({
      category: "report",
      action: "Shift report generated",
    });
    generateShiftReportPdf({
      shiftDateLabel: formatShiftDate(activeShiftDate),
      workerName,
      workerSignature,
      lightLogs: buildLightLogs(activityLog),
      activityEntries: activityLog,
      notes: reportNotes,
      photos: reportPhotos,
    });
  }

  function saveNote() {
    addReportNote(noteDraft);
    setNoteDraft("");
    setIsNoteOpen(false);
  }

  async function handlePhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    try {
      const dataUrl = await compressReportPhoto(file);

      addReportPhoto(dataUrl);
    } catch {
      window.alert("That photo could not be saved. Try taking it again.");
    } finally {
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2 text-center no-print">
        <h1 className="display-title text-4xl font-black">Log</h1>
      </header>

      <section className="grid gap-3 no-print">
        <button
          type="button"
          onClick={() => setIsNoteOpen(true)}
          className="flex min-h-32 items-center gap-4 rounded-2xl border-4 border-white bg-[#f5b971] p-4 text-left shadow-sm transition active:scale-[0.99]"
        >
          <span className="text-5xl" aria-hidden="true">
            📝
          </span>
          <span className="text-xl font-black text-slate-950">Leave Note</span>
        </button>
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="flex min-h-32 items-center gap-4 rounded-2xl border-4 border-white bg-[#a7d8f0] p-4 text-left shadow-sm transition active:scale-[0.99]"
        >
          <CameraIcon />
          <span className="text-xl font-black text-slate-950">Take Photo</span>
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => handlePhotoSelected(event.target.files)}
        />
        <button
          type="button"
          onClick={generateShiftReport}
          className="flex min-h-32 items-center gap-4 rounded-2xl border-4 border-white bg-[#c8d7ee] p-4 text-left shadow-sm transition active:scale-[0.99]"
        >
          <span className="text-5xl" aria-hidden="true">
            🖨️
          </span>
          <span className="text-xl font-black text-slate-950">
            Generate Shift Report
          </span>
        </button>
        <button
          type="button"
          onClick={generateLightReport}
          className="flex min-h-32 items-center gap-4 rounded-2xl border-4 border-white bg-[#facc15] p-4 text-left shadow-sm transition active:scale-[0.99]"
        >
          <span className="text-5xl" aria-hidden="true">
            💡
          </span>
          <span className="text-xl font-black text-slate-950">
            Generate Light Report
          </span>
        </button>
      </section>

      {isNoteOpen ? (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 p-4 no-print">
          <section className="mx-auto w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-xl font-bold">Leave Note</h2>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              className="mt-4 min-h-36 w-full rounded-lg border border-slate-300 p-3 text-base outline-none focus:border-slate-950"
              placeholder="Enter notes..."
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsNoteOpen(false)}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNote}
                className="min-h-12 rounded-lg bg-slate-950 px-4 font-bold text-white"
              >
                Save Note
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Clear all local Park Patrol data on this device?")) {
            clearLocalData();
          }
        }}
        className="mt-8 min-h-14 w-full rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 shadow-sm no-print"
      >
        Clear Local Test Data
      </button>
    </main>
  );
}
