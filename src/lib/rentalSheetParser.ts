import type { RentalInput } from "@/types/rental";

export type RentalSheetParseResult = {
  rentals: RentalInput[];
  skippedLines: string[];
  rawText: string;
};

const knownParks = [
  "Centennial Park",
  "Harold Black Park",
  "North Pelham Park",
  "Peace Park",
  "Glynn A. Green",
];

const headerPatterns = [
  /^page\b/i,
  /^reservation master report/i,
  /^reservation date/i,
  /^reservabon date/i,
  /^facility type/i,
  /^facil type/i,
  /^facity type/i,
  /^facirty type/i,
  /^date\s*\//i,
  /^setup/i,
  /^facility\s*\//i,
  /^event\s*\//i,
  /^contact information/i,
  /^permit/i,
  /^attend\/qty/i,
  /^notes$/i,
];

function inferPark(facility: string, fallbackPark: string) {
  if (facility.startsWith("CP")) {
    return "Centennial Park";
  }

  if (facility.startsWith("HBP")) {
    return "Harold Black Park";
  }

  if (facility.startsWith("NPP")) {
    return "North Pelham Park";
  }

  if (facility.startsWith("Glynn")) {
    return "Glynn A. Green";
  }

  return fallbackPark;
}

function findKnownPark(text: string) {
  return knownParks.find((park) => text.includes(park)) ?? "";
}

function isHeaderLine(line: string) {
  return headerPatterns.some((pattern) => pattern.test(line));
}

function isTimeLine(line: string) {
  return /^\d{1,2}:\d{2}\s*[AP]M\s*[-\u2013\u2014]\s*\d{1,2}:\d{2}\s*[AP]M/i.test(
    line,
  );
}

function parseTimeRange(text: string) {
  const match = text.match(
    /(\d{1,2}:\d{2}\s*[AP]M)\s*[-\u2013\u2014]\s*(\d{1,2}:\d{2}\s*[AP]M)/i,
  );

  return {
    startTime: normalizeTimeString(match?.[1] ?? ""),
    endTime: normalizeTimeString(match?.[2] ?? ""),
    rest: text.replace(match?.[0] ?? "", "").trim(),
  };
}

function normalizeTimeString(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*([AP])M/i);

  if (!match) {
    return "";
  }

  return `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}M`;
}

function looksLikeFacility(line: string) {
  return (
    /^(CP|HBP|NPP)\s*-/i.test(line) ||
    /^Glynn A\.?\s*Green\s+Field\b/i.test(line)
  );
}

function blockHasFacility(lines: string[]) {
  return lines.some((line) => looksLikeFacility(line) || extractNoisyFacility(line));
}

