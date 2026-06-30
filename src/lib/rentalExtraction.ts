import OpenAI from "openai";
import { parseRentalSheetTextWithDebug } from "./rentalSheetParser";
import type { RentalInput } from "@/types/rental";
import type {
  RentalExtractionResult,
  ReviewRentalInput,
} from "@/types/rentalExtraction";

type OpenAIRentalRow = {
  facility?: string;
  park?: string;
  facilityType?: string;
  startTime?: string;
  endTime?: string;
  eventName?: string;
  eventType?: string;
  permitNumber?: string;
  attendQty?: string;
  notes?: string;
  confidence?: number;
};

type OpenAIExtractionJson = {
  reservationDate?: string;
  rentals?: OpenAIRentalRow[];
  warnings?: string[];
};

export const knownParks = [
  "Centennial Park",
  "Harold Black Park",
  "North Pelham Park",
  "Peace Park",
  "Marlene Streit Stewart Park",
  "Glynn A. Green",
] as const;

export const knownFacilities = [
  {
    facility: "CP - Diamond #1 (Softball)",
    park: "Centennial Park",
    facilityType: "Field - Baseball",
  },
  {
    facility: "CP - Diamond #2 (Softball)",
    park: "Centennial Park",
    facilityType: "Field - Baseball",
  },
  {
    facility: "CP - Diamond #3 (Hardball)",
    park: "Centennial Park",
    facilityType: "Field - Baseball",
  },
  {
    facility: "CP - Soccer #1 - Full Field",
    park: "Centennial Park",
    facilityType: "Field - Soccer",
  },
  {
    facility: "CP - Soccer #2 - Full Field",
    park: "Centennial Park",
    facilityType: "Field - Soccer",
  },
  {
    facility: "HBP - Soccer Field - 7V7 Sizes",
    park: "Harold Black Park",
    facilityType: "Field - Soccer",
  },
  {
    facility: "HBP - Diamond #1 - Softball",
    park: "Harold Black Park",
    facilityType: "Field - Baseball",
  },
  {
    facility: "HBP - Diamond #2 - Hardball",
    park: "Harold Black Park",
    facilityType: "Field - Baseball",
  },
  {
    facility: "NPP - Diamond #1 (Pitching Machine)",
    park: "North Pelham Park",
    facilityType: "Field - Baseball",
  },
  {
    facility: "NPP - Diamond #2 (T-ball)",
    park: "North Pelham Park",
    facilityType: "Field - Baseball",
  },
  {
    facility: "Glynn A. Green Field - Soccer",
    park: "Glynn A. Green",
    facilityType: "Field - Soccer",
  },
] as const;

const rentalExtractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reservationDate: { type: "string" },
    rentals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          facility: { type: "string" },
          park: { type: "string" },
          facilityType: { type: "string" },
          startTime: { type: "string" },
          endTime: { type: "string" },
          eventName: { type: "string" },
          eventType: { type: "string" },
          permitNumber: { type: "string" },
          attendQty: { type: "string" },
          notes: { type: "string" },
          confidence: { type: "number" },
        },
        required: [
          "facility",
          "park",
          "facilityType",
          "startTime",
          "endTime",
          "eventName",
          "eventType",
          "permitNumber",
          "attendQty",
          "notes",
          "confidence",
        ],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["reservationDate", "rentals", "warnings"],
} as const;

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .replace(/[0o]/g, "o")
    .replace(/[1il|]/g, "i")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(firstValue: string, secondValue: string) {
  const first = normalizeSearchText(firstValue);
  const second = normalizeSearchText(secondValue);
  const distances = Array.from({ length: first.length + 1 }, (_, index) =>
    index,
  );

  for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
    let previous = distances[0];
    distances[0] = secondIndex;

    for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
      const temporary = distances[firstIndex];

      distances[firstIndex] =
        first[firstIndex - 1] === second[secondIndex - 1]
          ? previous
          : Math.min(previous, distances[firstIndex], distances[firstIndex - 1]) +
            1;
      previous = temporary;
    }
  }

  return distances[first.length];
}

