"use client";

import { useMemo, useState } from "react";
import type { ActivityCategory, ActivityLogEntry } from "@/types/activity";
import { usePatrol } from "../context/PatrolContext";

type FilterValue = "all" | Extract<
  ActivityCategory,
  "washroom" | "rental" | "lights" | "garbage"
>;

const filters: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Washrooms", value: "washroom" },
  { label: "Rentals", value: "rental" },
  { label: "Lights", value: "lights" },
  { label: "Garbage", value: "garbage" },
];

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

function printReport() {
  window.setTimeout(() => window.print(), 50);
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

export default function ActivityPage() {
  const { activityLog, addActivity } = usePatrol();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportLines, setReportLines] = useState<string[]>([]);

  const entries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return activityLog.filter((entry) => {
      const matchesFilter = filter === "all" || entry.category === filter;
      const searchableText = [
        entry.park,
        entry.category,
        entry.action,
        entry.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesFilter &&
        (!normalizedSearch || searchableText.includes(normalizedSearch))
      );
    });
  }, [activityLog, filter, search]);

  function generateLightReport() {
    const lightEntries = activityLog
      .filter((entry) => entry.category === "lights")
      .slice()
      .reverse();
    const lines = [
      `Date: ${dateFormatter.format(new Date())}`,
      "",
      "Light Activity",
    ];

    if (lightEntries.length === 0) {
      lines.push("No light activity logged this shift.");
    } else {
      lightEntries.forEach((entry) => lines.push(formatActivityEntry(entry)));
    }

    setReportTitle("Light Usage Report");
    setReportLines(lines);
    addActivity({
      category: "report",
      action: "Light usage report generated",
    });
    printReport();
  }

  function generateShiftReport() {
    const shiftEntries = activityLog
      .filter((entry) => entry.category !== "lights" && entry.category !== "report")
      .slice()
      .reverse();
    const lines = [
      `Date: ${dateFormatter.format(new Date())}`,
      "",
      "Shift Activity",
    ];

    if (shiftEntries.length === 0) {
      lines.push("No non-light activity logged this shift.");
    } else {
      shiftEntries.forEach((entry) => {
        lines.push(formatActivityEntry(entry));
      });
    }

    lines.push("");
    lines.push("Additional Notes");
    lines.push(notes.trim() || "None.");

    setReportTitle("Shift Report");
    setReportLines(lines);
    setIsNotesOpen(false);
    addActivity({
      category: "report",
      action: "Shift report generated",
    });
    printReport();
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2 no-print">
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <p className="mt-1 text-slate-600">Newest entries appear first.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm no-print">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search activity"
          className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-slate-950"
        />

        <div className="mt-3 grid grid-cols-5 gap-1">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`min-h-10 rounded-lg px-1 text-[11px] font-bold ${
                filter === item.value
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 no-print">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-bold">No activity found</p>
            <p className="mt-2 text-sm text-slate-600">
              Try a different filter or search.
            </p>
          </div>
        ) : null}

        {entries.map((entry) => (
          <article
            key={entry.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{entry.action}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {entry.park ?? "General"} - {entry.category}
                </p>
                {entry.notes ? (
                  <p className="mt-2 text-sm text-slate-700">{entry.notes}</p>
                ) : null}
              </div>
              <time className="shrink-0 text-sm font-bold text-slate-500">
                {timeFormatter.format(new Date(entry.timestamp))}
              </time>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-3 no-print">
        <button
          type="button"
          onClick={generateLightReport}
          className="min-h-16 rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
        >
          Generate Light Report
        </button>
        <button
          type="button"
          onClick={() => setIsNotesOpen(true)}
          className="min-h-16 rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
        >
          Generate Shift Report
        </button>
      </section>

      {reportLines.length > 0 ? (
        <section className="printable-report hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Park Patrol
            </p>
            <h2 className="mt-1 text-2xl font-bold">{reportTitle}</h2>
          </div>
          <div className="mt-4 space-y-1 text-sm leading-6 text-slate-800">
            {reportLines.map((line, index) =>
              line === "" ? (
                <div key={`${line}-${index}`} className="h-3" />
              ) : (
                <p key={`${line}-${index}`}>{line}</p>
              ),
            )}
          </div>
        </section>
      ) : null}

      {isNotesOpen ? (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 p-4 no-print">
          <section className="mx-auto w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-xl font-bold">Shift Notes</h2>
            <p className="mt-1 text-sm text-slate-600">
              Add anything else that should appear on the shift report.
            </p>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-4 min-h-36 w-full rounded-lg border border-slate-300 p-3 text-base outline-none focus:border-slate-950"
              placeholder="Enter notes..."
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsNotesOpen(false)}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generateShiftReport}
                className="min-h-12 rounded-lg bg-slate-950 px-4 font-bold text-white"
              >
                Generate PDF
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
