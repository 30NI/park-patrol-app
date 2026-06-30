import type { RentalInput } from "./rental";
import type { RentalSheetValidationResult } from "@/lib/rentalSheetParser";

export type RentalExtractionMethod = "ai" | "tesseract";

export type ReviewRentalInput = RentalInput & {
  confidence?: number;
  warnings?: string[];
};

export type RentalExtractionResult = {
  method: RentalExtractionMethod;
  methodLabel: string;
  rentals: ReviewRentalInput[];
  skippedLines: string[];
  rawText: string;
  validation: RentalSheetValidationResult;
  warnings: string[];
  reservationDate: string;
};