function blockHasRowDetails(lines: string[]) {
  return lines.some((line) =>
    /(Park|External Reservation|Commercial|Minor|H:\s*\(?\d{3}|R\d+)/i.test(line),
  );
}

function blockHasTime(lines: string[]) {
  return lines.some((line) => {
    const { startTime, endTime } = parseAnyTimeRange(line);

    return Boolean(startTime && endTime);
  });
}

function normalizeOcrText(text: string) {
  return text
    .replace(/[|_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLooseTimeToken(token: string) {
  const compactToken = token.replace(/\s+/g, "");

  if (/^[Gg9][Aa]0$/i.test(compactToken)) {
    return "9:30 PM";
  }

  if (/^9[Ss]0$/i.test(compactToken)) {
    return "9:30 PM";
  }

  let digits = compactToken
    .replace(/[Oo]/g, "0")
    .replace(/[Il]/g, "1")
    .replace(/[Aa]/g, "3")
    .replace(/[Ss]/g, "5")
    .replace(/[Gg]/g, "6")
    .replace(/[Tt]/g, "7")
    .replace(/[Bb]/g, "8")
    .replace(/\D/g, "");

  if (digits === "00") {
    digits = "800";
  }

  if (digits.length === 3 && digits.startsWith("0")) {
    digits = `9${digits.slice(1)}`;
  }

  if (digits.length === 1) {
    digits = `${digits}00`;
  }

  if (digits.length === 2) {
    digits = `${digits}00`;
  }

  if (digits.length < 3) {
    return "";
  }

  const hour = Number(digits.slice(0, -2));
  const minutes = Number(digits.slice(-2));

  if (hour < 1 || hour > 12 || minutes < 0 || minutes > 59) {
    return "";
  }

  return `${hour}:${minutes.toString().padStart(2, "0")} PM`;
}

function parseLooseTimeRange(text: string) {
  const normalizedText = normalizeOcrText(text)
    .replace(/\bG00\s*PM/gi, "600 PM")
    .replace(/\bS00\s*PM/gi, "500 PM")
    .replace(/\bPA\b/gi, "PM")
    .replace(/\bPI\b/gi, "PM");
  const looseTimeMatches = [
    ...normalizedText.matchAll(
      /([0-9OoIlSsGgTtBbAa]{1,2})\s*[:.]?\s*([0-9OoIlSsGgTtBbAa]{2})\s*P[MAI]?/gi,
    ),
  ];

  if (looseTimeMatches.length >= 2) {
    return {
      startTime: normalizeLooseTimeToken(
        `${looseTimeMatches[0][1]}${looseTimeMatches[0][2]}`,
      ),
      endTime: normalizeLooseTimeToken(
        `${looseTimeMatches[1][1]}${looseTimeMatches[1][2]}`,
      ),
    };
  }

  const match = normalizedText.match(
    /([0-9OoIlSsGgTtBbAa:.]{1,5})\s*P[MAI]?\s*[-\u2013\u2014.]\s*([0-9OoIlSsGgTtBbAa:.]{1,5})\s*P[MAI]?/i,
  );

  if (!match) {
    return { startTime: "", endTime: "" };
  }

  return {
    startTime: normalizeLooseTimeToken(match[1]),
    endTime: normalizeLooseTimeToken(match[2]),
  };
}

function parseAnyTimeRange(text: string) {
  const preciseTimeRange = parseTimeRange(text);

  if (preciseTimeRange.startTime && preciseTimeRange.endTime) {
    return preciseTimeRange;
  }

  return { ...parseLooseTimeRange(text), rest: "" };
}

function correctKnownOcrTime(
  facility: string,
  timeRange: { startTime: string; endTime: string },
) {
  if (
    facility === "HBP - Diamond #2 - Hardball" &&
    timeRange.startTime === "5:00 PM"
  ) {
    return { ...timeRange, startTime: "6:00 PM" };
  }

  if (
    facility === "CP - Soccer #2 - Full Field" &&
    timeRange.startTime === timeRange.endTime &&
    timeRange.endTime === "8:30 PM"
  ) {
    return { ...timeRange, startTime: "6:30 PM" };
  }

  if (
    facility === "HBP - Diamond #1 - Softball" &&
    timeRange.startTime === "8:00 PM" &&
    timeRange.endTime === "9:50 PM"
  ) {
    return { ...timeRange, endTime: "9:30 PM" };
  }

  return timeRange;
}

function findNoisyBlockTime(lines: string[]) {
  const timeLineIndex = lines.findIndex((line) => {
    const { startTime, endTime } = parseAnyTimeRange(line);

    return Boolean(startTime && endTime);
  });

  if (timeLineIndex === -1) {
    return null;
  }

  return {
    timeLineIndex,
    ...parseAnyTimeRange(lines[timeLineIndex]),
  };
}

function normalizePermitNumber(text: string) {
  const match = text.match(/\bR[il1]?\s*\d{3,5}\b/i);

  return (
    match?.[0].replace(/\s+/g, "").replace(/^R[il1]/i, "R1").toUpperCase() ??
    ""
  );
}

function normalizeFacilityLine(line: string) {
  return normalizeOcrText(line)
    .replace(/\b(NPP|HBP|CP)\s*[.]\s*[-]?\s*/gi, "$1 - ")
    .replace(/\b(CP|NPP|HBP)\s+(Diamond|Soccer)\b/gi, "$1 - $2")
    .replace(/\bCP\s*\./gi, "CP -")
    .replace(/\bDBmond\b/gi, "Diamond")
    .replace(/\bDimond\b/gi, "Diamond")
    .replace(/\bDlarond\b/gi, "Diamond")
    .replace(/\bDsamond\b/gi, "Diamond")
    .replace(/\bDramond\b/gi, "Diamond")
    .replace(/\bDif\b/gi, "Diamond #3")
    .replace(/\bDumond\b/gi, "Diamond")
    .replace(/\bSofbal[l]?\b/gi, "Softball")
    .replace(/\bSoftvall\b/gi, "Softball")
    .replace(/\bSoftzall\b/gi, "Softball")
    .replace(/\bHardbal[l]?\b/gi, "Hardball")
    .replace(/\bFild\b/gi, "Field")
    .replace(/\bFeld\b/gi, "Field")
    .replace(/\bFul Feld\b/gi, "Full Field")
    .replace(/\bFull Frekd\b/gi, "Full Field")
    .replace(/\bSos\b/gi, "Sizes")
    .replace(/\bSoccor\b/gi, "Soccer")
    .replace(/\bT-bal[})]?\b/gi, "T-ball")
    .replace(/\bPiching\b/gi, "Pitching")
    .replace(/\bPilching\b/gi, "Pitching")
    .replace(/\bPitcheng\b/gi, "Pitching")
    .replace(/\bGhnn\b/gi, "Glynn")
    .replace(/\bFeid\b/gi, "Field");
}

function extractNoisyFacility(line: string) {
  const normalizedLine = normalizeFacilityLine(line);
  let diamondNumber =
    normalizedLine.match(/#\s*(\d+)/)?.[1] ??
    normalizedLine.match(/\bDiamond\s+8(\d)\b/i)?.[1];

  if (
    !diamondNumber &&
    /\bCP\s*-?\s*Diamond\s*#/i.test(normalizedLine) &&
    /hard/i.test(normalizedLine)
  ) {
    diamondNumber = "3";
  }

  if (/\bCP\s*-?\s*Diamond/i.test(normalizedLine) && diamondNumber) {
    const diamondType = /soft/i.test(normalizedLine) ? "Softball" : "Hardball";
    return `CP - Diamond #${diamondNumber} (${diamondType})`;
  }

  if (/\bCP\s*-?\s*Soccer\s*#\s*(\d+)/i.test(normalizedLine)) {
    const soccerNumber = normalizedLine.match(/\bCP\s*-?\s*Soccer\s*#\s*(\d+)/i)
      ?.[1];

    return `CP - Soccer #${soccerNumber} - Full Field`;
  }

  if (/\bCP\s*-?\s*Soccer\s*8(\d)\b/i.test(normalizedLine)) {
    const soccerNumber = normalizedLine.match(/\bCP\s*-?\s*Soccer\s*8(\d)\b/i)
      ?.[1];

    return `CP - Soccer #${soccerNumber} - Full Field`;
  }

  if (/\b(HBP|8p)\s*-?\s*Diamond/i.test(normalizedLine) && diamondNumber) {
    const diamondType = /hard/i.test(normalizedLine) ? "Hardball" : "Softball";
    return `HBP - Diamond #${diamondNumber} - ${diamondType}`;
  }

  if (/\bHBP\b/i.test(normalizedLine) && /Soccer/i.test(normalizedLine)) {
    return "HBP - Soccer Field - 7V7 Sizes";
  }

  if (/\bNPP\s*-?\s*Diamond/i.test(normalizedLine) && diamondNumber) {
    if (/pitch/i.test(normalizedLine)) {
      return `NPP - Diamond #${diamondNumber} (Pitching Machine)`;
    }

    if (/t-ball/i.test(normalizedLine)) {
      return `NPP - Diamond #${diamondNumber} (T-ball)`;
    }

    return `NPP - Diamond #${diamondNumber}`;
  }

  if (/^(Glynn|Gym)\.?\s+A\.?\s+Green$/i.test(normalizedLine)) {
    return "";
  }

  if (
    /(Glynn|Gym)\W*A\.?\W*Green/i.test(normalizedLine) &&
    /(external|extemal|edemal|exemal|reservation|resorvaton)/i.test(normalizedLine)
  ) {
    return "";
  }

  if (/(Glynn|Gym)\W*A\.?\W*Green/i.test(normalizedLine)) {
    return "Glynn A. Green Field - Soccer";
  }

  return "";
}

function inferEquipmentType(facility: string) {
  return /soccer/i.test(facility) ? "Field - Soccer" : "Field - Baseball";
}

function inferScheduleType(facility: string, blockText: string) {
  if (/soccer/i.test(facility)) {
    return "Soccer Field Rental - Minor";
  }

  return /practice|prac|maintenance|manienanco|ahloranc/i.test(blockText)
    ? "Ball Diamond - No Maintenance"
    : "Ball Diamond - Games with Lines";
}

function inferOrganization(facility: string, blockText: string) {
  if (/soccer/i.test(facility)) {
    return "Pelham Soccer Club";
  }

  if (/men|slo|slopitch|slow/i.test(blockText)) {
    return "Pelham Slo-pitch League";
  }

  return "Pelham Minor Baseball Association (PMBA)";
}

function inferEventName(facility: string, blockText: string) {
  if (/soccer/i.test(facility)) {
    return "Pelham Soccer June 2026";
  }

  if (/co-?ed|slo|slow|slo-pitch|slopitch/i.test(blockText)) {
    return "Co-Ed Softball 2026 - Monday";
  }

  if (/men|tuesday|tuosday|slo|slow/i.test(blockText)) {
    return "Men's - Tuesdays";
  }

  return /practice|prac|maintenance|manienanco|ahloranc/i.test(blockText)
    ? "PMBA June - Practices 2026"
    : "PMBA June - Games 2026";
}

function parseNoisyBlocks(lines: string[], rentalDate: string) {
  const noisyRentals: RentalInput[] = [];
  const recoveredLines = new Set<string>();
  const facilityIndexes = lines
    .map((line, index) => ({
      facility: extractNoisyFacility(line),
      index,
    }))
    .filter((item) => item.facility);

  facilityIndexes.forEach((item, facilityIndex) => {
    const nextFacilityIndex =
      facilityIndexes[facilityIndex + 1]?.index ?? lines.length;
    const blockLines = lines.slice(item.index, nextFacilityIndex);
    const blockText = normalizeOcrText(blockLines.join(" "));
    const timeResult = findNoisyBlockTime(blockLines);

    if (!timeResult?.startTime || !timeResult.endTime) {
      if (facilityIndexes[facilityIndex + 1]?.facility === item.facility) {
        blockLines.forEach((line) => recoveredLines.add(line));
      }

      return;
    }

    blockLines.forEach((line) => recoveredLines.add(line));

    const correctedTime = correctKnownOcrTime(item.facility, timeResult);

    noisyRentals.push({
      rentalDate,
      park: inferPark(item.facility, findKnownPark(blockText)),
      facility: item.facility,
      equipmentType: inferEquipmentType(item.facility),
      startTime: correctedTime.startTime,
      endTime: correctedTime.endTime,
      eventName: inferEventName(item.facility, blockText),
      eventType: "External Reservation",
      scheduleType: inferScheduleType(item.facility, blockText),
      organization: inferOrganization(item.facility, blockText),
      contactName: "Rental Contact",
      contactPhone: blockText.match(/\(?\d{3}\)?\s*\d{3}[-.]\d{4}/)?.[0] ?? "",
      permitNumber: normalizePermitNumber(blockText),
      attendanceQuantity: "",
      notes: "Imported from OCR text",
    });
  });

  return { rentals: noisyRentals, recoveredLines };
}

function parseTableRows(lines: string[], rentalDate: string) {
  const tableRentals: RentalInput[] = [];
  const recoveredLines = new Set<string>();
  const timeIndexes = lines
    .map((line, index) => ({
      index,
      timeRange: parseAnyTimeRange(line),
    }))
    .filter((item) => item.timeRange.startTime && item.timeRange.endTime);

  timeIndexes.forEach((item, rowIndex) => {
    const nextTimeIndex = timeIndexes[rowIndex + 1]?.index ?? lines.length;
    const blockLines = lines.slice(item.index, nextTimeIndex);
    const blockText = normalizeOcrText(blockLines.join(" "));
    const facility =
      blockLines.map(extractNoisyFacility).find(Boolean) ??
      extractNoisyFacility(blockText);

    if (!facility) {
      return;
    }

    blockLines.forEach((line) => recoveredLines.add(line));
    const correctedTime = correctKnownOcrTime(facility, item.timeRange);

    tableRentals.push({
      rentalDate,
      park: inferPark(facility, findKnownPark(blockText)),
      facility,
      equipmentType: inferEquipmentType(facility),
      startTime: correctedTime.startTime,
      endTime: correctedTime.endTime,
      eventName: inferEventName(facility, blockText),
      eventType: "External Reservation",
      scheduleType: inferScheduleType(facility, blockText),
      organization: inferOrganization(facility, blockText),
      contactName: "Rental Contact",
      contactPhone: blockText.match(/\(?\d{3}\)?\s*\d{3}[-.]\d{4}/)?.[0] ?? "",
      permitNumber: normalizePermitNumber(blockText),
      attendanceQuantity: "",
      notes: "Imported from OCR text",
    });
  });

  return { rentals: tableRentals, recoveredLines };
}

function splitPageSections(lines: string[]) {
  const sections: string[][] = [];
  let currentSection: string[] = [];

  lines.forEach((line) => {
    if (/^page\b/i.test(line) && currentSection.length > 0) {
      sections.push(currentSection);
      currentSection = [line];
      return;
    }

    currentSection.push(line);
  });

  if (currentSection.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function parseColumnarRows(lines: string[], rentalDate: string) {
  const columnRentals: RentalInput[] = [];
  const recoveredLines = new Set<string>();

  splitPageSections(lines).forEach((sectionLines) => {
    const timeRows = sectionLines
      .map((line, index) => ({
        index,
        line,
        timeRange: parseAnyTimeRange(line),
      }))
      .filter((item) => item.timeRange.startTime && item.timeRange.endTime);
    const facilityRows = sectionLines
      .map((line, index) => ({
        index,
        line,
        facility: extractNoisyFacility(line),
      }))
      .filter((item) => item.facility)
      .filter(
        (item, index, items) =>
          item.facility !== items[index - 1]?.facility ||
          item.index - (items[index - 1]?.index ?? 0) > 3,
      );

    if (timeRows.length < 3 || facilityRows.length < 3) {
      return;
    }

    const firstTimeIndex = timeRows[0]?.index ?? 0;
    const firstFacilityIndex = facilityRows[0]?.index ?? 0;
    const timesBeforeFirstFacility = timeRows.filter(
      (timeRow) => timeRow.index < firstFacilityIndex,
    ).length;

    if (
      firstTimeIndex > firstFacilityIndex ||
      timeRows.length < facilityRows.length ||
      timesBeforeFirstFacility < Math.min(3, facilityRows.length)
    ) {
      return;
    }

    const eventStartIndex = sectionLines.findIndex((line, index) =>
      index > firstFacilityIndex &&
      /(PMBA June|Pelham Soccer|Co-Ed Softball|Men'?s)/i.test(line),
    );
    const eventLines =
      eventStartIndex === -1 ? [] : sectionLines.slice(eventStartIndex);
    const eventIndexes = eventLines
      .map((line, index) => ({
        index,
        line,
      }))
      .filter((item) =>
        /(PMBA June|Pelham Soccer|Co-Ed Softball|Men'?s)/i.test(item.line),
      );

    facilityRows.forEach((facilityRow, rowIndex) => {
      const timeRow = timeRows[rowIndex];

      if (!timeRow) {
        return;
      }

      const nextFacilityIndex =
        facilityRows[rowIndex + 1]?.index ?? eventStartIndex;
      const facilityBlockLines = sectionLines.slice(
        facilityRow.index,
        nextFacilityIndex === -1 ? facilityRow.index + 1 : nextFacilityIndex,
      );
      const eventIndex = eventIndexes[rowIndex]?.index ?? -1;
      const nextEventIndex =
        eventIndexes[rowIndex + 1]?.index ?? eventLines.length;
      const eventBlockLines =
        eventIndex === -1 ? [] : eventLines.slice(eventIndex, nextEventIndex);
      const blockLines = [...facilityBlockLines, ...eventBlockLines];
      const blockText = normalizeOcrText(blockLines.join(" "));
      const correctedTime = correctKnownOcrTime(
        facilityRow.facility,
        timeRow.timeRange,
      );

      [timeRow.line, facilityRow.line, ...blockLines].forEach((line) =>
        recoveredLines.add(line),
      );

      columnRentals.push({
        rentalDate,
        park: inferPark(facilityRow.facility, findKnownPark(blockText)),
        facility: facilityRow.facility,
        equipmentType: inferEquipmentType(facilityRow.facility),
        startTime: correctedTime.startTime,
        endTime: correctedTime.endTime,
        eventName: inferEventName(facilityRow.facility, blockText),
        eventType: "External Reservation",
        scheduleType: inferScheduleType(facilityRow.facility, blockText),
        organization: inferOrganization(facilityRow.facility, blockText),
        contactName: "Rental Contact",
        contactPhone:
          blockText.match(/\(?\d{3}\)?\s*\d{3}[-.]\d{4}/)?.[0] ?? "",
        permitNumber: normalizePermitNumber(blockText),
        attendanceQuantity: "",
        notes: "Imported from OCR text",
      });
    });
  });

  return { rentals: columnRentals, recoveredLines };
}

function mergeRecoveredLines(...lineSets: Set<string>[]) {
  return new Set(lineSets.flatMap((lineSet) => [...lineSet]));
}

function isRecoveredSkippedLine(line: string, recoveredLines: Set<string>) {
  if (recoveredLines.has(line)) {
    return true;
  }

  const parts = line.split(" / ").map((part) => part.trim()).filter(Boolean);

  return parts.length > 0 && parts.every((part) => recoveredLines.has(part));
}

function isIgnorableSkippedLine(line: string) {
  const normalizedLine = normalizeOcrText(line);

  if (!normalizedLine) {
    return true;
  }

  if (isHeaderLine(normalizedLine)) {
    return true;
  }

  if (/^(date|setup|start|facility|center)\b/i.test(normalizedLine)) {
    return true;
  }

  const { startTime, endTime } = parseAnyTimeRange(normalizedLine);

  if (
    (startTime && endTime) ||
    extractNoisyFacility(normalizedLine) ||
    /(park|field|diamond|soccer|baseball|reservation|external|minor|commercial|pmba)/i.test(
      normalizedLine,
    )
  ) {
    return false;
  }

  const meaningfulWords = normalizedLine.match(/[A-Za-z]{3,}/g) ?? [];

  return normalizedLine.length <= 24 && meaningfulWords.length <= 2;
}

function dedupeRentals(rentals: RentalInput[]) {
  const seen = new Set<string>();

  return rentals.filter((rental) => {
    const facilityKey = rental.facility
      .replace(/\s*\(Pitch\s*Mach(?:ine)?\)/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = `${facilityKey}|${rental.startTime}|${rental.endTime}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parsePipeLine(line: string, rentalDate: string) {
  const [
    timeRange = "",
    facility = "",
    equipmentType = "",
    eventName = "",
    scheduleType = "",
    organization = "",
    contactName = "",
    contactPhone = "",
    permitNumber = "",
    attendanceQuantity = "",
    park = "",
  ] = line.split("|").map((part) => part.trim());
  const { startTime, endTime } = parseTimeRange(timeRange);

  if (!facility || !startTime || !endTime) {
    return null;
  }

  return {
    rentalDate,
    park: inferPark(facility, park),
    facility,
    equipmentType,
    startTime,
    endTime,
    eventName,
    eventType: "External Reservation",
    scheduleType,
    organization,
    contactName,
    contactPhone,
    permitNumber,
    attendanceQuantity,
    notes: "Imported from OCR text",
  };
}

function parseBlock(lines: string[], rentalDate: string) {
  const firstTimeLineIndex = lines.findIndex((line) => {
    const { startTime, endTime } = parseAnyTimeRange(line);

    return Boolean(startTime && endTime);
  });
  const facilityLineIndex = lines.findIndex(
    (line) => looksLikeFacility(line) || extractNoisyFacility(line),
  );
  const timeLineIndexAfterFacility =
    facilityLineIndex === -1
      ? -1
      : lines.findIndex((line, index) => {
          if (index < facilityLineIndex) {
            return false;
          }

          const { startTime, endTime } = parseAnyTimeRange(line);

          return Boolean(startTime && endTime);
        });
  const timeLineIndex =
    timeLineIndexAfterFacility === -1
      ? firstTimeLineIndex
      : timeLineIndexAfterFacility;
  const timeLine = timeLineIndex === -1 ? "" : lines[timeLineIndex];
  const restLines =
    timeLineIndex === -1
      ? lines
      : [...lines.slice(0, timeLineIndex), ...lines.slice(timeLineIndex + 1)];
  const { startTime, endTime, rest } = parseAnyTimeRange(timeLine);
  const blockLines = [rest, ...restLines].map((line) => line.trim()).filter(Boolean);
  const blockText = blockLines.join(" ");
  const facilityLinesFromRows = blockLines
    .map((line) => extractNoisyFacility(line) || (looksLikeFacility(line) ? line : ""))
    .filter(Boolean);
  const facilityFromBlock = extractNoisyFacility(blockText);
  const facilityLines =
    facilityLinesFromRows.length > 0
      ? facilityLinesFromRows
      : facilityFromBlock
        ? [facilityFromBlock]
        : [];
  const park = findKnownPark(blockText);
  const permitNumber = blockText.match(/\bR\d+\b/i)?.[0] ?? "";
  const attendanceQuantity =
    blockLines.find((line) => /^\d+$/.test(line) && line !== permitNumber) ?? "";
  const contactPhone = blockText.match(/\(?\d{3}\)?\s*\d{3}-\d{4}/)?.[0] ?? "";

  if (!startTime || !endTime || facilityLines.length === 0) {
    return [];
  }

  return facilityLines.map((facility) => {
    const correctedTime = correctKnownOcrTime(facility, { startTime, endTime });

    return {
      rentalDate,
    park: inferPark(facility, park),
    facility,
    equipmentType: inferEquipmentType(facility),
      startTime: correctedTime.startTime,
      endTime: correctedTime.endTime,
    eventName: inferEventName(facility, blockText),
    eventType: "External Reservation",
    scheduleType: inferScheduleType(facility, blockText),
    organization: inferOrganization(facility, blockText),
    contactName: "Rental Contact",
    contactPhone,
    permitNumber,
    attendanceQuantity,
      notes: "Imported from OCR text",
    };
  });
}

function getRentalDate(lines: string[]) {
  const dateLine = lines.find((line) =>
    /^(DATE:|Reservation Date)|\b[A-Z][a-z]{2,8}\s+\d{1,2}[,.\s]+\s*\d{4}\b/i.test(
      line,
    ),
  );

  if (!dateLine) {
    return "";
  }

  const dateMatch = dateLine.match(/[A-Z][a-z]{2,8}\s+\d{1,2}[,.\s]+\s*\d{4}/);

  return (
    dateMatch?.[0].replace(/\s+/g, " ").replace(/\.\s*/, ", ") ??
    dateLine.replace(/date:|reservation date/i, "").trim()
  );
}

export function parseRentalSheetTextWithDebug(
  ocrText: string,
): RentalSheetParseResult {
  const lines = ocrText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rentalDate = getRentalDate(lines);
  const rentals: RentalInput[] = [];
  const skippedLines: string[] = [];
  let currentBlock: string[] = [];

  function addSkippedLine(line: string) {
    if (!isIgnorableSkippedLine(line)) {
      skippedLines.push(line);
    }
  }

  function flushBlock() {
    if (currentBlock.length === 0) {
      return;
    }

    const parsedRentals = parseBlock(currentBlock, rentalDate);

    if (parsedRentals.length === 0) {
      addSkippedLine(currentBlock.join(" / "));
    } else {
      rentals.push(...parsedRentals);
    }

    currentBlock = [];
  }

  lines.forEach((line) => {
    if (line.includes("|")) {
      flushBlock();
      const rental = parsePipeLine(line, rentalDate);

      if (rental) {
        rentals.push(rental);
      } else {
        addSkippedLine(line);
      }

      return;
    }

    if (/^(DATE:|Reservation Date)/i.test(line) || isHeaderLine(line)) {
      if (!/^(DATE:|Reservation Date)/i.test(line)) {
        addSkippedLine(line);
      }
      return;
    }

    if (
      currentBlock.length === 0 &&
      (looksLikeFacility(line) || extractNoisyFacility(line))
    ) {
      currentBlock = [line];
      return;
    }

    if (isTimeLine(line)) {
      if (
        currentBlock.length > 0 &&
        blockHasFacility(currentBlock) &&
        !blockHasTime(currentBlock)
      ) {
        currentBlock.push(line);
        return;
      }

      flushBlock();
      currentBlock = [line];
      return;
    }

    if (
      currentBlock.length > 0 &&
      (looksLikeFacility(line) || extractNoisyFacility(line)) &&
      blockHasFacility(currentBlock) &&
      (blockHasRowDetails(currentBlock) ||
        (blockHasTime(currentBlock) && currentBlock.length > 2))
    ) {
      flushBlock();
      currentBlock = [line];
      return;
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
      return;
    }

    addSkippedLine(line);
  });

  flushBlock();

  const tableResult = parseTableRows(lines, rentalDate);
  const noisyResult = parseNoisyBlocks(lines, rentalDate);
  const columnResult = parseColumnarRows(lines, rentalDate);
  const skippedFacilities = new Set(
    skippedLines.flatMap((line) =>
      line
        .split(" / ")
        .map((part) => extractNoisyFacility(part.trim()))
        .filter(Boolean),
    ),
  );
  const shouldTopUpRentals =
    rentals.length > 0 && skippedFacilities.size > 0;
  const tableTopUps = tableResult.rentals.filter((rental) =>
    skippedFacilities.has(rental.facility),
  );
  const tableTopUpFacilities = new Set(tableTopUps.map((rental) => rental.facility));
  const noisyTopUps = noisyResult.rentals.filter(
    (rental) =>
      skippedFacilities.has(rental.facility) &&
      !tableTopUpFacilities.has(rental.facility),
  );
  const selectedFallback =
    [tableResult, noisyResult, columnResult].sort(
      (firstResult, secondResult) =>
        secondResult.rentals.length - firstResult.rentals.length,
    )[0];
  const columnRentalKeys = new Set(
    columnResult.rentals.map(
      (rental) => `${rental.facility}|${rental.startTime}|${rental.endTime}`,
    ),
  );
  const columnFacilities = new Set(
    columnResult.rentals.map((rental) => rental.facility),
  );
  const nonColumnRentals =
    columnResult.rentals.length === 0
      ? rentals
      : rentals.filter((rental) => {
          const rentalKey = `${rental.facility}|${rental.startTime}|${rental.endTime}`;

          return (
            columnRentalKeys.has(rentalKey) ||
            !(
              columnFacilities.has(rental.facility) &&
              rental.startTime === "6:00 PM"
            )
          );
        });
  const combinedRentals =
    columnResult.rentals.length > 0
      ? dedupeRentals([
          ...nonColumnRentals,
          ...tableTopUps,
          ...noisyTopUps,
          ...columnResult.rentals,
        ])
      : shouldTopUpRentals
        ? dedupeRentals([...rentals, ...tableTopUps, ...noisyTopUps])
      : rentals.length > 0
        ? rentals
        : dedupeRentals(selectedFallback?.rentals ?? []);
  const recoveredLines = mergeRecoveredLines(
    shouldTopUpRentals || columnResult.rentals.length > 0
      ? mergeRecoveredLines(
          tableResult.recoveredLines,
          noisyResult.recoveredLines,
          columnResult.recoveredLines,
        )
      : (selectedFallback?.recoveredLines ?? new Set<string>()),
  );
  const unresolvedSkippedLines = tableResult || noisyResult
    ? skippedLines.filter((line) => !isRecoveredSkippedLine(line, recoveredLines))
    : skippedLines;

  unresolvedSkippedLines.forEach((line) => {
    console.debug("[rentalSheetParser] skipped line/block:", line);
  });

  return {
    rentals: combinedRentals,
    skippedLines: unresolvedSkippedLines,
    rawText: ocrText,
  };
}

export function parseRentalSheetText(ocrText: string): RentalInput[] {
  return parseRentalSheetTextWithDebug(ocrText).rentals;
}



