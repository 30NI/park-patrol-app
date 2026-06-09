import { NextResponse } from "next/server";
import { parseRentalSheetTextWithDebug } from "@/lib/rentalSheetParser";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ocrText?: unknown };

    if (typeof body.ocrText !== "string" || body.ocrText.trim() === "") {
      return NextResponse.json(
        { error: "ocrText is required." },
        { status: 400 },
      );
    }

    const result = parseRentalSheetTextWithDebug(body.ocrText);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Invalid rental sheet parse request." },
      { status: 400 },
    );
  }
}
