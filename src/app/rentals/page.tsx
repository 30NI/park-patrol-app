"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Rental, RentalInput } from "@/types/rental";
import type {
  RentalExtractionResult,
  ReviewRentalInput,
} from "@/types/rentalExtraction";
import {
  parseRentalSheetTextWithDebug,
  validateParsedRentals,
  type RentalSheetValidationResult,
} from "@/lib/rentalSheetParser";
import { timeToMinutes } from "@/lib/time";
import { usePatrol } from "../context/PatrolContext";

type SelectedRentalSheetImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type RentalSheetScanResult = {
  rentals: ReviewRentalInput[];
  skippedLines: string[];
  rawText: string;
  validation: RentalSheetValidationResult;
  methodLabel?: string;
  warnings?: string[];
};

function stripReviewFields(rental: ReviewRentalInput): RentalInput {
  return {
    rentalDate: rental.rentalDate,
    park: rental.park,
    facility: rental.facility,
    equipmentType: rental.equipmentType,
    startTime: rental.startTime,
    endTime: rental.endTime,
    eventName: rental.eventName,
    eventType: rental.eventType,
    scheduleType: rental.scheduleType,
    organization: rental.organization,
    contactName: rental.contactName,
    contactPhone: rental.contactPhone,
    permitNumber: rental.permitNumber,
    attendanceQuantity: rental.attendanceQuantity,
    notes: rental.notes,
  };
}

type OcrProgress = {
  page: number;
  total: number;
  status: string;
  percent: number;
};

function getOcrErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown OCR error";
}

function sortRentalsByStartTime(a: Rental, b: Rental) {
  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
}

function createBlankReviewRental(): ReviewRentalInput {
  return {
    rentalDate: "",
    park: "",
    facility: "",
    equipmentType: "",
    startTime: "",
    endTime: "",
    eventName: "",
    eventType: "External Reservation",
    scheduleType: "",
    organization: "",
    contactName: "",
    contactPhone: "",
    permitNumber: "",
    attendanceQuantity: "",
    notes: "Added during review",
  };
}

function getRentalFieldClass(rental: Rental | RentalInput, isDone = false) {
  const fieldText =
    `${rental.equipmentType} ${rental.facility} ${rental.scheduleType}`.toLowerCase();
  const fieldBase = fieldText.includes("soccer")
    ? "border-white bg-[#6fa85f]"
    : "border-white bg-[#a87443]";

  return `${fieldBase} ${isDone ? "ring-2 ring-green-500" : ""}`;
}

async function preprocessImageForOcr(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(4, Math.max(2, 3200 / bitmap.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    bitmap.close();
    return file;
  }

  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.8 + 128));
    const value = contrast < 170 ? 0 : 255;

    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );

  return blob ?? file;
}

