"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { parks, type ParkName } from "@/constants/parks";
import type {
  ActivityCategory,
  ActivityLogEntry,
  GarbageCheckType,
  TimedCheckStatus,
  WashroomStatus,
} from "@/types/activity";
import type { LightTaskState } from "@/types/light";
import type { GameGroomingStatus, Rental, RentalInput } from "@/types/rental";

type WashroomStatuses = Record<ParkName, WashroomStatus | null>;
type WashroomCheckTimes = Record<ParkName, string | null>;
type GarbageCheckTimes = Record<ParkName, Record<GarbageCheckType, string | null>>;
type GarbageStatuses = Record<
  ParkName,
  Record<GarbageCheckType, TimedCheckStatus | null>
>;

type CheckResult = "checked" | "too-soon";

export type ShiftReportPhoto = {
  id: string;
  timestamp: string;
  dataUrl: string;
};

export type StoredShiftState = {
  date: string;
  rentals: Rental[];
  washroomCheckedAt: WashroomCheckTimes;
  garbageCheckedAt: GarbageCheckTimes;
  lightTaskStates: Record<string, LightTaskState>;
  activityLog: ActivityLogEntry[];
  startedAt: string | null;
  shiftReportGeneratedAt: string | null;
  endedAt: string | null;
  workerName: string;
  workerSignature: string;
  reportNotes: string[];
  reportPhotos: ShiftReportPhoto[];
  routeTaskOrder: string[];
  routeTaskTimes: Record<string, string>;
};

type PersistedPatrolStateV1 = {
  version: 1;
  rentals: Rental[];
  washroomCheckedAt: WashroomCheckTimes;
  garbageCheckedAt: GarbageCheckTimes;
  lightTaskStates: Record<string, LightTaskState>;
  activityLog: ActivityLogEntry[];
};

type PersistedPatrolStateV2 = {
  version: 2;
  activeShiftDate: string;
  shifts: Record<string, StoredShiftState>;
};

type PatrolContextValue = {
  activeShiftDate: string;
  shiftHistory: Record<string, StoredShiftState>;
  shiftStartedAt: string | null;
  shiftReportGeneratedAt: string | null;
  shiftEndedAt: string | null;
  workerName: string;
  workerSignature: string;
  reportNotes: string[];
  reportPhotos: ShiftReportPhoto[];
  washroomStatuses: WashroomStatuses;
  washroomCheckedAt: WashroomCheckTimes;
  garbageStatuses: GarbageStatuses;
  garbageCheckedAt: GarbageCheckTimes;
  rentals: Rental[];
  lightTaskStates: Record<string, LightTaskState>;
  activityLog: ActivityLogEntry[];
  routeTaskOrder: string[];
  routeTaskTimes: Record<string, string>;
  addRental: (rental: RentalInput) => string;
  importRentals: (rentals: RentalInput[]) => void;
  deleteRental: (rentalId: string) => void;
  clearRentals: () => void;
  checkRental: (rentalId: string) => void;
  undoRental: (rentalId: string) => void;
  setRentalGrooming: (
    rentalId: string,
    groomingStatus: GameGroomingStatus,
  ) => void;
  undoRentalGrooming: (rentalId: string) => void;
  turnLightOn: (taskId: string) => void;
  turnLightOff: (taskId: string) => void;
  undoLightOn: (taskId: string) => void;
  undoLightOff: (taskId: string) => void;
  checkWashroom: (park: ParkName) => CheckResult;
  canUndoTimedCheck: (checkedAt: string | null) => boolean;
  undoWashroom: (park: ParkName) => void;
  checkGarbage: (park: ParkName, type: GarbageCheckType) => CheckResult;
  undoGarbage: (park: ParkName, type: GarbageCheckType) => void;
  addActivity: (entry: {
    park?: string;
    category: ActivityCategory;
    action: string;
    notes?: string;
    targetId?: string;
  }) => void;
  markShiftReportGenerated: () => void;
  startShift: (workerName: string, workerSignature: string) => void;
  endShift: () => void;
  addReportNote: (note: string) => void;
  addReportPhoto: (dataUrl: string) => void;
  setRouteTaskOrder: (taskIds: string[]) => void;
  setRouteTaskTime: (taskId: string, time: string) => void;
  resetRouteEdits: () => void;
  startNewShift: () => void;
  clearLocalData: () => void;
};

const minimumCheckMinutes = 30;
const legacyStorageKey = "park-patrol-state-v1";
const storageKey = "park-patrol-state-v2";

const initialWashroomCheckedAt = parks.reduce((checkedAt, park) => {
  checkedAt[park] = null;
  return checkedAt;
}, {} as WashroomCheckTimes);

