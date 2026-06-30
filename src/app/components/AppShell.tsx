"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { usePatrol } from "../context/PatrolContext";
import { BottomNavigation } from "./BottomNavigation";

function StartShiftScreen() {
  const { startShift } = usePatrol();
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [starterName, setStarterName] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;

    if (!canvas || !isStartOpen) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#020617";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, [isStartOpen]);

  function getSignaturePoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startSignature(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getSignaturePoint(event);

    if (!canvas || !context || !point) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsSigning(true);
  }

  function drawSignature(event: PointerEvent<HTMLCanvasElement>) {
    const context = signatureCanvasRef.current?.getContext("2d");
    const point = getSignaturePoint(event);

    if (!isSigning || !context || !point) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endSignature() {
    setIsSigning(false);
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function submitStartShift() {
    const trimmedName = starterName.trim();

    if (!trimmedName) {
      window.alert("Enter your name first.");
      return;
    }

    const signature = signatureCanvasRef.current?.toDataURL("image/png") ?? "";

    startShift(trimmedName, signature);
    setIsStartOpen(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <button
        type="button"
        onClick={() => setIsStartOpen(true)}
        className="min-h-16 w-full max-w-sm rounded-lg bg-slate-950 px-4 text-xl font-bold text-white shadow-sm transition active:scale-[0.99]"
      >
        Start Shift
      </button>

      {isStartOpen ? (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 p-4">
          <section className="mx-auto w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h1 className="text-2xl font-bold">Start Shift</h1>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-slate-700">Name</span>
              <input
                value={starterName}
                onChange={(event) => setStarterName(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-slate-950"
                autoFocus
              />
            </label>
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-700">Signature</p>
              <canvas
                ref={signatureCanvasRef}
                width={480}
                height={180}
                onPointerDown={startSignature}
                onPointerMove={drawSignature}
                onPointerUp={endSignature}
                onPointerCancel={endSignature}
                className="mt-1 h-36 w-full touch-none rounded-lg border border-slate-300 bg-white"
              />
              <button
                type="button"
                onClick={clearSignature}
                className="mt-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950"
              >
                Clear Signature
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsStartOpen(false)}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStartShift}
                className="min-h-12 rounded-lg bg-slate-950 px-4 font-bold text-white"
              >
                Start
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { shiftStartedAt } = usePatrol();

  if (!shiftStartedAt) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-[#b9e4f7] shadow-sm">
        <StartShiftScreen />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto min-h-screen max-w-md bg-[#b9e4f7] pb-28 shadow-sm">
        {children}
      </div>
      <BottomNavigation />
    </>
  );
}