export default function RentalsPage() {
  const {
    rentals,
    checkRental,
    undoRental,
    setRentalGrooming,
    undoRentalGrooming,
    importRentals,
    deleteRental,
    addActivity,
  } = usePatrol();
  const [groomingRental, setGroomingRental] = useState<Rental | null>(null);
  const [selectedImages, setSelectedImages] = useState<
    SelectedRentalSheetImage[]
  >([]);
  const selectedImagesRef = useRef<SelectedRentalSheetImage[]>([]);
  const [ocrMessage, setOcrMessage] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [reviewRentals, setReviewRentals] = useState<ReviewRentalInput[]>([]);
  const [extractionMethodLabel, setExtractionMethodLabel] = useState("");
  const [openMenuRentalId, setOpenMenuRentalId] = useState<string | null>(null);
  const [ocrDebug, setOcrDebug] = useState<{
    rawText: string;
    skippedLines: string[];
    detectedCount: number;
    validation: RentalSheetValidationResult;
  } | null>(null);
  const [reviewValidation, setReviewValidation] =
    useState<RentalSheetValidationResult | null>(null);
  const sortedRentals = rentals.slice().sort(sortRentalsByStartTime);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    },
    [],
  );

  function handleUndo(rentalId: string) {
    if (window.confirm("Undo this rental check?")) {
      undoRental(rentalId);
      setOpenMenuRentalId(null);
    }
  }

  function handleUndoGrooming(rentalId: string) {
    if (window.confirm("Undo this grooming status?")) {
      undoRentalGrooming(rentalId);
    }
  }

  function handleGroomingChoice(
    rental: Rental,
    groomingStatus: "alreadyGroomed" | "groomedOnShift",
  ) {
    setRentalGrooming(rental.id, groomingStatus);
    setGroomingRental(null);
  }

  function applyScanResult(result: RentalSheetScanResult) {
    const detectedRentals = result.rentals;

    console.info("[rental OCR] parsed rental objects after parsing:", {
      count: detectedRentals.length,
      rentals: detectedRentals,
      validation: result.validation,
      skippedLines: result.skippedLines,
      warnings: result.warnings,
      method: result.methodLabel,
    });
    setReviewRentals(detectedRentals);
    setReviewValidation(result.validation);
    setExtractionMethodLabel(result.methodLabel ?? "Offline OCR fallback");
    setOcrDebug({
      rawText: result.rawText,
      skippedLines: result.skippedLines,
      detectedCount: result.rentals.length,
      validation: result.validation,
    });
    addActivity({
      category: "rental",
      action: "Rental sheet scanned",
      notes: `${result.methodLabel ?? "Offline OCR fallback"}: ${
        detectedRentals.length
      } rental${detectedRentals.length === 1 ? "" : "s"} parsed for review`,
    });
    setOcrMessage(
      `${result.methodLabel ?? "Offline OCR fallback"}: ${
        detectedRentals.length
      } rentals detected. Review before importing.`,
    );
  }

  async function scanWithOpenAI() {
    const formData = new FormData();

    selectedImages.forEach((image) => {
      formData.append("files", image.file, image.file.name);
    });

    const response = await fetch("/api/parse-rental-sheet", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as
      | RentalExtractionResult
      | { error?: string; fallbackAvailable?: boolean };

    if (!response.ok) {
      throw new Error(
        "error" in result && result.error ? result.error : "AI extraction failed.",
      );
    }

    return result as RentalExtractionResult;
  }

  async function parseFallbackText(rawText: string) {
    if (navigator.onLine) {
      try {
        const response = await fetch("/api/parse-rental-sheet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ocrText: rawText }),
        });

        if (response.ok) {
          return (await response.json()) as RentalExtractionResult;
        }
      } catch {
        // Local parser below keeps offline fallback available.
      }
    }

    const parsedResult = parseRentalSheetTextWithDebug(rawText);
    const rentals = parsedResult.rentals.map((rental) => ({
      ...rental,
      warnings: [],
    }));
    const validation = validateParsedRentals(rentals, {
      skippedLines: parsedResult.skippedLines,
      rawText: parsedResult.rawText,
      expectedRentalCount: /\bJun\s+29[,.\s]+\s*2026\b/i.test(
        parsedResult.rawText,
      )
        ? 12
        : null,
    });

    return {
      rentals,
      skippedLines: parsedResult.skippedLines,
      rawText: parsedResult.rawText,
      validation,
      method: "tesseract" as const,
      methodLabel: "Offline OCR fallback",
      warnings: validation.issues.map((issue) => issue.message),
    };
  }

  async function scanWithTesseractFallback() {
    let worker: Awaited<
      ReturnType<typeof import("tesseract.js")["createWorker"]>
    > | null = null;

    try {
      const Tesseract = await import("tesseract.js");
      let currentPage = 0;

      worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        workerPath: "/tesseract/worker.min.js",
        workerBlobURL: false,
        corePath: "/tesseract",
        langPath: "/tesseract/lang-data",
        gzip: true,
        logger: (message) => {
          setOcrProgress({
            page: currentPage,
            total: selectedImages.length,
            status: message.status,
            percent: Math.round(message.progress * 100),
          });
        },
      });

      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        user_defined_dpi: "300",
      });

      const pageTexts: string[] = [];

      for (const [index, image] of selectedImages.entries()) {
        currentPage = index + 1;
        setOcrMessage(
          `Offline OCR fallback: scanning page ${currentPage} of ${selectedImages.length}...`,
        );
        setOcrProgress({
          page: currentPage,
          total: selectedImages.length,
          status: "Recognizing text",
          percent: 0,
        });

        const processedImage = await preprocessImageForOcr(image.file);
        const result = await worker.recognize(processedImage);
        const text = result.data.text.trim();

        if (text) {
          pageTexts.push(text);
        }
      }

      const rawText = pageTexts.join("\n\n").trim();
      console.info("[rental OCR] full raw OCR text before parsing:", rawText);

      if (!rawText) {
        throw new Error("No rental sheet text was detected.");
      }

      return await parseFallbackText(rawText);
    } finally {
      await worker?.terminate();
    }
  }

  async function handleScanRentalSheet() {
    if (selectedImages.length === 0) {
      setOcrMessage("Upload one or more rental sheet photos first.");
      return;
    }

    setIsScanning(true);
    setOcrMessage("Preparing local OCR...");
    setOcrProgress({
      page: 0,
      total: selectedImages.length,
      status: navigator.onLine ? "Starting AI extraction" : "Starting Tesseract",
      percent: 0,
    });
    setReviewRentals([]);
    setOcrDebug(null);
    setReviewValidation(null);
    setExtractionMethodLabel("");

    try {
      if (navigator.onLine) {
        try {
          setOcrMessage("AI extraction: uploading sheet photos...");
          setOcrProgress({
            page: 0,
            total: selectedImages.length,
            status: "AI extraction",
            percent: 25,
          });
          applyScanResult(await scanWithOpenAI());
          return;
        } catch (error) {
          console.warn("[rental OCR] AI extraction failed, using fallback:", error);
          setOcrMessage("AI extraction failed. Using Offline OCR fallback...");
        }
      }

      applyScanResult(await scanWithTesseractFallback());
    } catch (error) {
      const errorMessage = getOcrErrorMessage(error);

      console.error("[rental OCR] scan failed:", error);
      setOcrMessage(
        `Rental sheet scan failed: ${errorMessage}. Check the photos and try again.`,
      );
    } finally {
      setIsScanning(false);
      setOcrProgress(null);
    }
  }

  function handleDeleteRental(rental: Rental) {
    if (window.confirm(`Delete ${rental.facility}?`)) {
      deleteRental(rental.id);
      setOpenMenuRentalId(null);
    }
  }

  function handleRentalSheetImages(fileList: FileList | null) {
    setOcrMessage("");
    setOcrProgress(null);
    setReviewRentals([]);
    setOcrDebug(null);
    setReviewValidation(null);
    setExtractionMethodLabel("");

    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      return;
    }

    const nextImages = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedImages((current) => [
      ...current,
      ...nextImages,
    ]);
  }

  function removeSelectedImage(imageId: string) {
    setSelectedImages((current) => {
      const imageToRemove = current.find((image) => image.id === imageId);

      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }

      return current.filter((image) => image.id !== imageId);
    });
    setReviewRentals([]);
    setOcrDebug(null);
    setReviewValidation(null);
    setExtractionMethodLabel("");
    setOcrMessage("");
  }

  function clearSelectedImages() {
    selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setSelectedImages([]);
    setReviewRentals([]);
    setOcrDebug(null);
    setReviewValidation(null);
    setExtractionMethodLabel("");
    setOcrMessage("");
  }

  function updateReviewValidation(nextRentals: RentalInput[]) {
    const validation = validateParsedRentals(nextRentals, {
      skippedLines: ocrDebug?.skippedLines ?? [],
      rawText: ocrDebug?.rawText ?? "",
      expectedRentalCount: ocrDebug?.rawText
        ? /\bJun\s+29[,.\s]+\s*2026\b/i.test(ocrDebug.rawText)
          ? 12
          : null
        : null,
    });

    setReviewValidation(validation);
    setOcrDebug((current) =>
      current
        ? {
            ...current,
            detectedCount: nextRentals.length,
            validation,
          }
        : current,
    );
  }

  function updateReviewRental(
    index: number,
    field: keyof RentalInput,
    value: string,
  ) {
    setReviewRentals((current) => {
      const nextRentals = current.map((rental, rentalIndex) =>
        rentalIndex === index
          ? {
              ...rental,
              [field]: value,
            }
          : rental,
      );

      updateReviewValidation(nextRentals);
      return nextRentals;
    });
  }

  function deleteReviewRental(index: number) {
    setReviewRentals((current) => {
      const nextRentals = current.filter((_, rentalIndex) => rentalIndex !== index);

      updateReviewValidation(nextRentals);
      return nextRentals;
    });
  }

  function addReviewRental() {
    setReviewRentals((current) => {
      const nextRentals = [...current, createBlankReviewRental()];

      updateReviewValidation(nextRentals);
      return nextRentals;
    });
  }

  function confirmImport() {
    const validation = validateParsedRentals(reviewRentals, {
      skippedLines: ocrDebug?.skippedLines ?? [],
      rawText: ocrDebug?.rawText ?? "",
      expectedRentalCount: ocrDebug?.rawText
        ? /\bJun\s+29[,.\s]+\s*2026\b/i.test(ocrDebug.rawText)
          ? 12
          : null
        : null,
    });

    setReviewValidation(validation);

    if (validation.issues.some((issue) => issue.severity === "error")) {
      setOcrMessage("Fix incomplete rentals before importing.");
      return;
    }

    importRentals(reviewRentals.map(stripReviewFields));
    selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setSelectedImages([]);
    setReviewRentals([]);
    setOcrDebug(null);
    setReviewValidation(null);
    setOcrMessage("");
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2 text-center">
        <h1 className="display-title text-4xl font-black">Rentals</h1>
      </header>

      <section className="grid gap-3">
        <Link
          href="/rentals/new"
          className="flex min-h-28 items-center gap-4 rounded-2xl border-4 border-white bg-[#c8d7ee] p-4 text-left shadow-sm transition active:scale-[0.99]"
        >
          <span className="text-5xl" aria-hidden="true">
            🛠️
          </span>
          <span className="text-xl font-black text-slate-950">Manual Entry</span>
        </Link>

        <label className="relative flex min-h-28 cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border-4 border-white bg-[#f5b971] p-4 text-left shadow-sm transition active:scale-[0.99]">
          <span className="text-5xl" aria-hidden="true">
            🖼️
          </span>
          <span className="text-xl font-black text-slate-950">Add Sheets</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(event) => {
                handleRentalSheetImages(event.target.files);
                event.currentTarget.value = "";
              }}
            />
        </label>
      </section>

      {selectedImages.length > 0 || ocrProgress || ocrMessage || ocrDebug ? (
      <section className="rounded-2xl border-4 border-white bg-white/75 p-4 shadow-sm">
        <div className="space-y-3">
          {selectedImages.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 p-3">
                <p className="text-sm font-semibold text-slate-700">
                  {selectedImages.length} sheet photo
                  {selectedImages.length === 1 ? "" : "s"} selected
                </p>
                <button
                  type="button"
                  onClick={clearSelectedImages}
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950"
                >
                  Clear
                </button>
              </div>
              {selectedImages.map((image, index) => (
                <figure
                  key={image.id}
                  className="rounded-lg border border-slate-200 bg-white p-2"
                >
                  <figcaption className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                    <span>
                      Sheet {index + 1}: {image.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSelectedImage(image.id)}
                      className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950"
                    >
                      Remove
                    </button>
                  </figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt={`Selected rental sheet ${index + 1}`}
                    className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
                  />
                </figure>
              ))}
            </div>
          ) : null}

          {selectedImages.length > 0 ? (
            <button
              type="button"
              onClick={handleScanRentalSheet}
              disabled={isScanning}
              className="min-h-14 w-full rounded-lg border border-slate-300 bg-white px-4 text-base font-bold text-slate-950 shadow-sm transition active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isScanning ? "Scanning..." : "Scan Selected Sheets"}
            </button>
          ) : null}

          {ocrProgress ? (
            <div className="rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {ocrProgress.page > 0
                    ? `Page ${ocrProgress.page} of ${ocrProgress.total}`
                    : "Starting OCR"}
                </span>
                <span>{ocrProgress.percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-950 transition-all"
                  style={{ width: `${ocrProgress.percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">{ocrProgress.status}</p>
            </div>
          ) : null}

          {ocrMessage ? (
            <p className="rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
              {ocrMessage}
            </p>
          ) : null}

          {ocrDebug ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="font-bold">OCR Debug</h3>
              <p className="mt-2 text-sm text-slate-700">
                Rentals detected: {ocrDebug.detectedCount}
              </p>
              {reviewValidation ? (
                <div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                  <p className="font-bold">
                    Parsed {reviewValidation.totalRentals} rental
                    {reviewValidation.totalRentals === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1">
                    Complete: {reviewValidation.completeRentals} - Incomplete:{" "}
                    {reviewValidation.incompleteRentals}
                  </p>
                  {reviewValidation.issues.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {reviewValidation.issues.map((issue, index) => (
                        <li key={`${issue.message}-${index}`}>
                          {issue.severity === "error" ? "Fix: " : "Warning: "}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 font-semibold">No validation warnings.</p>
                  )}
                </div>
              ) : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">
                  Raw OCR text
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                  {ocrDebug.rawText}
                </pre>
              </details>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">
                  Skipped / unparsed lines
                </summary>
                {ocrDebug.skippedLines.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                    None
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                    {ocrDebug.skippedLines.map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ul>
                )}
              </details>
            </section>
          ) : null}

          {ocrDebug ? (
            <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Review Detected Rentals</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Edit, delete, or add rows before tasks are generated.
                  </p>
                  {extractionMethodLabel ? (
                    <p className="mt-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700">
                      {extractionMethodLabel}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={addReviewRental}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950"
                >
                  Add
                </button>
              </div>
              {reviewRentals.map((rental, index) => (
                <article
                  key={`${rental.facility}-${index}`}
                  className={`rounded-lg border-[6px] p-3 shadow-sm ${
                    rental.warnings && rental.warnings.length > 0
                      ? "ring-4 ring-yellow-300"
                      : ""
                  } ${getRentalFieldClass(
                    rental,
                  )}`}
                >
                  {typeof rental.confidence === "number" ||
                  (rental.warnings && rental.warnings.length > 0) ? (
                    <div className="mb-3 rounded-lg bg-white/90 p-2 text-xs font-bold text-slate-800">
                      {typeof rental.confidence === "number" ? (
                        <p>
                          Confidence: {Math.round(rental.confidence * 100)}%
                        </p>
                      ) : null}
                      {rental.warnings && rental.warnings.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {rental.warnings.map((warning, warningIndex) => (
                            <li key={`${warning}-${warningIndex}`}>
                              Warning: {warning}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="col-span-2 block">
                      <span className="text-xs font-bold text-slate-600">
                        Facility
                      </span>
                      <input
                        value={rental.facility}
                        onChange={(event) =>
                          updateReviewRental(index, "facility", event.target.value)
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="text-xs font-bold text-slate-600">
                        Park
                      </span>
                      <input
                        value={rental.park}
                        onChange={(event) =>
                          updateReviewRental(index, "park", event.target.value)
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="text-xs font-bold text-slate-600">
                        Sport / Type
                      </span>
                      <input
                        value={rental.equipmentType}
                        onChange={(event) =>
                          updateReviewRental(
                            index,
                            "equipmentType",
                            event.target.value,
                          )
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-600">
                        Start
                      </span>
                      <input
                        value={rental.startTime}
                        onChange={(event) =>
                          updateReviewRental(index, "startTime", event.target.value)
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-600">
                        End
                      </span>
                      <input
                        value={rental.endTime}
                        onChange={(event) =>
                          updateReviewRental(index, "endTime", event.target.value)
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="text-xs font-bold text-slate-600">
                        Event
                      </span>
                      <input
                        value={rental.eventName}
                        onChange={(event) =>
                          updateReviewRental(index, "eventName", event.target.value)
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="text-xs font-bold text-slate-600">
                        Organization
                      </span>
                      <input
                        value={rental.organization}
                        onChange={(event) =>
                          updateReviewRental(
                            index,
                            "organization",
                            event.target.value,
                          )
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="text-xs font-bold text-slate-600">
                        Schedule Type
                      </span>
                      <input
                        value={rental.scheduleType}
                        onChange={(event) =>
                          updateReviewRental(
                            index,
                            "scheduleType",
                            event.target.value,
                          )
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteReviewRental(index)}
                    className="mt-3 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950"
                  >
                    Delete
                  </button>
                </article>
              ))}

              <button
                type="button"
                onClick={confirmImport}
                className="min-h-14 w-full rounded-lg bg-slate-950 px-4 text-base font-bold text-white"
              >
                Confirm Import
              </button>
            </section>
          ) : null}
        </div>
      </section>
      ) : null}

      <div>
        {sortedRentals.length === 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-bold">No rentals entered</p>
            <p className="mt-2 text-sm text-slate-600">
              Scan a sheet or add a rental manually.
            </p>
          </section>
        ) : null}

        {sortedRentals.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {sortedRentals.map((rental) => (
              <article
                key={rental.id}
                className={`relative flex min-h-72 flex-col justify-between rounded-2xl border-[6px] p-4 shadow-sm ${getRentalFieldClass(
                  rental,
                  rental.checkedIn,
                )}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenuRentalId((current) =>
                      current === rental.id ? null : rental.id,
                    )
                  }
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-black text-slate-700 shadow-sm"
                  aria-label={`Open rental options for ${rental.facility}`}
                >
                  ...
                </button>

                {openMenuRentalId === rental.id ? (
                  <div className="absolute right-3 top-14 z-10 min-w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleUndo(rental.id)}
                      disabled={!rental.checkedIn}
                      className="block min-h-10 w-full rounded-lg px-3 text-left text-xs font-bold text-slate-950 disabled:text-slate-300"
                    >
                      Undo Check
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRental(rental)}
                      className="block min-h-10 w-full rounded-lg px-3 text-left text-xs font-bold text-slate-950"
                    >
                      Delete Rental
                    </button>
                  </div>
                ) : null}

                <div className="min-h-28 pr-10">
                  <h2 className="text-base font-black leading-tight text-slate-950">
                    {rental.facility}
                  </h2>
                  <p className="mt-2 flex w-full max-w-full justify-center whitespace-nowrap rounded-full bg-white/90 px-2 py-1.5 text-[11px] font-black text-slate-800 shadow-sm">
                    {rental.startTime} - {rental.endTime}
                  </p>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => checkRental(rental.id)}
                    disabled={rental.checkedIn}
                    className={`min-h-14 rounded-xl px-3 text-sm font-black shadow-sm transition active:scale-[0.98] ${
                      rental.checkedIn
                        ? "bg-slate-200 text-slate-500"
                        : "bg-slate-950 text-white"
                    }`}
                  >
                    {rental.checkedIn ? "Checked" : "Check Rental"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      rental.groomingStatus
                        ? handleUndoGrooming(rental.id)
                        : setGroomingRental(rental)
                    }
                    className={`min-h-14 rounded-xl px-3 text-sm font-black shadow-sm transition active:scale-[0.98] ${
                      rental.groomingStatus
                        ? "bg-white text-slate-950"
                        : "bg-slate-950 text-white"
                    }`}
                  >
                    {rental.groomingStatus ? "Groomed" : "Groomed"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      {groomingRental ? (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 p-4">
          <section className="mx-auto w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-xl font-bold">Game Grooming</h2>
            <p className="mt-1 text-sm text-slate-600">
              {groomingRental.facility}
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() =>
                  handleGroomingChoice(groomingRental, "alreadyGroomed")
                }
                className="min-h-14 w-full rounded-lg bg-slate-950 px-4 text-base font-bold text-white"
              >
                Already Groomed
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGroomingChoice(groomingRental, "groomedOnShift")
                }
                className="min-h-14 w-full rounded-lg bg-slate-950 px-4 text-base font-bold text-white"
              >
                Groomed on Shift
              </button>
              <button
                type="button"
                onClick={() => setGroomingRental(null)}
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-900"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
