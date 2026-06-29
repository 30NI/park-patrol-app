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

function buildRentalWorkflowTasks(rentals: Rental[]) {
  let previousPark: string | null = null;
  let previousWorkflowMinutes: number | null = null;

  return rentals
    .map((rental, index) => ({ rental, index }))
    .sort((a, b) => {
      const startDifference =
        makeSortOrder(a.rental.startTime, Number.MAX_SAFE_INTEGER) -
        makeSortOrder(b.rental.startTime, Number.MAX_SAFE_INTEGER);

      if (startDifference !== 0) {
        return startDifference;
      }

      return a.index - b.index;
    })
    .map(({ rental }) => {
      const rentalStartMinutes = makeSortOrder(rental.startTime, 0);
      const travelMinutes =
        previousWorkflowMinutes === null
          ? 0
          : rental.park === previousPark
            ? 5
            : 15;
      const workflowMinutes =
        previousWorkflowMinutes === null
          ? rentalStartMinutes
          : Math.max(rentalStartMinutes, previousWorkflowMinutes + travelMinutes);

      previousPark = rental.park;
      previousWorkflowMinutes = workflowMinutes;

      return {
        rental,
        workflowTime: minutesToTime(workflowMinutes),
        sortOrder: workflowMinutes,
      };
    });
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

  buildRentalWorkflowTasks(rentals).forEach(({ rental, workflowTime, sortOrder }) => {
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
