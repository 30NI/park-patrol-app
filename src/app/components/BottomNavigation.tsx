"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavIconProps = {
  className?: string;
};

function PaperIcon({ className }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7 3.75h7.1L18 7.65v12.6H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.75v4h4M9.75 11h5.5M9.75 14h5.5M9.75 17h3.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WashroomIcon({ className }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 4v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="5" r="1.8" fill="currentColor" />
      <path
        d="M4.8 9.2h4.4l.8 6H8.4V20H5.6v-4.8H4z"
        fill="currentColor"
      />
      <circle cx="17" cy="5" r="1.8" fill="currentColor" />
      <path
        d="M15.1 9.2h3.8l1.5 6h-2V20h-2.8v-4.8h-2z"
        fill="currentColor"
      />
    </svg>
  );
}

function SportsIcon({ className }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle
        cx="8"
        cy="12"
        r="4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5.4 8.5 8 10.4l2.6-1.9M6.3 15.8 8 12.7l1.7 3.1M3.8 12h3.1M9.1 12h3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="16.8"
        cy="12"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M15.2 9.1c1.1 1.8 1.1 4 0 5.8M18.4 9.1c-1.1 1.8-1.1 4 0 5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LightIcon({ className }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M8.4 13.6c-1-1-1.6-2.4-1.6-4A5.2 5.2 0 0 1 12 4.4a5.2 5.2 0 0 1 5.2 5.2c0 1.6-.6 3-1.6 4-.8.8-1.2 1.4-1.3 2.2H9.7c-.1-.8-.5-1.4-1.3-2.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 18h4M10.6 21h2.8M12 1.8v1M4.5 5.1l.8.8M19.5 5.1l-.8.8M2.8 10h1.1M20.1 10h1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon({ className }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M7.5 8.2h9l-.8 12H8.3zM6 8.2h12M9.5 8.2V5.5h5v2.7M9.8 11.2v6M12 11.2v6M14.2 11.2v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M5.5 12.5 10 17l8.8-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 4.8h10.5A2.5 2.5 0 0 1 19 7.3v9.4a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 4 16.7v-10A2.5 2.5 0 0 1 6.5 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const tabs = [
  { href: "/", label: "Dash", Icon: PaperIcon },
  { href: "/washrooms", label: "Wash", Icon: WashroomIcon },
  { href: "/rentals", label: "Rentals", Icon: SportsIcon },
  { href: "/lights", label: "Lights", Icon: LightIcon },
  { href: "/garbage", label: "Trash", Icon: TrashIcon },
  { href: "/activity", label: "Log", Icon: CheckIcon },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t-4 border-white bg-[#b9e4f7]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-lg backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.Icon;
          const activeClassName =
            tab.href === "/washrooms"
              ? "border-[#0b1f4d] bg-[#2563eb] text-white shadow-sm"
              : tab.href === "/garbage"
                ? "border-slate-950 bg-slate-300 text-slate-950 shadow-sm"
                : "border-slate-950 bg-slate-950 text-white shadow-sm";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 text-[11px] font-bold leading-tight transition ${
                isActive
                  ? activeClassName
                  : "border-transparent text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
