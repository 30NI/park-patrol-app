import type { ParkName } from "@/constants/parks";
import type { LightTask } from "@/types/light";
import type { Rental } from "@/types/rental";
import type { ShiftTimelineTask } from "@/types/shift";
import { timeToMinutes } from "./time";

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

export function buildShiftTimeline({
  rentals,
  washroomParks,
  garbageParks,
  lightTasks,
}: ShiftPlannerInput): ShiftTimelineTask[] {
  const tasks: ShiftTimelineTask[] = [
    {
      id: "washrooms-start",
      time: "Start",
      sortOrder: -30,
      category: "washroom",
      title: "Check Washrooms",
      detail: washroomParks.join(", "),
      href: "/washrooms",
    },
    {
      id: "garbage-early",
      time: "Early Shift",
      sortOrder: -20,
      category: "garbage",
      title: "Check Garbage and Litter",
      detail: `${garbageParks.length} parks`,
      href: "/garbage",
    },
    {
      id: "garbage-late",
      time: "Late Shift",
      sortOrder: timeToMinutes("9:30 PM"),
      category: "garbage",
      title: "Late Garbage and Litter Check",
      detail: `${garbageParks.length} parks`,
      href: "/garbage",
    },
  ];

  rentals.forEach((rental) => {
    const rentalDetail = `${rental.facility} - ${rental.organization || "Rental"}`;

    tasks.push({
      id: `rental-check-${rental.id}`,
      time: rental.startTime,
      sortOrder: makeSortOrder(rental.startTime, 0),
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
