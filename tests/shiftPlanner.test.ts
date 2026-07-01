import assert from "node:assert/strict";
import { buildShiftTimeline } from "../src/lib/shiftPlanner";
import type { Rental } from "../src/types/rental";

function rental(
  id: string,
  park: string,
  startTime = "6:00 PM",
): Rental {
  return {
    id,
    rentalDate: "2026-06-29",
    park,
    facility: id,
    equipmentType: "",
    startTime,
    endTime: "8:00 PM",
    eventName: "",
    eventType: "",
    scheduleType: "",
    organization: "Test Org",
    contactName: "",
    contactPhone: "",
    permitNumber: "",
    attendanceQuantity: "",
    checkedIn: false,
    notes: "",
  };
}

const timeline = buildShiftTimeline({
  rentals: [
    rental("HBP 1", "Harold Black Park"),
    rental("HBP 2", "Harold Black Park"),
    rental("HBP 3", "Harold Black Park"),
    rental("CP 1", "Centennial Park"),
  ],
  washroomParks: [],
  garbageParks: [],
  lightTasks: [],
});

const rentalTimes = timeline
  .filter((task) => task.category === "rental")
  .map((task) => task.time);

assert.deepEqual(rentalTimes, ["6:00 PM", "6:05 PM", "6:10 PM", "6:25 PM"]);

const groupedTimeline = buildShiftTimeline({
  rentals: [
    rental("CP #1 early", "Centennial Park"),
    {
      ...rental("CP #1 late", "Centennial Park", "8:00 PM"),
      facility: "CP #1 early",
    },
  ],
  washroomParks: [],
  garbageParks: [],
  lightTasks: [],
});

const groupedRentalTasks = groupedTimeline.filter(
  (task) => task.category === "rental",
);

assert.equal(groupedRentalTasks.length, 1);
assert.deepEqual(groupedRentalTasks[0].targetIds, ["CP #1 early", "CP #1 late"]);

const splitVisitTimeline = buildShiftTimeline({
  rentals: [
    {
      ...rental("CP early", "Centennial Park", "6:00 PM"),
      endTime: "7:00 PM",
    },
    {
      ...rental("CP late", "Centennial Park", "8:00 PM"),
      endTime: "9:00 PM",
    },
    rental("HBP middle", "Harold Black Park", "6:30 PM"),
  ],
  washroomParks: [],
  garbageParks: [],
  lightTasks: [],
});
const splitVisitTasks = splitVisitTimeline.filter(
  (task) => task.category === "rental",
);

assert.deepEqual(
  splitVisitTasks.map((task) => `${task.detail}:${task.time}`),
  [
    "CP early - Test Org:6:00 PM",
    "HBP middle - Test Org:6:30 PM",
    "CP late - Test Org:8:00 PM",
  ],
);

console.log("Shift planner batches rental workflow checks by park.");
