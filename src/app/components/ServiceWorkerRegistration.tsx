"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const shiftRoutes = [
  "/",
  "/washrooms",
  "/rentals",
  "/lights",
  "/garbage",
  "/activity",
] as const;

export function ServiceWorkerRegistration() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    function registerServiceWorker() {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("[service-worker] registration failed", error);
      });
    }

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker);
    }

    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  useEffect(() => {
    shiftRoutes.forEach((route) => router.prefetch(route));
  }, [router]);

  return null;
}