const initialGarbageCheckedAt = parks.reduce((checkedAt, park) => {
  checkedAt[park] = {
    litter: null,
    garbageCans: null,
  };
  return checkedAt;
}, {} as GarbageCheckTimes);

const PatrolContext = createContext<PatrolContextValue | null>(null);

function getTimedStatus(checkedAt: string | null, now: Date) {
  if (!checkedAt) {
    return null;
  }

  const elapsedHours =
    (now.getTime() - new Date(checkedAt).getTime()) / (1000 * 60 * 60);

  if (elapsedHours < 2) {
    return "Green";
  }

  if (elapsedHours < 4) {
    return "Yellow";
  }

  return "Red";
}

function canCheckAgain(checkedAt: string | null, now: Date) {
  if (!checkedAt) {
    return true;
  }

  const elapsedMinutes =
    (now.getTime() - new Date(checkedAt).getTime()) / (1000 * 60);

  return elapsedMinutes >= minimumCheckMinutes;
}

function isWithinUndoWindow(checkedAt: string | null, now: Date) {
  if (!checkedAt) {
    return false;
  }

  const elapsedMinutes =
    (now.getTime() - new Date(checkedAt).getTime()) / (1000 * 60);

  return elapsedMinutes < minimumCheckMinutes;
}

function removeLogByTarget(log: ActivityLogEntry[], targetId: string) {
  const index = log.findIndex((entry) => entry.targetId === targetId);

  if (index === -1) {
    return log;
  }

  return [...log.slice(0, index), ...log.slice(index + 1)];
}

function removeRentalLogs(log: ActivityLogEntry[], rentalId: string) {
  const targetIds = new Set([
    `rental-${rentalId}`,
    `manual-entry-${rentalId}`,
    `grooming-${rentalId}`,
    `light-${rentalId}-on`,
    `light-${rentalId}-off`,
  ]);

  return log.filter((entry) => !entry.targetId || !targetIds.has(entry.targetId));
}

function mergeWashroomCheckTimes(saved?: Partial<WashroomCheckTimes>) {
  return parks.reduce((checkedAt, park) => {
    checkedAt[park] = saved?.[park] ?? null;
    return checkedAt;
  }, {} as WashroomCheckTimes);
}

function mergeGarbageCheckTimes(saved?: Partial<GarbageCheckTimes>) {
  return parks.reduce((checkedAt, park) => {
    checkedAt[park] = {
      litter: saved?.[park]?.litter ?? null,
      garbageCans: saved?.[park]?.garbageCans ?? null,
    };
    return checkedAt;
  }, {} as GarbageCheckTimes);
}

function getShiftDate(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function getShiftDateFromTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? "" : getShiftDate(date);
}

function getLatestActivityDate(activityLog: ActivityLogEntry[]) {
  return activityLog.reduce((latestDate, entry) => {
    const entryDate = getShiftDateFromTimestamp(entry.timestamp);

    if (!entryDate) {
      return latestDate;
    }

    return !latestDate || entryDate > latestDate ? entryDate : latestDate;
  }, "");
}

function createEmptyShiftState(date = getShiftDate()): StoredShiftState {
  return {
    date,
    rentals: [],
    washroomCheckedAt: mergeWashroomCheckTimes(),
    garbageCheckedAt: mergeGarbageCheckTimes(),
    lightTaskStates: {},
    activityLog: [],
    startedAt: null,
    shiftReportGeneratedAt: null,
    endedAt: null,
    workerName: "",
    workerSignature: "",
    reportNotes: [],
    reportPhotos: [],
    routeTaskOrder: [],
    routeTaskTimes: {},
  };
}

function normalizeShiftState(
  date: string,
  shift?: Partial<StoredShiftState>,
): StoredShiftState {
  return {
    date,
    rentals: Array.isArray(shift?.rentals) ? shift.rentals : [],
    washroomCheckedAt: mergeWashroomCheckTimes(shift?.washroomCheckedAt),
    garbageCheckedAt: mergeGarbageCheckTimes(shift?.garbageCheckedAt),
    lightTaskStates: shift?.lightTaskStates ?? {},
    activityLog: Array.isArray(shift?.activityLog) ? shift.activityLog : [],
    startedAt: shift?.startedAt ?? null,
    shiftReportGeneratedAt: shift?.shiftReportGeneratedAt ?? null,
    endedAt: shift?.endedAt ?? null,
    workerName: shift?.workerName ?? "",
    workerSignature: shift?.workerSignature ?? "",
    reportNotes: Array.isArray(shift?.reportNotes) ? shift.reportNotes : [],
    reportPhotos: Array.isArray(shift?.reportPhotos)
      ? shift.reportPhotos
      : [],
    routeTaskOrder: Array.isArray(shift?.routeTaskOrder)
      ? shift.routeTaskOrder
      : [],
    routeTaskTimes: shift?.routeTaskTimes ?? {},
  };
}

