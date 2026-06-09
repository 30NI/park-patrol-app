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
import { sampleRentals } from "@/data/sampleRentals";
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
type PersistedPatrolState = {
  version: 1;
  rentals: Rental[];
  washroomCheckedAt: WashroomCheckTimes;
  garbageCheckedAt: GarbageCheckTimes;
  lightTaskStates: Record<string, LightTaskState>;
  activityLog: ActivityLogEntry[];
};

type PatrolContextValue = {
  washroomStatuses: WashroomStatuses;
  washroomCheckedAt: WashroomCheckTimes;
  garbageStatuses: GarbageStatuses;
  garbageCheckedAt: GarbageCheckTimes;
  rentals: Rental[];
  lightTaskStates: Record<string, LightTaskState>;
  activityLog: ActivityLogEntry[];
  addRental: (rental: RentalInput) => string;
  importRentals: (rentals: RentalInput[]) => void;
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
};

const minimumCheckMinutes = 30;
const storageKey = "park-patrol-state-v1";

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

function readPersistedState() {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const savedState = window.localStorage.getItem(storageKey);

    if (!savedState) {
      return null;
    }

    const parsedState = JSON.parse(savedState) as Partial<PersistedPatrolState>;

    return {
      rentals: Array.isArray(parsedState.rentals)
        ? parsedState.rentals
        : sampleRentals,
      washroomCheckedAt: mergeWashroomCheckTimes(parsedState.washroomCheckedAt),
      garbageCheckedAt: mergeGarbageCheckTimes(parsedState.garbageCheckedAt),
      lightTaskStates: parsedState.lightTaskStates ?? {},
      activityLog: Array.isArray(parsedState.activityLog)
        ? parsedState.activityLog
        : [],
    };
  } catch {
    return null;
  }
}

export function PatrolProvider({ children }: { children: ReactNode }) {
  const [washroomCheckedAt, setWashroomCheckedAt] =
    useState<WashroomCheckTimes>(initialWashroomCheckedAt);
  const [garbageCheckedAt, setGarbageCheckedAt] =
    useState<GarbageCheckTimes>(initialGarbageCheckedAt);
  const [rentals, setRentals] = useState<Rental[]>(sampleRentals);
  const [lightTaskStates, setLightTaskStates] = useState<
    Record<string, LightTaskState>
  >({});
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSavedState = window.setTimeout(() => {
      const savedState = readPersistedState();

      if (savedState) {
        setWashroomCheckedAt(savedState.washroomCheckedAt);
        setGarbageCheckedAt(savedState.garbageCheckedAt);
        setRentals(savedState.rentals);
        setLightTaskStates(savedState.lightTaskStates);
        setActivityLog(savedState.activityLog);
      }

      setHasLoadedSavedState(true);
    }, 0);

    return () => window.clearTimeout(loadSavedState);
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedState) {
      return;
    }

    const persistedState: PersistedPatrolState = {
      version: 1,
      rentals,
      washroomCheckedAt,
      garbageCheckedAt,
      lightTaskStates,
      activityLog,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(persistedState));
  }, [
    activityLog,
    garbageCheckedAt,
    hasLoadedSavedState,
    lightTaskStates,
    rentals,
    washroomCheckedAt,
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

  const value = useMemo(
    () => ({
      washroomStatuses,
      washroomCheckedAt,
      garbageStatuses,
      garbageCheckedAt,
      rentals,
      lightTaskStates,
      activityLog,
      addRental,
      importRentals,
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
    }),
    [
      activityLog,
      addActivity,
      addRental,
      importRentals,
      canUndoTimedCheck,
      checkGarbage,
      checkRental,
      checkWashroom,
      garbageCheckedAt,
      garbageStatuses,
      lightTaskStates,
      rentals,
      setRentalGrooming,
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
