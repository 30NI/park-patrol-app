import type { ParkName } from "@/constants/parks";
import type { LightTask } from "@/types/light";
import type { Rental } from "@/types/rental";
import type { ShiftTimelineTask } from "@/types/shift";
import { minutesToTime, timeToMinutes } from "./time";

type ShiftPlannerInput = {
  rentals: Rental[];
  washroomParks: ParkName[];
  garbageParks: readonly ParkName[];
  lightTasks: LightTask[];
};

function makeSortOrder(time: string, fallback: number) {
  const sortOrder = timeToMinutes(time);

  return sortOrder === 0 && time !== "12:00 AM" ? fallback : sortOrder;
}

type FieldRentalGroup = {
  rental: Rental;
  rentalIds: string[];
  startMinutes: number;
  endMinutes: number;
};

type ParkVisitBatch = {
  park: string;
  fields: FieldRentalGroup[];
  earliestMinutes: number;
  latestMinutes: number;
  originalIndex: number;
};

const SAME_PARK_RENTAL_BUFFER_MINUTES = 5;

function getFieldWorkflowMinutes(
  batch: ParkVisitBatch,
  scheduledMinutes: number,
  fieldIndex: number,
) {
  const spacedMinutes =
    scheduledMinutes + fieldIndex * SAME_PARK_RENTAL_BUFFER_MINUTES;

  if (spacedMinutes <= batch.latestMinutes) {
    return spacedMinutes;
  }

  return Math.max(
    batch.earliestMinutes,
    batch.latestMinutes -
      (batch.fields.length - 1 - fieldIndex) * SAME_PARK_RENTAL_BUFFER_MINUTES,
  );
}

function buildRentalWorkflowTasks(rentals: Rental[]) {
  let previousPark: string | null = null;
  let previousWorkflowMinutes: number | null = null;

  const fieldRentals = new Map<string, { rental: Rental; rentalIds: string[] }>();

  rentals.forEach((rental) => {
    const fieldKey = `${rental.park}|${rental.facility}`;
    const existing = fieldRentals.get(fieldKey);

    if (!existing) {
      fieldRentals.set(fieldKey, { rental, rentalIds: [rental.id] });
      return;
    }

    existing.rentalIds.push(rental.id);

    if (
      makeSortOrder(rental.startTime, Number.MAX_SAFE_INTEGER) <
      makeSortOrder(existing.rental.startTime, Number.MAX_SAFE_INTEGER)
    ) {
      existing.rental = rental;
    }
  });

  const fieldGroups: FieldRentalGroup[] = [...fieldRentals.values()].map(
    ({ rental, rentalIds }) => ({
      rental,
      rentalIds,
      startMinutes: makeSortOrder(rental.startTime, 0),
      endMinutes: makeSortOrder(rental.endTime, Number.MAX_SAFE_INTEGER),
    }),
  );
  const fieldsByPark = fieldGroups.reduce((groups, fieldGroup) => {
    const parkFields = groups.get(fieldGroup.rental.park) ?? [];

    parkFields.push(fieldGroup);
    groups.set(fieldGroup.rental.park, parkFields);

    return groups;
  }, new Map<string, FieldRentalGroup[]>());
  const parkBatches: ParkVisitBatch[] = [];

  [...fieldsByPark.entries()].forEach(([park, parkFields]) => {
    const sortedFields = [...parkFields].sort((a, b) => {
      const startDifference = a.startMinutes - b.startMinutes;

      if (startDifference !== 0) {
        return startDifference;
      }

      return a.endMinutes - b.endMinutes;
    });
    let currentBatch: ParkVisitBatch | null = null;

    sortedFields.forEach((fieldGroup) => {
      if (!currentBatch || fieldGroup.startMinutes > currentBatch.latestMinutes) {
        currentBatch = {
          park,
          fields: [fieldGroup],
          earliestMinutes: fieldGroup.startMinutes,
          latestMinutes: fieldGroup.endMinutes,
          originalIndex: parkBatches.length,
        };
        parkBatches.push(currentBatch);
        return;
      }

      currentBatch.fields.push(fieldGroup);
      currentBatch.earliestMinutes = Math.max(
        currentBatch.earliestMinutes,
        fieldGroup.startMinutes,
      );
      currentBatch.latestMinutes = Math.min(
        currentBatch.latestMinutes,
        fieldGroup.endMinutes,
      );
    });
  });

  const unscheduledBatches = [...parkBatches];
  const scheduledFields: Array<{
    rental: Rental;
    rentalIds: string[];
    workflowTime: string;
    sortOrder: number;
  }> = [];

  while (unscheduledBatches.length > 0) {
    const candidates = unscheduledBatches.map((batch) => {
      const latestStartMinutes =
        batch.latestMinutes -
        (batch.fields.length - 1) * SAME_PARK_RENTAL_BUFFER_MINUTES;
      const travelMinutes =
        previousWorkflowMinutes === null
          ? 0
          : batch.park === previousPark
            ? 5
            : 15;
      const earliestReachableMinutes =
        previousWorkflowMinutes === null
          ? batch.earliestMinutes
          : Math.max(batch.earliestMinutes, previousWorkflowMinutes + travelMinutes);

      return {
        batch,
        earliestReachableMinutes,
        latestStartMinutes,
        canFit: earliestReachableMinutes <= latestStartMinutes,
        samePark: batch.park === previousPark,
      };
    });
    const fittingCandidates = candidates.filter((candidate) => candidate.canFit);
    const selectedCandidate = (
      fittingCandidates.length > 0 ? fittingCandidates : candidates
    ).sort((a, b) => {
      if (a.canFit && b.canFit) {
        const deadlineDifference =
          a.batch.latestMinutes - b.batch.latestMinutes;

        if (deadlineDifference !== 0) {
          return deadlineDifference;
        }
      }

      if (a.samePark !== b.samePark) {
        return a.samePark ? -1 : 1;
      }

      const reachableDifference =
        a.earliestReachableMinutes - b.earliestReachableMinutes;

      if (reachableDifference !== 0) {
        return reachableDifference;
      }

      const deadlineDifference = a.batch.latestMinutes - b.batch.latestMinutes;

      if (deadlineDifference !== 0) {
        return deadlineDifference;
      }

      return a.batch.originalIndex - b.batch.originalIndex;
    })[0];

    if (!selectedCandidate) {
      break;
    }

    const batchIndex = unscheduledBatches.indexOf(selectedCandidate.batch);
    const scheduledMinutes = selectedCandidate.canFit
      ? selectedCandidate.earliestReachableMinutes
      : Math.max(
          selectedCandidate.batch.earliestMinutes,
          selectedCandidate.latestStartMinutes,
        );

    unscheduledBatches.splice(batchIndex, 1);
    selectedCandidate.batch.fields.forEach(({ rental, rentalIds }, fieldIndex) => {
      const fieldWorkflowMinutes = getFieldWorkflowMinutes(
        selectedCandidate.batch,
        scheduledMinutes,
        fieldIndex,
      );

      scheduledFields.push({
        rental,
        rentalIds,
        workflowTime: minutesToTime(fieldWorkflowMinutes),
        sortOrder: fieldWorkflowMinutes,
      });
    });
    previousPark = selectedCandidate.batch.park;
    previousWorkflowMinutes = getFieldWorkflowMinutes(
      selectedCandidate.batch,
      scheduledMinutes,
      selectedCandidate.batch.fields.length - 1,
    );
  }

  return scheduledFields;
}