function migrateV1State(
  parsedState: Partial<PersistedPatrolStateV1>,
): PersistedPatrolStateV2 {
  const today = getShiftDate();
  const activityLog = Array.isArray(parsedState.activityLog)
    ? parsedState.activityLog
    : [];
  const migratedShiftDate = getLatestActivityDate(activityLog) || today;
  const migratedShift = normalizeShiftState(migratedShiftDate, {
    rentals: Array.isArray(parsedState.rentals) ? parsedState.rentals : [],
    washroomCheckedAt: parsedState.washroomCheckedAt,
    garbageCheckedAt: parsedState.garbageCheckedAt,
    lightTaskStates: parsedState.lightTaskStates ?? {},
    activityLog,
  });
  const activeShiftDate = today;
  const shifts: Record<string, StoredShiftState> = {
    [migratedShiftDate]: migratedShift,
  };

  if (!shifts[today]) {
    shifts[today] = createEmptyShiftState(today);
  }

  return {
    version: 2,
    activeShiftDate,
    shifts,
  };
}

function readPersistedState() {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const savedState =
      window.localStorage.getItem(storageKey) ??
      window.localStorage.getItem(legacyStorageKey);

    if (!savedState) {
      return null;
    }

    const parsedState = JSON.parse(savedState) as
      | Partial<PersistedPatrolStateV1>
      | Partial<PersistedPatrolStateV2>;

    if (parsedState.version !== 2) {
      return migrateV1State(parsedState as Partial<PersistedPatrolStateV1>);
    }

    const persistedV2 = parsedState as Partial<PersistedPatrolStateV2>;
    const today = getShiftDate();
    const activeShiftDate = persistedV2.activeShiftDate ?? today;
    const shifts = Object.entries(persistedV2.shifts ?? {}).reduce(
      (normalizedShifts, [date, shift]) => {
        normalizedShifts[date] = normalizeShiftState(date, shift);
        return normalizedShifts;
      },
      {} as Record<string, StoredShiftState>,
    );

    if (!shifts[activeShiftDate]) {
      shifts[activeShiftDate] = createEmptyShiftState(activeShiftDate);
    }

    return {
      version: 2,
      activeShiftDate,
      shifts,
    };
  } catch {
    return null;
  }
}

