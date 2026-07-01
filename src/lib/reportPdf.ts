import { jsPDF } from "jspdf";
import type { ActivityLogEntry } from "@/types/activity";

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

type ReportPhoto = {
  id: string;
  timestamp: string;
  dataUrl: string;
};

type ShiftReportPdfInput = {
  shiftDateLabel: string;
  workerName: string;
  workerSignature: string;
  lightLogs: LightLog[];
  activityEntries: ActivityLogEntry[];
  photos: ReportPhoto[];
};

type WeeklyLightReportPdfInput = {
  rangeLabel: string;
  dayLabels: string[];
  weeklyRows: WeeklyLightRow[];
};

type RgbColor = readonly [number, number, number];

const pageWidth = 612;
const marginX = 54;
const contentBottomY = 704;
const pelhamGreen: RgbColor = [0, 118, 73];
const pelhamOrange: RgbColor = [221, 112, 36];
const pelhamPurple: RgbColor = [91, 30, 82];
const pelhamRed: RgbColor = [172, 42, 55];
const textColor: RgbColor = [20, 24, 32];
const ruleColor: RgbColor = [184, 196, 210];
let cachedPelhamLogoDataUrl: string | null | undefined;

function createDocument() {
  return new jsPDF({
    unit: "pt",
    format: "letter",
    orientation: "portrait",
  });
}

function setText(doc: jsPDF, size: number, style: "normal" | "bold" = "normal") {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...textColor);
}

async function loadPelhamLogoDataUrl() {
  if (cachedPelhamLogoDataUrl !== undefined) {
    return cachedPelhamLogoDataUrl;
  }

  try {
    const response = await fetch("/pelham-logo.png");
    if (!response.ok) {
      throw new Error("Logo image unavailable");
    }

    const blob = await response.blob();
    cachedPelhamLogoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    cachedPelhamLogoDataUrl = null;
  }

  return cachedPelhamLogoDataUrl;
}

function drawPelhamMark(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...pelhamOrange);
  doc.circle(x + 16, y + 16, 16, "F");
  doc.setFillColor(...pelhamGreen);
  doc.triangle(x + 2, y + 20, x + 30, y + 12, x + 30, y + 27, "F");
  doc.setFillColor(...pelhamRed);
  doc.triangle(x + 5, y + 8, x + 22, y + 4, x + 30, y + 13, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(x + 16, y + 16, 5, "F");
}

function drawAccentDivider(doc: jsPDF, y: number) {
  const segmentWidth = (pageWidth - marginX * 2) / 5;
  const colors: RgbColor[] = [
    pelhamOrange,
    pelhamGreen,
    pelhamRed,
    [97, 151, 55],
    pelhamPurple,
  ];

  colors.forEach((color, index) => {
    doc.setFillColor(...color);
    doc.rect(marginX + segmentWidth * index, y, segmentWidth, 4, "F");
  });
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  if (cachedPelhamLogoDataUrl) {
    doc.addImage(cachedPelhamLogoDataUrl, "PNG", marginX, 24, 168, 50);
  } else {
    drawPelhamMark(doc, marginX, 32);
    setText(doc, 25, "bold");
    doc.text("Pelham", marginX + 38, 53);
    setText(doc, 7, "bold");
    doc.text("NIAGARA", marginX + 105, 65);
  }

  setText(doc, 14, "bold");
  doc.text(title, pageWidth - marginX, 45, { align: "right" });
  setText(doc, 10);
  doc.text(subtitle, pageWidth - marginX, 60, { align: "right" });
  drawAccentDivider(doc, 76);

  return 106;
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawAccentDivider(doc, 724);
    setText(doc, 8);
    doc.text(
      "20 Pelham Town Square | PO Box 400 | Fonthill, ON | L0S 1E0 | www.pelham.ca",
      pageWidth / 2,
      746,
      { align: "center" },
    );
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - marginX, 766, {
      align: "right",
    });
  }
}

function ensureSpace(doc: jsPDF, y: number, needed: number, title: string, subtitle: string) {
  if (y + needed <= contentBottomY) {
    return y;
  }

  doc.addPage();
  return drawHeader(doc, title, subtitle);
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  setText(doc, 13, "bold");
  doc.text(title, marginX, y);
  doc.setDrawColor(...ruleColor);
  doc.line(marginX, y + 8, pageWidth - marginX, y + 8);
  return y + 26;
}

function drawInfoBox(doc: jsPDF, rows: Array<[string, string]>, y: number) {
  const boxHeight = rows.length * 20 + 18;

  doc.setFillColor(246, 248, 251);
  doc.setDrawColor(...ruleColor);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, boxHeight, 4, 4, "FD");

  rows.forEach(([label, value], index) => {
    const rowY = y + 21 + index * 20;

    setText(doc, 8, "bold");
    doc.text(label.toUpperCase(), marginX + 14, rowY);
    setText(doc, 10);
    doc.text(value || "-", marginX + 130, rowY);
  });

  return y + boxHeight + 24;
}

