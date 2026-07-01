"use client";
import type { ParkName } from "@/constants/parks";
import type { TimedCheckStatus } from "@/types/activity";

type ParkCheckCardProps = {
  park: ParkName;
  label?: string;
  status: TimedCheckStatus | null;
  checkedLabel: string | null;
  baseClassName: string;
  statusClassNames: Record<TimedCheckStatus, string>;
  checkButtonClassName: string;
  isCentered?: boolean;
  isMenuOpen: boolean;
  canUndo: boolean;
  undoLabel: string;
  onToggleMenu: () => void;
  onCheck: () => void;
  onUndo: () => void;
};

function getParkTitleClassName(label: string) {
  return label.length > 18
    ? "text-[1.7rem] font-bold leading-[1.08]"
    : "text-[2rem] font-bold leading-[1.08]";
}

export function ParkCheckCard({
  park,
  label = park,
  status,
  checkedLabel,
  baseClassName,
  statusClassNames,
  checkButtonClassName,
  isCentered = false,
  isMenuOpen,
  canUndo,
  undoLabel,
  onToggleMenu,
  onCheck,
  onUndo,
}: ParkCheckCardProps) {
  return (
    <article
      className={`relative aspect-square min-h-36 rounded-2xl border-[6px] p-4 shadow-sm ${
        isCentered ? "col-span-2 mx-auto w-[calc(50%-0.375rem)]" : ""
      } ${status ? statusClassNames[status] : baseClassName}`}
    >
      <button
        type="button"
        onClick={onToggleMenu}
        className="absolute right-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-base font-bold text-slate-700 shadow-[0_1px_5px_rgba(15,23,42,0.18)]"
        aria-label={`Open options for ${park}`}
      >
        ...
      </button>

      {isMenuOpen ? (
        <div className="absolute right-3 top-[3.25rem] z-30 min-w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="block min-h-10 w-full rounded-lg px-3 text-left text-xs font-bold text-slate-950 disabled:text-slate-300"
          >
            {undoLabel}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onCheck}
        className="absolute inset-4 flex flex-col items-start justify-between pb-1 text-left transition active:scale-[0.98]"
      >
        <span className={`max-w-full pr-9 ${getParkTitleClassName(label)}`}>
          {label}
        </span>
        <span
          className={`mt-4 max-w-full rounded-full px-4 py-1.5 text-sm font-bold shadow-sm ${checkButtonClassName}`}
        >
          {checkedLabel ?? "Check"}
        </span>
      </button>
    </article>
  );
}
