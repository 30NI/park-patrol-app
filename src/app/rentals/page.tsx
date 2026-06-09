"use client";

import { useState } from "react";
import { parseRentalSheetTextWithDebug } from "@/lib/rentalSheetParser";
import type { Rental, RentalInput } from "@/types/rental";
import { timeToMinutes } from "@/lib/time";
import { usePatrol } from "../context/PatrolContext";

const mockOcrText = `
DATE: Jun 9, 2026
Reservation Master Report
Page: 1 of 2
6:00 PM - 10:30 PM
CP - Diamond #3 (Hardball)
Field - Baseball
Centennial Park
Baseball Games
Ball Diamond - Games with Lines
Local Baseball Association
R10001
30
6:00 PM - 8:00 PM
HBP - Diamond #1 - Softball
Field - Baseball
Harold Black Park
Baseball Games
Ball Diamond - Games with Lines
Local Baseball Association
R10002
30
6:00 PM - 7:30 PM
HBP - Diamond #2 - Hardball
Field - Baseball
Harold Black Park
Baseball Practice
Ball Diamond - No Maintenance
Local Baseball Association
R10003
1
6:00 PM - 8:30 PM
HBP - Soccer Field - 7V7 Sizes
Field - Soccer
Harold Black Park
Soccer Rental
Soccer Field Rental - Minor
Local Soccer Club
R10004
20
6:00 PM - 7:00 PM
NPP - Diamond #1 (Pitching Machine)
Field - Baseball
North Pelham Park
Baseball Practice
Ball Diamond - No Maintenance
Local Baseball Association
R10005
1
6:00 PM - 7:00 PM
NPP - Diamond #2 (T-ball)
Field - Baseball
North Pelham Park
Baseball Practice
Ball Diamond - No Maintenance
Local Baseball Association
R10006
1
6:00 PM - 8:00 PM
Glynn A. Green Field - Soccer
Field - Soccer
Glynn A. Green
Soccer Rental
Soccer Field Rental - Minor
Local Soccer Club
R10007
20
6:30 PM - 8:30 PM
CP - Soccer #1 - Full Field
CP - Soccer #2 - Full Field
Field - Soccer
Centennial Park
Soccer Rental
Soccer Field Rental - Minor
Local Soccer Club
R10008
20
6:45 PM - 9:15 PM | CP - Diamond #2 (Softball) | Field - Baseball | Softball Games | Ball Diamond - Games with Lines | Local Softball League | Rental Contact | (905) 000-0000 | R10009 | 20 | Centennial Park
8:00 PM - 9:30 PM | HBP - Diamond #1 - Softball | Field - Baseball | Baseball Practice | Ball Diamond - No Maintenance | Local Baseball Association | Rental Contact | (905) 000-0000 | R10010 | 1 | Harold Black Park
`.trim();

function sortRentalsByStartTime(a: Rental, b: Rental) {
  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
}

function isGameRental(rental: Rental) {
  const searchText =
    `${rental.notes} ${rental.facility} ${rental.eventName} ${rental.scheduleType}`.toLowerCase();

  return searchText.includes("game");
}

export default function RentalsPage() {
  const {
    rentals,
    checkRental,
    undoRental,
    setRentalGrooming,
    undoRentalGrooming,
    importRentals,
    addActivity,
  } = usePatrol();
  const [groomingRental, setGroomingRental] = useState<Rental | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [ocrMessage, setOcrMessage] = useState("");
  const [reviewRentals, setReviewRentals] = useState<RentalInput[]>([]);
  const [ocrDebug, setOcrDebug] = useState<{
    rawText: string;
    skippedLines: string[];
    detectedCount: number;
  } | null>(null);
  const sortedRentals = rentals.slice().sort(sortRentalsByStartTime);
  const checkedCount = rentals.filter((rental) => rental.checkedIn).length;

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

  function handleScanRentalSheet() {
    // Future OCR flow:
    // 1. Upload rental sheet photo.
    // 2. Send image to OCR/AI service. Mock OCR text is used for now.
    // 3. Extract rentals into structured JSON.
    // 4. Show review screen.
    // 5. User confirms rentals.
    // 6. Save rentals and generate tasks.
    const result = parseRentalSheetTextWithDebug(mockOcrText);
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
      notes: "Mock OCR text parsed for review",
    });
    setOcrMessage(`${detectedRentals.length} rentals detected. Review before importing.`);
  }

  function handleRentalSheetImage(file: File | null) {
    setOcrMessage("");

    if (!file) {
      setImagePreviewUrl("");
      setOcrDebug(null);
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImagePreviewUrl(typeof reader.result === "string" ? reader.result : "");
    });
    reader.readAsDataURL(file);
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
          <label className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-lg bg-slate-950 px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99]">
            Upload Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handleRentalSheetImage(file);
              }}
            />
          </label>

          {imagePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreviewUrl}
              alt="Selected rental sheet preview"
              className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
            />
          ) : null}

          <button
            type="button"
            onClick={handleScanRentalSheet}
            className="min-h-14 w-full rounded-lg border border-slate-300 bg-white px-4 text-base font-bold text-slate-950 shadow-sm transition active:scale-[0.99]"
          >
            Scan Rental Sheet
          </button>

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
          <h2 className="text-lg font-bold">Rental Checks</h2>
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-700">
            {checkedCount}/{rentals.length}
          </span>
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