function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  y: number,
  widths: number[],
  title: string,
  subtitle: string,
) {
  const rowHeight = 24;
  let cursorY = y;

  const drawHeaderRow = () => {
    let x = marginX;

    headers.forEach((header, index) => {
      doc.setFillColor(239, 244, 248);
      doc.setDrawColor(...ruleColor);
      doc.rect(x, cursorY, widths[index], rowHeight, "FD");
      const headerLines = doc.splitTextToSize(header, widths[index] - 10);
      setText(doc, 8, "bold");
      doc.text(headerLines.slice(0, 2), x + 5, cursorY + 10);
      x += widths[index];
    });
    cursorY += rowHeight;
  };

  cursorY = ensureSpace(doc, cursorY, rowHeight * 2, title, subtitle);
  drawHeaderRow();

  rows.forEach((row) => {
    cursorY = ensureSpace(doc, cursorY, rowHeight + 4, title, subtitle);

    if (cursorY === 106) {
      drawHeaderRow();
    }

    let x = marginX;

    row.forEach((cell, index) => {
      const lines = doc.splitTextToSize(cell || "-", widths[index] - 10);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...ruleColor);
      doc.rect(x, cursorY, widths[index], rowHeight, "FD");
      setText(doc, 8);
      doc.text(lines.slice(0, 2), x + 5, cursorY + 11);
      x += widths[index];
    });
    cursorY += rowHeight;
  });

  return cursorY + 24;
}

function addPhotos(doc: jsPDF, photos: ReportPhoto[], y: number, title: string, subtitle: string) {
  if (photos.length === 0) {
    return y;
  }

  let cursorY = sectionTitle(doc, "Attached Photos", y);

  photos.forEach((photo, index) => {
    cursorY = ensureSpace(doc, cursorY, 190, title, subtitle);
    doc.setDrawColor(...ruleColor);
    doc.roundedRect(marginX, cursorY, pageWidth - marginX * 2, 180, 4, 4, "S");
    try {
      doc.addImage(photo.dataUrl, "JPEG", marginX + 10, cursorY + 10, 180, 135);
    } catch {
      setText(doc, 9);
      doc.text("Photo could not be embedded.", marginX + 12, cursorY + 24);
    }
    setText(doc, 8, "bold");
    doc.text(`Photo ${index + 1}`, marginX + 205, cursorY + 26);
    setText(doc, 8);
    doc.text(new Date(photo.timestamp).toLocaleString("en-CA"), marginX + 205, cursorY + 42);
    cursorY += 194;
  });

  return cursorY;
}

function savePdf(doc: jsPDF, filename: string) {
  drawFooter(doc);
  doc.save(filename);
}

export async function generateShiftReportPdf(input: ShiftReportPdfInput) {
  await loadPelhamLogoDataUrl();
  const title = "Park Patrol Shift Report";
  const subtitle = "Facilities";
  const doc = createDocument();
  let y = drawHeader(doc, title, subtitle);

  y = sectionTitle(doc, "Shift Summary", y);
  y = drawInfoBox(
    doc,
    [
      ["Date", input.shiftDateLabel],
      ["Employee", input.workerName || "Not recorded"],
      ["Report Type", "Park Patrol daily shift report"],
    ],
    y,
  );

  if (input.workerSignature) {
    y = ensureSpace(doc, y, 70, title, subtitle);
    setText(doc, 9, "bold");
    doc.text("SIGNATURE", marginX, y);
    try {
      doc.addImage(input.workerSignature, "PNG", marginX + 88, y - 22, 120, 48);
    } catch {
      setText(doc, 9);
      doc.text("Signature recorded.", marginX + 88, y);
    }
    y += 44;
  }

  y = sectionTitle(doc, "Light Rentals", y);
  y = drawTable(
    doc,
    ["Sport", "Field", "On", "Off"],
    input.lightLogs.map((field) => [
      field.sport,
      field.label,
      field.on || "",
      field.off || "",
    ]),
    y,
    [130, 110, 115, 115],
    title,
    subtitle,
  );

  y = sectionTitle(doc, "Shift Timeline", y);
  const timelineRows = input.activityEntries
    .filter((entry) => entry.category !== "lights" && entry.category !== "report")
    .slice()
    .reverse()
    .map((entry) => [
      new Date(entry.timestamp).toLocaleTimeString("en-CA", {
        hour: "numeric",
        minute: "2-digit",
      }),
      entry.park ?? "General",
      entry.action,
    ]);

  y = drawTable(
    doc,
    ["Time", "Location", "Activity"],
    timelineRows.length > 0 ? timelineRows : [["", "", "No activity logged."]],
    y,
    [80, 150, 240],
    title,
    subtitle,
  );

  addPhotos(doc, input.photos, y, title, subtitle);

  savePdf(doc, `park-patrol-shift-report-${new Date().toLocaleDateString("en-CA")}.pdf`);
}

export async function generateWeeklyLightReportPdf(input: WeeklyLightReportPdfInput) {
  await loadPelhamLogoDataUrl();
  const title = "Park Patrol Weekly Light Report";
  const subtitle = "Facilities";
  const doc = createDocument();
  let y = drawHeader(doc, title, subtitle);

  y = sectionTitle(doc, "Report Summary", y);
  y = drawInfoBox(
    doc,
    [
      ["Reporting Period", input.rangeLabel],
      ["Prepared By", "Park Patrol"],
      ["Report Type", "Weekly light usage summary"],
    ],
    y,
  );

  y = sectionTitle(doc, "Weekly Light Usage", y);
  drawTable(
    doc,
    ["Field", ...input.dayLabels],
    input.weeklyRows.map((row) => [
      `${row.sport} ${row.label}`,
      ...row.days.map((day) => (day.on ? `${day.on}-${day.off || ""}` : "")),
    ]),
    y,
    [78, 56, 56, 56, 56, 56, 56, 56],
    title,
    subtitle,
  );

  savePdf(doc, `park-patrol-weekly-light-report-${input.rangeLabel.replace(/\s+/g, "-")}.pdf`);
}
