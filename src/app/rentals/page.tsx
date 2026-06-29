"use client";

import { useEffect, useRef, useState } from "react";
import type { Rental, RentalInput } from "@/types/rental";
import { parseRentalSheetTextWithDebug } from "@/lib/rentalSheetParser";
import { timeToMinutes } from "@/lib/time";
import { usePatrol } from "../context/PatrolContext";

type SelectedRentalSheetImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type RentalSheetScanResult = {
  rentals: RentalInput[];
  skippedLines: string[];
  rawText: string;
};

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

function isGameRental(rental: Rental) {
  const searchText =
    `${rental.notes} ${rental.facility} ${rental.eventName} ${rental.scheduleType}`.toLowerCase();

  return searchText.includes("game");
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
    clearRentals,
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
  const [reviewRentals, setReviewRentals] = useState<RentalInput[]>([]);
  const [ocrDebug, setOcrDebug] = useState<{
    rawText: string;
    skippedLines: string[];
    detectedCount: number;
  } | null>(null);
  const sortedRentals = rentals.slice().sort(sortRentalsByStartTime);
  const checkedCount = rentals.filter((rental) => rental.checkedIn).length;

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
      status: "Starting Tesseract",
      percent: 0,
    });
    setReviewRentals([]);
    setOcrDebug(null);

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
        setOcrMessage(`Scanning page ${currentPage} of ${selectedImages.length}...`);
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

      if (!rawText) {
        setOcrMessage("No rental sheet text was detected.");
        return;
      }

      const result: RentalSheetScanResult = parseRentalSheetTextWithDebug(rawText);
      const detectedRentals = result.rentals;
      setReviewRentals(detectedRentals);
      setOcrDebug({
        rawText: result.rawText,
        skippedLines: result.skippedLines,
        detectedCount: result.rentals.length,
      });
      addActivity({
        category: "rental",
        action: "Rental sheet scanned",
        notes: `${selectedImages.length} photo${
          selectedImages.length === 1 ? "" : "s"
        } parsed for review`,
      });
      setOcrMessage(
        `${detectedRentals.length} rentals detected. Review before importing.`,
      );
    } catch (error) {
      const errorMessage = getOcrErrorMessage(error);

      console.error("[rental OCR] scan failed:", error);
      setOcrMessage(
        `Rental sheet scan failed: ${errorMessage}. Check the photos and try again.`,
      );
    } finally {
      await worker?.terminate();
      setIsScanning(false);
      setOcrProgress(null);
    }
  }

  function handleDeleteRental(rental: Rental) {
    if (window.confirm(`Delete ${rental.facility}?`)) {
      deleteRental(rental.id);
    }
  }

  function handleClearRentals() {
    if (
      rentals.length > 0 &&
      window.confirm(`Clear all ${rentals.length} rental${rentals.length === 1 ? "" : "s"}?`)
    ) {
      clearRentals();
      setReviewRentals([]);
      setOcrDebug(null);
      setOcrMessage("Rentals cleared.");
    }
  }

  function handleRentalSheetImages(fileList: FileList | null) {
    setOcrMessage("");
    setOcrProgress(null);
    setReviewRentals([]);
    setOcrDebug(null);

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
    setOcrMessage("");
  }

  function clearSelectedImages() {
    selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setSelectedImages([]);
    setReviewRentals([]);
    setOcrDebug(null);
    setOcrMessage("");
  }

  function updateReviewRental(
    index: number,
    field: keyof RentalInput,
    value: string,
  ) {
    setReviewRentals((current) =>
      current.map((rental, rentalIndex) =>
        rentalIndex === index
          ? {
              ...rental,
              [field]: value,
            }
          : rental,
      ),
    );
  }

  function deleteReviewRental(index: number) {
    setReviewRentals((current) =>
      current.filter((_, rentalIndex) => rentalIndex !== index),
    );
  }

  function confirmImport() {
    importRentals(reviewRentals);
    setReviewRentals([]);
    setOcrDebug(null);
    setOcrMessage("Rentals imported. Shift tasks have been generated.");
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Rentals</h1>
        <p className="mt-1 text-slate-600">
          Confirm each rental is on the correct field.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Import Rental Sheet</h2>
        <div className="mt-4 space-y-3">
          <label className="relative flex min-h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]">
            Add Sheets
            <input
              type="file"
              accept="image/*"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(event) => {
                handleRentalSheetImages(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>

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

          <button
            type="button"
            onClick={handleScanRentalSheet}
            disabled={isScanning || selectedImages.length === 0}
            className="min-h-14 w-full rounded-lg border border-slate-300 bg-white px-4 text-base font-bold text-slate-950 shadow-sm transition active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-400"
          >
            {isScanning ? "Scanning..." : "Scan Selected Sheets"}
          </button>

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

          {reviewRentals.length > 0 ? (
            <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="font-bold">Review Detected Rentals</h3>
              {reviewRentals.map((rental, index) => (
                <article
                  key={`${rental.facility}-${index}`}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
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

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Rental Checks</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {checkedCount}/{rentals.length} checked
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearRentals}
            disabled={rentals.length === 0}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 shadow-sm disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </section>

      <div className="space-y-3">
        {sortedRentals.length === 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-bold">No rentals entered</p>
            <p className="mt-2 text-sm text-slate-600">
              Use Dashboard to enter tonight&apos;s schedule manually.
            </p>
          </section>
        ) : null}

        {sortedRentals.map((rental) => (
          <article
            key={rental.id}
            className={`rounded-lg border p-4 shadow-sm ${
              rental.checkedIn
                ? "border-green-500 bg-green-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{rental.facility}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {rental.startTime} - {rental.endTime}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${
                  rental.checkedIn
                    ? "border-green-600 bg-white text-green-800"
                    : "border-slate-300 bg-slate-50 text-slate-600"
                }`}
              >
                {rental.checkedIn ? "Checked" : "Open"}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p>{rental.park}</p>
              <p>{rental.eventName}</p>
              <p>{rental.scheduleType}</p>
              <p>{rental.organization}</p>
              {rental.permitNumber ? (
                <p className="text-slate-600">
                  Permit {rental.permitNumber}
                  {rental.attendanceQuantity
                    ? ` - Qty ${rental.attendanceQuantity}`
                    : ""}
                </p>
              ) : null}
              {rental.notes ? <p className="text-slate-600">{rental.notes}</p> : null}
            </div>

            {isGameRental(rental) ? (
              <button
                type="button"
                onClick={() =>
                  rental.groomingStatus
                    ? handleUndoGrooming(rental.id)
                    : setGroomingRental(rental)
                }
                className="mt-4 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition active:scale-[0.99]"
              >
                {rental.groomingStatus === "alreadyGroomed"
                  ? "Already Groomed"
                  : rental.groomingStatus === "groomedOnShift"
                    ? "Groomed on Shift"
                    : "Groomed"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() =>
                rental.checkedIn ? handleUndo(rental.id) : checkRental(rental.id)
              }
              className="mt-4 min-h-14 w-full rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]"
            >
              {rental.checkedIn ? "Undo Check" : "Check Rental"}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteRental(rental)}
              className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition active:scale-[0.99]"
            >
              Delete Rental
            </button>
          </article>
        ))}
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