function similarity(firstValue: string, secondValue: string) {
  const first = normalizeSearchText(firstValue);
  const second = normalizeSearchText(secondValue);
  const maxLength = Math.max(first.length, second.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(first, second) / maxLength;
}

function expandFacilityAliases(facility: string) {
  return [
    facility,
    facility.replace(" - Softball", ""),
    facility.replace(" - Hardball", ""),
    facility.replace(" (T-ball)", ""),
    facility.replace(" (Pitching Machine)", ""),
    facility.replace("CP -", "Centennial Park"),
    facility.replace("HBP -", "Harold Black Park"),
    facility.replace("NPP -", "North Pelham Park"),
    facility.replace("HBP -", "HBP").replace("Field -", "Field"),
    facility.replace("CP -", "CP").replace("Field -", "Field"),
    facility.replace("NPP -", "NPP").replace("Field -", "Field"),
  ];
}

export function fuzzyMatchFacility(value: string) {
  const normalizedValue = normalizeSearchText(value)
    .replace(/\bdiam0nd\b/g, "diamond")
    .replace(/\bfieid\b/g, "field")
    .replace(/\bfleid\b/g, "field");

  if (/\bhbp\b/.test(normalizedValue) && /\bsoccer\b/.test(normalizedValue)) {
    return {
      facility: knownFacilities.find(
        (facility) => facility.facility === "HBP - Soccer Field - 7V7 Sizes",
      )!,
      score: 0.92,
    };
  }

  const bestMatch = knownFacilities
    .map((facility) => ({
      facility,
      score: Math.max(
        ...expandFacilityAliases(facility.facility).map((alias) =>
          Math.max(
            similarity(normalizedValue, alias),
            normalizeSearchText(normalizedValue).includes(normalizeSearchText(alias))
              ? 0.98
              : 0,
            normalizeSearchText(alias).includes(normalizeSearchText(normalizedValue))
              ? 0.86
              : 0,
          ),
        ),
      ),
    }))
    .sort((first, second) => second.score - first.score)[0];

  if (!bestMatch || bestMatch.score < 0.58) {
    return null;
  }

  return bestMatch;
}

function getRowFacilityType(row: OpenAIRentalRow | Partial<RentalInput>) {
  if ("facilityType" in row && typeof row.facilityType === "string") {
    return row.facilityType.trim();
  }

  if ("equipmentType" in row && typeof row.equipmentType === "string") {
    return row.equipmentType.trim();
  }

  return "";
}

function getRowAttendanceQuantity(row: OpenAIRentalRow | Partial<RentalInput>) {
  if (
    "attendanceQuantity" in row &&
    typeof row.attendanceQuantity === "string"
  ) {
    return row.attendanceQuantity.trim();
  }

  if ("attendQty" in row && typeof row.attendQty === "string") {
    return row.attendQty.trim();
  }

  return "";
}

function normalizeParkName(value: string, facilityPark: string) {
  const directMatch = knownParks.find(
    (park) => normalizeSearchText(park) === normalizeSearchText(value),
  );

  if (directMatch) {
    return directMatch;
  }

  const fuzzyPark = knownParks
    .map((park) => ({
      park,
      score: similarity(value, park),
    }))
    .sort((first, second) => second.score - first.score)[0];

  return fuzzyPark && fuzzyPark.score >= 0.65 ? fuzzyPark.park : facilityPark;
}

function normalizeDate(value: string) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsedDate = new Date(value.replace(/\./g, ","));

  return Number.isNaN(parsedDate.getTime())
    ? value
    : parsedDate.toISOString().slice(0, 10);
}