export function buildShiftTimeline({
  rentals,
  washroomParks,
  garbageParks,
  lightTasks,
}: ShiftPlannerInput): ShiftTimelineTask[] {
  const tasks: ShiftTimelineTask[] = [
    {
      id: "washrooms-start",
      time: "3:00 PM",
      endTime: "5:00 PM",
      sortOrder: timeToMinutes("3:00 PM"),
      category: "washroom",
      title: "First Washroom Check",
      detail: washroomParks.join(", "),
      href: "/washrooms",
    },
    {
      id: "garbage-early",
      time: "3:00 PM",
      endTime: "11:00 PM",
      sortOrder: timeToMinutes("3:00 PM") + 5,
      category: "garbage",
      title: "Garbage / Litter Check",
      detail: `${garbageParks.length} parks`,
      href: "/garbage",
    },
    {
      id: "washrooms-end",
      time: "9:00 PM",
      endTime: "11:00 PM",
      sortOrder: timeToMinutes("9:00 PM"),
      category: "washroom",
      title: "Last Washroom Check",
      detail: "Clean and lock washrooms",
      href: "/washrooms",
    },
  ];

  buildRentalWorkflowTasks(rentals).forEach(({ rental, rentalIds, workflowTime, sortOrder }) => {
    const rentalDetail = `${rental.facility} - ${rental.organization || "Rental"}`;

    tasks.push({
      id: `rental-check-${rental.id}`,
      time: workflowTime,
      endTime: rental.endTime,
      sortOrder,
      category: "rental",
      title: "Check Rental",
      detail: rentalDetail,
      href: "/rentals",
      targetId: rental.id,
      targetIds: rentalIds,
    });
  });

  lightTasks.forEach((task) => {
    tasks.push(
      {
        id: `${task.id}-on`,
        time: task.scheduledOnTime,
        sortOrder: makeSortOrder(task.scheduledOnTime, 0),
        category: "lights",
        title: "Turn Lights On",
        detail: `${task.facility} - ${task.park}`,
        href: "/lights",
        targetId: task.id,
      },
      {
        id: `${task.id}-off`,
        time: task.scheduledOffTime || "11:00 PM",
        sortOrder: makeSortOrder(task.scheduledOffTime || "11:00 PM", 0),
        category: "lights",
        title: "Turn Lights Off",
        detail: `${task.facility} - after rental ends`,
        href: "/lights",
        targetId: task.id,
      },
    );
  });

  return tasks.sort((a, b) => a.sortOrder - b.sortOrder);
}
