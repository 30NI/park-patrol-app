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
  /^facility type/i,
  /^date\s*\//i,
  /^setup/i,
  /^facility\s*\//i,
  /^event\s*\//i,
  /^contact information/i,
  /^permit/i,
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

  return fallbackPark;
}

function findKnownPark(text: string) {
  return knownParks.find((park) => text.includes(park)) ?? "";
}

function isHeaderLine(line: string) {
  return headerPatterns.some((pattern) => pattern.test(line));
}

function isTimeLine(line: string) {
  return /^\d{1,2}:\d{2}\s*[AP]M\s*[-–—]\s*\d{1,2}:\d{2}\s*[AP]M/i.test(
    line,
  );
}

function parseTimeRange(text: string) {
  const match = text.match(
    /(\d{1,2}:\d{2}\s*[AP]M)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[AP]M)/i,
  );

  return {
    startTime: match?.[1]?.toUpperCase() ?? "",
    endTime: match?.[2]?.toUpperCase() ?? "",
    rest: text.replace(match?.[0] ?? "", "").trim(),
  };
}

function looksLikeFacility(line: string) {
  return (
    /^(CP|HBP|NPP)\s*-/i.test(line) ||
    /^Glynn A\.?\s*Green\s+Field\b/i.test(line)
  );
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
  const [timeLine = "", ...restLines] = lines;
  const { startTime, endTime, rest } = parseTimeRange(timeLine);
  const blockLines = [rest, ...restLines].map((line) => line.trim()).filter(Boolean);
  const blockText = blockLines.join(" ");
  const facilityLines = blockLines.filter(looksLikeFacility);
  const equipmentType =
    blockLines.find((line) => /^Field\s*-/i.test(line)) ??
    (blockText.includes("Soccer") ? "Field - Soccer" : "Field - Baseball");
  const park = findKnownPark(blockText);
  const scheduleType =
    blockLines.find((line) =>
      /(Games with Lines|No Maintenance|Soccer Field Rental|Ball Diamond)/i.test(
        line,
      ),
    ) ?? "";
  const organization =
    blockLines.find((line) => /(Association|Club|League|PMBA)/i.test(line)) ?? "";
  const permitNumber = blockText.match(/\bR\d+\b/i)?.[0] ?? "";
  const attendanceQuantity =
    blockLines.find((line) => /^\d+$/.test(line) && line !== permitNumber) ?? "";
  const contactPhone = blockText.match(/\(?\d{3}\)?\s*\d{3}-\d{4}/)?.[0] ?? "";
  const eventName =
    blockLines.find(
      (line) =>
        !looksLikeFacility(line) &&
        line !== equipmentType &&
        line !== park &&
        line !== scheduleType &&
        line !== organization &&
        !line.includes(contactPhone) &&
        !line.includes(permitNumber) &&
        !/^\d+$/.test(line) &&
        !/Commercial|Minor|External Reservation/i.test(line),
    ) ?? "";

  if (!startTime || !endTime || facilityLines.length === 0) {
    return [];
  }

  return facilityLines.map((facility) => ({
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
    contactName: "Rental Contact",
    contactPhone,
    permitNumber,
    attendanceQuantity,
    notes: "Imported from OCR text",
  }));
}

function getRentalDate(lines: string[]) {
  const dateLine = lines.find((line) => /^(DATE:|Reservation Date)/i.test(line));

  if (!dateLine) {
    return "";
  }

  const dateMatch = dateLine.match(/[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}/);

  return dateMatch?.[0] ?? dateLine.replace(/date:|reservation date/i, "").trim();
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

  function flushBlock() {
    if (currentBlock.length === 0) {
      return;
    }

    const parsedRentals = parseBlock(currentBlock, rentalDate);

    if (parsedRentals.length === 0) {
      skippedLines.push(currentBlock.join(" / "));
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
        skippedLines.push(line);
      }

      return;
    }

    if (/^(DATE:|Reservation Date)/i.test(line) || isHeaderLine(line)) {
      if (!/^(DATE:|Reservation Date)/i.test(line)) {
        skippedLines.push(line);
      }
      return;
    }

    if (isTimeLine(line)) {
      flushBlock();
      currentBlock = [line];
      return;
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
      return;
    }

    skippedLines.push(line);
  });

  flushBlock();

  skippedLines.forEach((line) => {
    console.debug("[rentalSheetParser] skipped line/block:", line);
  });

  return {
    rentals,
    skippedLines,
    rawText: ocrText,
  };
}

export function parseRentalSheetText(ocrText: string): RentalInput[] {
  return parseRentalSheetTextWithDebug(ocrText).rentals;
}