function normalizeTime(value: string) {
  const normalizedValue = value
    .replace(/[.]/g, ":")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalizedValue.match(/^(\d{1,2})(?::?(\d{2}))?\s*([AP])M$/i);

  if (!match) {
    return "";
  }

  const hour = Number(match[1]);
  const minute = match[2] ?? "00";

  if (hour < 1 || hour > 12 || Number(minute) > 59) {
    return "";
  }

  return `${hour}:${minute.padStart(2, "0")} ${match[3].toUpperCase()}M`;
}

function timeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);

  if (!match) {
    return null;
  }

  let hour = Number(match[1]) % 12;

  if (match[3].toUpperCase() === "P") {
    hour += 12;
  }

  return hour * 60 + Number(match[2]);
}

export function validateRental(rental: ReviewRentalInput) {
  const warnings = [...(rental.warnings ?? [])];
  const startMinutes = timeToMinutes(rental.startTime);
  const endMinutes = timeToMinutes(rental.endTime);

  if (!rental.facility) {
    warnings.push("Missing facility.");
  }

  if (!rental.park) {
    warnings.push("Missing park.");
  }

  if (!rental.equipmentType) {
    warnings.push("Missing sport/type.");
  }

  if (startMinutes === null || endMinutes === null) {
    warnings.push("Missing or invalid start/end time.");
  } else if (endMinutes <= startMinutes) {
    warnings.push("End time must be after start time.");
  }

  if ((rental.confidence ?? 1) < 0.72) {
    warnings.push("Low AI confidence.");
  }

  return [...new Set(warnings)];
}

export function normalizeRental(
  row: OpenAIRentalRow | Partial<RentalInput>,
  reservationDate: string,
) {
  const warnings: string[] = [];
  const facilityMatch = fuzzyMatchFacility(row.facility ?? "");
  const facility = facilityMatch?.facility.facility ?? row.facility?.trim() ?? "";
  const facilityPark = facilityMatch?.facility.park ?? "";
  const rowFacilityType = getRowFacilityType(row);
  const equipmentType =
    facilityMatch?.facility.facilityType ||
    rowFacilityType ||
    (/soccer/i.test(facility) ? "Field - Soccer" : "Field - Baseball");

  if (!facilityMatch) {
    warnings.push(`Unknown facility: ${row.facility ?? "blank"}.`);
  } else if (facilityMatch.score < 0.8) {
    warnings.push(`Facility was fuzzy matched from "${row.facility}".`);
  }

  const normalizedRental: ReviewRentalInput = {
    rentalDate: normalizeDate(reservationDate),
    park: normalizeParkName(row.park ?? "", facilityPark),
    facility,
    equipmentType,
    startTime: normalizeTime(row.startTime ?? ""),
    endTime: normalizeTime(row.endTime ?? ""),
    eventName: row.eventName?.trim() ?? "",
    eventType: row.eventType?.trim() || "External Reservation",
    scheduleType:
      "scheduleType" in row
        ? row.scheduleType?.trim() ?? ""
        : /soccer/i.test(equipmentType)
          ? "Soccer Field Rental - Minor"
          : "",
    organization:
      "organization" in row
        ? row.organization?.trim() ?? ""
        : "",
    contactName:
      "contactName" in row
        ? row.contactName?.trim() ?? ""
        : "",
    contactPhone:
      "contactPhone" in row
        ? row.contactPhone?.trim() ?? ""
        : "",
    permitNumber: row.permitNumber?.trim() ?? "",
    attendanceQuantity: getRowAttendanceQuantity(row),
    notes: row.notes?.trim() ?? "",
    confidence:
      "confidence" in row && typeof row.confidence === "number"
        ? Math.max(0, Math.min(1, row.confidence))
        : undefined,
    warnings,
  };

  normalizedRental.warnings = validateRental(normalizedRental);

  return normalizedRental;
}