export function PatrolProvider({ children }: { children: ReactNode }) {
  const [activeShiftDate, setActiveShiftDate] = useState(() => getShiftDate());
  const [shiftHistory, setShiftHistory] = useState<
    Record<string, StoredShiftState>
  >({});
  const [shiftStartedAt, setShiftStartedAt] = useState<string | null>(null);
  const [shiftReportGeneratedAt, setShiftReportGeneratedAt] = useState<
    string | null
  >(null);
  const [shiftEndedAt, setShiftEndedAt] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState("");
  const [workerSignature, setWorkerSignature] = useState("");
  const [reportNotes, setReportNotes] = useState<string[]>([]);
  const [reportPhotos, setReportPhotos] = useState<ShiftReportPhoto[]>([]);
  const [washroomCheckedAt, setWashroomCheckedAt] =
    useState<WashroomCheckTimes>(initialWashroomCheckedAt);
  const [garbageCheckedAt, setGarbageCheckedAt] =
    useState<GarbageCheckTimes>(initialGarbageCheckedAt);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [lightTaskStates, setLightTaskStates] = useState<
    Record<string, LightTaskState>
  >({});
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [routeTaskOrder, setRouteTaskOrderState] = useState<string[]>([]);
  const [routeTaskTimes, setRouteTaskTimes] = useState<Record<string, string>>(
    {},
  );
  const [now, setNow] = useState(() => new Date());
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSavedState = window.setTimeout(() => {
      const today = getShiftDate();
      const savedState = readPersistedState();
      const shifts = savedState?.shifts ?? {};
      const nextActiveShiftDate =
        savedState?.activeShiftDate === today
          ? savedState.activeShiftDate
          : today;

      if (!shifts[nextActiveShiftDate]) {
        shifts[nextActiveShiftDate] = createEmptyShiftState(nextActiveShiftDate);
      }

      const activeShift = shifts[nextActiveShiftDate];

      setActiveShiftDate(nextActiveShiftDate);
      setShiftHistory(shifts);
      setShiftStartedAt(activeShift.startedAt);
      setShiftReportGeneratedAt(activeShift.shiftReportGeneratedAt);
      setShiftEndedAt(activeShift.endedAt);
      setWorkerName(activeShift.workerName);
      setWorkerSignature(activeShift.workerSignature);
      setReportNotes(activeShift.reportNotes);
      setReportPhotos(activeShift.reportPhotos);
      setWashroomCheckedAt(activeShift.washroomCheckedAt);
      setGarbageCheckedAt(activeShift.garbageCheckedAt);
      setRentals(activeShift.rentals);
      setLightTaskStates(activeShift.lightTaskStates);
      setActivityLog(activeShift.activityLog);
      setRouteTaskOrderState(activeShift.routeTaskOrder);
      setRouteTaskTimes(activeShift.routeTaskTimes);

      setHasLoadedSavedState(true);
    }, 0);

    return () => window.clearTimeout(loadSavedState);
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedState) {
      return;
    }

    const currentShift: StoredShiftState = {
      date: activeShiftDate,
      rentals,
      washroomCheckedAt,
      garbageCheckedAt,
      lightTaskStates,
      activityLog,
      startedAt: shiftStartedAt,
      shiftReportGeneratedAt,
      endedAt: shiftEndedAt,
      workerName,
      workerSignature,
      reportNotes,
      reportPhotos,
      routeTaskOrder,
      routeTaskTimes,
    };
    const persistedState: PersistedPatrolStateV2 = {
      version: 2,
      activeShiftDate,
      shifts: {
        ...shiftHistory,
        [activeShiftDate]: currentShift,
      },
    };

    window.localStorage.setItem(storageKey, JSON.stringify(persistedState));
    window.localStorage.removeItem(legacyStorageKey);
  }, [
    activityLog,
    activeShiftDate,
    garbageCheckedAt,
    hasLoadedSavedState,
    lightTaskStates,
    reportNotes,
    reportPhotos,
    rentals,
    routeTaskOrder,
    routeTaskTimes,
    shiftHistory,
    shiftEndedAt,
    shiftReportGeneratedAt,
    shiftStartedAt,
    washroomCheckedAt,
    workerName,
    workerSignature,
  ]);

  const washroomStatuses = useMemo(
    () =>
      parks.reduce((statuses, park) => {
        statuses[park] = getTimedStatus(washroomCheckedAt[park], now);
        return statuses;
      }, {} as WashroomStatuses),
    [now, washroomCheckedAt],
  );

  const garbageStatuses = useMemo(
    () =>
      parks.reduce((statuses, park) => {
        statuses[park] = {
          litter: getTimedStatus(garbageCheckedAt[park].litter, now),
          garbageCans: getTimedStatus(garbageCheckedAt[park].garbageCans, now),
        };
        return statuses;
      }, {} as GarbageStatuses),
    [garbageCheckedAt, now],
  );

  const addActivity = useCallback(
    ({
      park,
      category,
      action,
      notes,
      targetId,
    }: {
      park?: string;
      category: ActivityCategory;
      action: string;
      notes?: string;
      targetId?: string;
    }) => {
      const entry: ActivityLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        park,
        category,
        action,
        notes,
        targetId,
      };

      setActivityLog((current) => [entry, ...current]);
    },
    [],
  );

  const markShiftReportGenerated = useCallback(() => {
    setShiftReportGeneratedAt(new Date().toISOString());
  }, []);

  const startShift = useCallback((name: string, signature: string) => {
    const startedAt = new Date().toISOString();
    const startShiftEntry: ActivityLogEntry = {
      id: crypto.randomUUID(),
      timestamp: startedAt,
      category: "report",
      action: "Shift started",
      notes: name.trim(),
    };

    setShiftStartedAt(startedAt);
    setShiftEndedAt(null);
    setWorkerName(name.trim());
    setWorkerSignature(signature);
    setActivityLog((current) => [startShiftEntry, ...current]);
  }, []);

  const addReportNote = useCallback((note: string) => {
    const trimmedNote = note.trim();

    if (!trimmedNote) {
      return;
    }

    setReportNotes((current) => [...current, trimmedNote]);
    setActivityLog((current) => [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: "report",
        action: "Shift note added",
        notes: trimmedNote,
      },
      ...current,
    ]);
  }, []);

  const addReportPhoto = useCallback((dataUrl: string) => {
    const timestamp = new Date().toISOString();

    setReportPhotos((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        timestamp,
        dataUrl,
      },
    ]);
    setActivityLog((current) => [
      {
        id: crypto.randomUUID(),
        timestamp,
        category: "report",
        action: "Shift photo added",
      },
      ...current,
    ]);
  }, []);

  const endShift = useCallback(() => {
    const endedAt = new Date().toISOString();
    const endShiftEntry: ActivityLogEntry = {
      id: crypto.randomUUID(),
      timestamp: endedAt,
      category: "report",
      action: "Shift ended",
    };
    const endedActivityLog = [endShiftEntry, ...activityLog];
    const currentShift: StoredShiftState = {
      date: activeShiftDate,
      rentals,
      washroomCheckedAt,
      garbageCheckedAt,
      lightTaskStates,
      activityLog: endedActivityLog,
      startedAt: shiftStartedAt,
      shiftReportGeneratedAt,
      endedAt,
      workerName,
      workerSignature,
      reportNotes,
      reportPhotos,
      routeTaskOrder,
      routeTaskTimes,
    };

    setActivityLog(endedActivityLog);
    setShiftEndedAt(endedAt);
    setShiftHistory((current) => ({
      ...current,
      [activeShiftDate]: currentShift,
    }));
  }, [
    activeShiftDate,
    activityLog,
    garbageCheckedAt,
    lightTaskStates,
    reportNotes,
    reportPhotos,
    rentals,
    routeTaskOrder,
    routeTaskTimes,
    shiftReportGeneratedAt,
    shiftStartedAt,
    washroomCheckedAt,
    workerName,
    workerSignature,
  ]);

  const startNewShift = useCallback(() => {
    const today = getShiftDate();
    const currentShift: StoredShiftState = {
      date: activeShiftDate,
      rentals,
      washroomCheckedAt,
      garbageCheckedAt,
      lightTaskStates,
      activityLog,
      startedAt: shiftStartedAt,
      shiftReportGeneratedAt,
      endedAt: shiftEndedAt,
      workerName,
      workerSignature,
      reportNotes,
      reportPhotos,
      routeTaskOrder,
      routeTaskTimes,
    };
    const nextShift = createEmptyShiftState(today);

    setActiveShiftDate(today);
    setShiftHistory((current) => ({
      ...current,
      [activeShiftDate]: currentShift,
      [today]: nextShift,
    }));
    setShiftStartedAt(nextShift.startedAt);
    setShiftReportGeneratedAt(nextShift.shiftReportGeneratedAt);
    setShiftEndedAt(nextShift.endedAt);
    setWorkerName(nextShift.workerName);
    setWorkerSignature(nextShift.workerSignature);
    setReportNotes(nextShift.reportNotes);
    setReportPhotos(nextShift.reportPhotos);
    setWashroomCheckedAt(nextShift.washroomCheckedAt);
    setGarbageCheckedAt(nextShift.garbageCheckedAt);
    setRentals(nextShift.rentals);
    setLightTaskStates(nextShift.lightTaskStates);
    setActivityLog(nextShift.activityLog);
    setRouteTaskOrderState(nextShift.routeTaskOrder);
    setRouteTaskTimes(nextShift.routeTaskTimes);
  }, [
    activeShiftDate,
    activityLog,
    garbageCheckedAt,
    lightTaskStates,
    reportNotes,
    reportPhotos,
    rentals,
    routeTaskOrder,
    routeTaskTimes,
    shiftEndedAt,
    shiftReportGeneratedAt,
    shiftStartedAt,
    washroomCheckedAt,
    workerName,
    workerSignature,
  ]);

  const clearLocalData = useCallback(() => {
    const today = getShiftDate();
    const nextShift = createEmptyShiftState(today);

    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(legacyStorageKey);
    setActiveShiftDate(today);
    setShiftHistory({ [today]: nextShift });
    setShiftStartedAt(nextShift.startedAt);
    setShiftReportGeneratedAt(nextShift.shiftReportGeneratedAt);
    setShiftEndedAt(nextShift.endedAt);
    setWorkerName(nextShift.workerName);
    setWorkerSignature(nextShift.workerSignature);
    setReportNotes(nextShift.reportNotes);
    setReportPhotos(nextShift.reportPhotos);
    setWashroomCheckedAt(nextShift.washroomCheckedAt);
    setGarbageCheckedAt(nextShift.garbageCheckedAt);
    setRentals(nextShift.rentals);
    setLightTaskStates(nextShift.lightTaskStates);
    setActivityLog(nextShift.activityLog);
    setRouteTaskOrderState(nextShift.routeTaskOrder);
    setRouteTaskTimes(nextShift.routeTaskTimes);
  }, []);

  const setRouteTaskOrder = useCallback((taskIds: string[]) => {
    setRouteTaskOrderState(taskIds);
  }, []);

  const setRouteTaskTime = useCallback((taskId: string, time: string) => {
    setRouteTaskTimes((current) => ({
      ...current,
      [taskId]: time,
    }));
  }, []);

  const resetRouteEdits = useCallback(() => {
    setRouteTaskOrderState([]);
    setRouteTaskTimes({});
  }, []);

  const addRental = useCallback(
    (rentalInput: RentalInput) => {
      const rentalId = `manual-rental-${crypto.randomUUID()}`;
      const rental: Rental = {
        id: rentalId,
        checkedIn: false,
        ...rentalInput,
      };

      setRentals((current) => [...current, rental]);
      addActivity({
        park: rental.park,
        category: "rental",
        action: `Rental entered manually - ${rental.facility}`,
        targetId: `manual-entry-${rentalId}`,
      });

      return rentalId;
    },
    [addActivity],
  );

  const importRentals = useCallback(
    (rentalInputs: RentalInput[]) => {
      if (rentalInputs.length === 0) {
        return;
      }

      const importedRentals = rentalInputs.map((rentalInput) => ({
        id: `imported-rental-${crypto.randomUUID()}`,
        checkedIn: false,
        ...rentalInput,
      }));

      setRentals((current) => [...current, ...importedRentals]);
      addActivity({
        category: "rental",
        action: "Rental sheet imported",
        notes: `${importedRentals.length} rental${
          importedRentals.length === 1 ? "" : "s"
        } added`,
      });
    },
    [addActivity],
  );

  const deleteRental = useCallback(
    (rentalId: string) => {
      const rental = rentals.find((item) => item.id === rentalId);

      if (!rental) {
        return;
      }

      setRentals((current) => current.filter((item) => item.id !== rentalId));
      setLightTaskStates((current) => {
        const next = { ...current };
        delete next[`light-${rentalId}`];
        return next;
      });
      setActivityLog((current) => removeRentalLogs(current, rentalId));
      addActivity({
        park: rental.park,
        category: "rental",
        action: `Rental deleted - ${rental.facility}`,
      });
    },
    [addActivity, rentals],
  );

  const clearRentals = useCallback(() => {
    if (rentals.length === 0) {
      return;
    }

    setRentals([]);
    setLightTaskStates({});
    setActivityLog((current) =>
      current.filter(
        (entry) => entry.category !== "rental" && entry.category !== "lights",
      ),
    );
    addActivity({
      category: "rental",
      action: "All rentals cleared",
      notes: `${rentals.length} rental${rentals.length === 1 ? "" : "s"} removed`,
    });
  }, [addActivity, rentals.length]);

  const checkRental = useCallback(
    (rentalId: string) => {
      const rental = rentals.find((item) => item.id === rentalId);

      if (!rental || rental.checkedIn) {
        return;
      }

      setRentals((current) =>
        current.map((item) =>
          item.id === rentalId ? { ...item, checkedIn: true } : item,
        ),
      );
      addActivity({
        park: rental.park,
        category: "rental",
        action: "Rental checked",
        targetId: `rental-${rentalId}`,
      });
    },
    [addActivity, rentals],
  );

  const canUndoTimedCheck = useCallback(
    (checkedAt: string | null) => isWithinUndoWindow(checkedAt, now),
    [now],
  );

  const undoRental = useCallback(
    (rentalId: string) => {
      const rental = rentals.find((item) => item.id === rentalId);

      setRentals((current) =>
        current.map((item) =>
          item.id === rentalId ? { ...item, checkedIn: false } : item,
        ),
      );
      setActivityLog((current) =>
        removeLogByTarget(current, `rental-${rentalId}`),
      );

      if (rental) {
        addActivity({
          park: rental.park,
          category: "rental",
          action: "Rental check undone",
          notes: rental.facility,
        });
      }
    },
    [addActivity, rentals],
  );

  const setRentalGrooming = useCallback(
    (rentalId: string, groomingStatus: GameGroomingStatus) => {
      const rental = rentals.find((item) => item.id === rentalId);

      if (!rental) {
        return;
      }

      setRentals((current) =>
        current.map((item) =>
          item.id === rentalId ? { ...item, groomingStatus } : item,
        ),
      );
      addActivity({
        park: rental.park,
        category: "rental",
        action:
          groomingStatus === "alreadyGroomed"
            ? `Game already groomed - ${rental.facility}`
            : `Game groomed on shift - ${rental.facility}`,
        targetId: `grooming-${rentalId}`,
      });
    },
    [addActivity, rentals],
  );

  const undoRentalGrooming = useCallback(
    (rentalId: string) => {
      const rental = rentals.find((item) => item.id === rentalId);

      setRentals((current) =>
        current.map((item) =>
          item.id === rentalId ? { ...item, groomingStatus: undefined } : item,
        ),
      );
      setActivityLog((current) =>
        removeLogByTarget(current, `grooming-${rentalId}`),
      );

      if (rental) {
        addActivity({
          park: rental.park,
          category: "rental",
          action: "Game grooming status undone",
          notes: rental.facility,
        });
      }
    },
    [addActivity, rentals],
  );

  const turnLightOn = useCallback(
    (taskId: string) => {
      const rentalId = taskId.replace(/^light-/, "");
      const rental = rentals.find((item) => item.id === rentalId);

      if (!rental || lightTaskStates[taskId]?.turnedOn) {
        return;
      }

      const checkedAt = new Date().toISOString();
      setLightTaskStates((current) => ({
        ...current,
        [taskId]: {
          turnedOn: true,
          turnedOff: current[taskId]?.turnedOff ?? false,
          turnedOnAt: checkedAt,
          turnedOffAt: current[taskId]?.turnedOffAt ?? null,
        },
      }));
      addActivity({
        park: rental.park,
        category: "lights",
        action: `Lights turned on - ${rental.facility}`,
        targetId: `${taskId}-on`,
      });
    },
    [addActivity, lightTaskStates, rentals],
  );

  const turnLightOff = useCallback(
    (taskId: string) => {
      const rentalId = taskId.replace(/^light-/, "");
      const rental = rentals.find((item) => item.id === rentalId);

      if (!rental || lightTaskStates[taskId]?.turnedOff) {
        return;
      }

      const checkedAt = new Date().toISOString();
      setLightTaskStates((current) => ({
        ...current,
        [taskId]: {
          turnedOn: current[taskId]?.turnedOn ?? false,
          turnedOff: true,
          turnedOnAt: current[taskId]?.turnedOnAt ?? null,
          turnedOffAt: checkedAt,
        },
      }));
      addActivity({
        park: rental.park,
        category: "lights",
        action: `Lights turned off - ${rental.facility}`,
        targetId: `${taskId}-off`,
      });
    },
    [addActivity, lightTaskStates, rentals],
  );

  const undoLightOn = useCallback(
    (taskId: string) => {
      const rentalId = taskId.replace(/^light-/, "");
      const rental = rentals.find((item) => item.id === rentalId);

      setLightTaskStates((current) => ({
        ...current,
        [taskId]: {
          turnedOn: false,
          turnedOff: false,
          turnedOnAt: null,
          turnedOffAt: null,
        },
      }));
      setActivityLog((current) => removeLogByTarget(current, `${taskId}-on`));
      setActivityLog((current) => removeLogByTarget(current, `${taskId}-off`));

      if (rental) {
        addActivity({
          park: rental.park,
          category: "lights",
          action: "Lights-on check undone",
          notes: rental.facility,
        });
      }
    },
    [addActivity, rentals],
  );

  const undoLightOff = useCallback(
    (taskId: string) => {
      const rentalId = taskId.replace(/^light-/, "");
      const rental = rentals.find((item) => item.id === rentalId);

      setLightTaskStates((current) => ({
        ...current,
        [taskId]: {
          turnedOn: current[taskId]?.turnedOn ?? false,
          turnedOff: false,
          turnedOnAt: current[taskId]?.turnedOnAt ?? null,
          turnedOffAt: null,
        },
      }));
      setActivityLog((current) => removeLogByTarget(current, `${taskId}-off`));

      if (rental) {
        addActivity({
          park: rental.park,
          category: "lights",
          action: "Lights-off check undone",
          notes: rental.facility,
        });
      }
    },
    [addActivity, rentals],
  );

  const checkWashroom = useCallback(
    (park: ParkName) => {
      const checkTime = new Date();

      if (!canCheckAgain(washroomCheckedAt[park], checkTime)) {
        return "too-soon";
      }

      setWashroomCheckedAt((current) => ({
        ...current,
        [park]: checkTime.toISOString(),
      }));
      addActivity({
        park,
        category: "washroom",
        action: "Washroom checked",
        targetId: `washroom-${park}`,
      });

      return "checked";
    },
    [addActivity, washroomCheckedAt],
  );

  const undoWashroom = useCallback(
    (park: ParkName) => {
      setWashroomCheckedAt((current) => ({
        ...current,
        [park]: null,
      }));
      setActivityLog((current) => removeLogByTarget(current, `washroom-${park}`));
      addActivity({
        park,
        category: "washroom",
        action: "Washroom check undone",
      });
    },
    [addActivity],
  );

  const checkGarbage = useCallback(
    (park: ParkName, type: GarbageCheckType) => {
      const checkTime = new Date();

      if (!canCheckAgain(garbageCheckedAt[park][type], checkTime)) {
        return "too-soon";
      }

      setGarbageCheckedAt((current) => ({
        ...current,
        [park]: {
          ...current[park],
          [type]: checkTime.toISOString(),
        },
      }));
      addActivity({
        park,
        category: "garbage",
        action: type === "litter" ? "Litter checked" : "Garbage cans checked",
        targetId: `garbage-${park}-${type}`,
      });

      return "checked";
    },
    [addActivity, garbageCheckedAt],
  );

  const undoGarbage = useCallback(
    (park: ParkName, type: GarbageCheckType) => {
      setGarbageCheckedAt((current) => ({
        ...current,
        [park]: {
          ...current[park],
          [type]: null,
        },
      }));
      setActivityLog((current) =>
        removeLogByTarget(current, `garbage-${park}-${type}`),
      );
      addActivity({
        park,
        category: "garbage",
        action:
          type === "litter"
            ? "Litter check undone"
            : "Garbage cans check undone",
      });
    },
    [addActivity],
  );

  const currentShiftHistory = useMemo(
    () => ({
      ...shiftHistory,
      [activeShiftDate]: {
        date: activeShiftDate,
        rentals,
        washroomCheckedAt,
        garbageCheckedAt,
        lightTaskStates,
        activityLog,
        startedAt: shiftStartedAt,
        shiftReportGeneratedAt,
        endedAt: shiftEndedAt,
        workerName,
        workerSignature,
        reportNotes,
        reportPhotos,
        routeTaskOrder,
        routeTaskTimes,
      },
    }),
    [
      activeShiftDate,
      activityLog,
      garbageCheckedAt,
      lightTaskStates,
      reportNotes,
      reportPhotos,
      rentals,
      routeTaskOrder,
      routeTaskTimes,
      shiftHistory,
      shiftEndedAt,
      shiftReportGeneratedAt,
      shiftStartedAt,
      washroomCheckedAt,
      workerName,
      workerSignature,
    ],
  );

  const value = useMemo(
    () => ({
      activeShiftDate,
      shiftHistory: currentShiftHistory,
      shiftStartedAt,
      shiftReportGeneratedAt,
      shiftEndedAt,
      workerName,
      workerSignature,
      reportNotes,
      reportPhotos,
      washroomStatuses,
      washroomCheckedAt,
      garbageStatuses,
      garbageCheckedAt,
      rentals,
      lightTaskStates,
      activityLog,
      routeTaskOrder,
      routeTaskTimes,
      addRental,
      importRentals,
      deleteRental,
      clearRentals,
      checkRental,
      undoRental,
      setRentalGrooming,
      undoRentalGrooming,
      turnLightOn,
      turnLightOff,
      undoLightOn,
      undoLightOff,
      checkWashroom,
      canUndoTimedCheck,
      undoWashroom,
      checkGarbage,
      undoGarbage,
      addActivity,
      markShiftReportGenerated,
      startShift,
      endShift,
      addReportNote,
      addReportPhoto,
      setRouteTaskOrder,
      setRouteTaskTime,
      resetRouteEdits,
      startNewShift,
      clearLocalData,
    }),
    [
      activeShiftDate,
      activityLog,
      addActivity,
      addRental,
      addReportNote,
      addReportPhoto,
      clearLocalData,
      clearRentals,
      currentShiftHistory,
      deleteRental,
      endShift,
      importRentals,
      canUndoTimedCheck,
      checkGarbage,
      checkRental,
      checkWashroom,
      garbageCheckedAt,
      garbageStatuses,
      lightTaskStates,
      markShiftReportGenerated,
      reportNotes,
      reportPhotos,
      rentals,
      resetRouteEdits,
      routeTaskOrder,
      routeTaskTimes,
      setRentalGrooming,
      setRouteTaskOrder,
      setRouteTaskTime,
      shiftEndedAt,
      shiftReportGeneratedAt,
      shiftStartedAt,
      startShift,
      startNewShift,
      turnLightOff,
      turnLightOn,
      undoGarbage,
      undoLightOff,
      undoLightOn,
      undoRental,
      undoRentalGrooming,
      undoWashroom,
      washroomCheckedAt,
      washroomStatuses,
      workerName,
      workerSignature,
    ],
  );

  return (
    <PatrolContext.Provider value={value}>{children}</PatrolContext.Provider>
  );
}

export function usePatrol() {
  const context = useContext(PatrolContext);

  if (!context) {
    throw new Error("usePatrol must be used within PatrolProvider");
  }

  return context;
}
