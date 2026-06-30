import { NextResponse } from "next/server";
import {
  extractRentalSheetWithOpenAI,
  extractRentalSheetWithTesseract,
} from "@/lib/rentalExtraction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData
        .getAll("files")
        .filter((file): file is File => file instanceof File);

      if (files.length === 0) {
        return NextResponse.json(
          { error: "At least one rental sheet image is required." },
          { status: 400 },
        );
      }

      try {
        const result = await extractRentalSheetWithOpenAI(files);

        return NextResponse.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "AI extraction failed.";

        return NextResponse.json(
          {
            error: message,
            fallbackAvailable: true,
          },
          { status: 503 },
        );
      }
    }

    const body = (await request.json()) as { ocrText?: unknown };

    if (typeof body.ocrText !== "string" || body.ocrText.trim() === "") {
      return NextResponse.json(
        { error: "ocrText is required." },
        { status: 400 },
      );
    }

    const result = extractRentalSheetWithTesseract(body.ocrText);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Invalid rental sheet parse request." },
      { status: 400 },
    );
  }
}