export function dedupeRentals(rentals: ReviewRentalInput[]) {
  const seen = new Set<string>();
  const dedupedRentals: ReviewRentalInput[] = [];

  rentals.forEach((rental) => {
    const key = [
      rental.facility,
      rental.startTime,
      rental.endTime,
      rental.eventName,
    ]
      .map((part) => normalizeSearchText(part))
      .join("|");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    dedupedRentals.push(rental);
  });

  return dedupedRentals;
}

export function buildValidationResult(rentals: ReviewRentalInput[]) {
  const issues = rentals.flatMap((rental, rentalIndex) =>
    (rental.warnings ?? []).map((message) => ({
      severity: /missing|invalid|after start|unknown facility/i.test(message)
        ? ("error" as const)
        : ("warning" as const),
      message,
      rentalIndex,
    })),
  );

  return {
    totalRentals: rentals.length,
    completeRentals: rentals.filter((rental) => (rental.warnings ?? []).length === 0)
      .length,
    incompleteRentals: rentals.filter((rental) =>
      (rental.warnings ?? []).some((warning) =>
        /missing|invalid|after start|unknown facility/i.test(warning),
      ),
    ).length,
    issues,
  };
}

export function normalizeExtractedRentals(
  rows: Array<OpenAIRentalRow | Partial<RentalInput>>,
  reservationDate: string,
) {
  return dedupeRentals(rows.map((row) => normalizeRental(row, reservationDate)));
}

export function extractRentalSheetWithTesseract(ocrText: string) {
  const parsedResult = parseRentalSheetTextWithDebug(ocrText);
  const rentals = normalizeExtractedRentals(
    parsedResult.rentals,
    parsedResult.rentals[0]?.rentalDate ?? "",
  );

  return {
    method: "tesseract" as const,
    methodLabel: "Offline OCR fallback",
    rentals,
    skippedLines: parsedResult.skippedLines,
    rawText: parsedResult.rawText,
    validation: buildValidationResult(rentals),
    warnings: parsedResult.validation.issues.map((issue) => issue.message),
    reservationDate: normalizeDate(parsedResult.rentals[0]?.rentalDate ?? ""),
  } satisfies RentalExtractionResult;
}

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return `data:${file.type || "image/jpeg"};base64,${base64}`;
}

async function fileToOpenAIContent(file: File) {
  const dataUrl = await fileToDataUrl(file);

  if (file.type === "application/pdf") {
    return {
      type: "input_file" as const,
      filename: file.name || "rental-sheet.pdf",
      file_data: dataUrl,
    };
  }

  return {
    type: "input_image" as const,
    image_url: dataUrl,
    detail: "high" as const,
  };
}

function parseOpenAIJson(text: string) {
  const parsed = JSON.parse(text) as OpenAIExtractionJson;

  return {
    reservationDate: parsed.reservationDate ?? "",
    rentals: Array.isArray(parsed.rentals) ? parsed.rentals : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}

export async function extractRentalSheetWithOpenAI(files: File[]) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const fileInputs = await Promise.all(files.map(fileToOpenAIContent));
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Extract every rental row from these Reservation Master Report pages. " +
              "Return only structured JSON matching the schema. Keep duplicate facilities only when time or event differs. " +
              "Use 12-hour times like 6:00 PM. Use YYYY-MM-DD dates. If unsure, include the row with low confidence and a warning.",
          },
          ...fileInputs,
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "rental_sheet_extraction",
        schema: rentalExtractionSchema,
        strict: true,
      },
    },
  }, { timeout: 30000 });
  const extractedText = response.output_text;
  const extractedJson = parseOpenAIJson(extractedText);
  const rentals = normalizeExtractedRentals(
    extractedJson.rentals,
    extractedJson.reservationDate,
  );

  return {
    method: "ai" as const,
    methodLabel: "AI extraction",
    rentals,
    skippedLines: [],
    rawText: extractedText,
    validation: buildValidationResult(rentals),
    warnings: extractedJson.warnings,
    reservationDate: normalizeDate(extractedJson.reservationDate),
  } satisfies RentalExtractionResult;
}
