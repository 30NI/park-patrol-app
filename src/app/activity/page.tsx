"use client";

import { useState } from "react";
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

const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000;
const lightFields = [
  { sport: "Soccer", label: "CP1", facilityPattern: /CP - Soccer #1/i },
  { sport: "Soccer", label: "CP2", facilityPattern: /CP - Soccer #2/i },
  { sport: "Soccer", label: "HBP", facilityPattern: /HBP - Soccer Field/i },
  { sport: "Baseball", label: "CP1", facilityPattern: /CP - Diamond #1/i },
  { sport: "Baseball", label: "CP2", facilityPattern: /CP - Diamond #2/i },
  { sport: "Baseball", label: "CP3", facilityPattern: /CP - Diamond #3/i },
  { sport: "Baseball", label: "HB1", facilityPattern: /HBP - Diamond #1/i },
];
type ReportType = "shift" | "lights";
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
type LightReportSnapshot = {
  rangeLabel: string;
  dayLabels: string[];
  weeklyRows: WeeklyLightRow[];
};

function printReport() {
  window.setTimeout(() => window.print(), 50);
}

function formatShiftDate(shiftDate: string) {
  return dateFormatter.format(new Date(`${shiftDate}T12:00:00`));
}

function formatActivityEntry(entry: ActivityLogEntry) {
  const parts = [
    timeFormatter.format(new Date(entry.timestamp)),
    entry.park ?? "General",
    entry.category,
    entry.action,
  ];

  if (entry.notes) {
    parts.push(entry.notes);
  }

  return parts.join(" | ");
}

const shortDateFormatter = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
});

function getReportDateRange(start: Date) {
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
        row.days[dayIndex].on = getLightTime(entry);
      }

      if (/turned off/i.test(entry.action)) {
        row.days[dayIndex].off = getLightTime(entry);
      }
    });

  return rows;
}

export default function ActivityPage() {
  const {
    activeShiftDate,
    activityLog,
    addActivity,
    addReportNote,
    clearLocalData,
    markShiftReportGenerated,
    reportNotes,
    shiftHistory,
    workerName,
    workerSignature,
  } = usePatrol();
  const [noteDraft, setNoteDraft] = useState("");
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [lightReportSnapshot, setLightReportSnapshot] =
    useState<LightReportSnapshot | null>(null);

  function generateLightReport() {
    const reportStart = new Date();
    const { start, end, days } = getReportDateRange(reportStart);
    const oldestIncludedTime = reportStart.getTime() - sevenDaysInMilliseconds;
    const lightEntries = Object.values(shiftHistory)
      .flatMap((shift) => shift.activityLog)
      .filter(
        (entry) =>
          entry.category === "lights" &&
          new Date(entry.timestamp).getTime() >= oldestIncludedTime,
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    setLightReportSnapshot({
      rangeLabel: `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(end)}`,
      dayLabels: days.map((day) => shortDateFormatter.format(day)),
      weeklyRows: buildWeeklyLightRows(lightEntries, days),
    });
    setReportType("lights");
    addActivity({
      category: "report",
      action: "Light usage report generated",
    });
    printReport();
  }

  function generateShiftReport() {
    setReportType("shift");
    markShiftReportGenerated();
    addActivity({
      category: "report",
      action: "Shift report generated",
    });
    printReport();
  }

  function saveNote() {
    addReportNote(noteDraft);
    setNoteDraft("");
    setIsNoteOpen(false);
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2 no-print">
        <h1 className="text-3xl font-bold">Log</h1>
      </header>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm no-print">
        <button
          type="button"
          onClick={generateLightReport}
          className="min-h-16 rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
        >
          Generate Light Report
        </button>
        <button
          type="button"
          onClick={generateShiftReport}
          className="min-h-16 rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
        >
          Generate Shift Report
        </button>
        <button
          type="button"
          onClick={() => setIsNoteOpen(true)}
          className="min-h-16 rounded-lg border border-slate-300 bg-white px-4 text-base font-bold text-slate-950 shadow-sm transition active:scale-[0.99]"
        >
          Leave Note
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Clear all local Park Patrol data on this device?")) {
              clearLocalData();
            }
          }}
          className="min-h-14 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 shadow-sm"
        >
          Clear Local Test Data
        </button>
      </section>

      {reportType ? (
        <section
          className={`printable-report hidden bg-white text-slate-950 ${
            reportType === "lights" ? "light-report" : ""
          }`}
        >
          {reportType === "shift" ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <p>Date: {formatShiftDate(activeShiftDate)}</p>
                <div className="flex items-center gap-3">
                  <p>Name / Signature: {workerName || "B"}</p>
                  {workerSignature ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={workerSignature}
                      alt=""
                      className="h-12 w-32 object-contain"
                    />
                  ) : null}
                </div>
              </div>

              <section>
                <h2 className="text-xl font-bold">Light Rentals</h2>
                <div className="mt-3 grid grid-cols-2 gap-6">
                  {["Soccer", "Baseball"].map((sport) => (
                    <div key={sport}>
                      <h3 className="font-bold">{sport}</h3>
                      <div className="mt-2 space-y-2">
                        {buildLightLogs(activityLog)
                          .filter((field) => field.sport === sport)
                          .map((field) => (
                            <div
                              key={`${field.sport}-${field.label}`}
                              className="grid grid-cols-[3rem_1fr] gap-2 text-sm"
                            >
                              <p className="font-bold">{field.label}</p>
                              <p>
                                {field.on || field.off
                                  ? `${field.on || "____"}-${field.off || "____"}`
                                  : ""}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold">Shift Timeline</h2>
                <div className="mt-3 space-y-1 text-sm">
                  {activityLog.filter(
                    (entry) =>
                      entry.category !== "lights" && entry.category !== "report",
                  ).length === 0 ? (
                    <p>No activity logged.</p>
                  ) : (
                    activityLog
                      .filter(
                        (entry) =>
                          entry.category !== "lights" &&
                          entry.category !== "report",
                      )
                      .slice()
                      .reverse()
                      .map((entry) => (
                        <p key={entry.id}>{formatActivityEntry(entry)}</p>
                      ))
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold">Notes</h2>
                <div className="mt-2 space-y-1 text-sm">
                  {reportNotes.length === 0 ? (
                    <p />
                  ) : (
                    reportNotes.map((note, index) => (
                      <p key={`${note}-${index}`}>{note}</p>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : lightReportSnapshot ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Park Patrol
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  Weekly Light Report
                </h2>
                <p className="mt-1">{lightReportSnapshot.rangeLabel}</p>
              </div>

              <table className="w-full table-fixed border-collapse text-[10px]">
                <thead>
                  <tr>
                    <th className="w-[12%] border border-slate-300 p-1 text-left align-middle">
                      Field
                    </th>
                    {lightReportSnapshot.dayLabels.map((dayLabel) => (
                      <th
                        key={dayLabel}
                        className="border border-slate-300 p-1 text-center align-middle"
                      >
                        {dayLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lightReportSnapshot.weeklyRows.map((row) => (
                    <tr key={`${row.sport}-${row.label}`}>
                      <td className="border border-slate-300 p-1 align-middle font-bold">
                        {row.sport} {row.label}
                      </td>
                      {row.days.map((day, index) => (
                        <td
                          key={`${row.label}-${lightReportSnapshot.dayLabels[index]}`}
                          className="h-9 overflow-hidden break-words border border-slate-300 p-1 text-center align-middle text-[10px] leading-tight"
                        >
                          {day.on ? `${day.on}-${day.off || ""}` : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

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
    </main>
  );
}
