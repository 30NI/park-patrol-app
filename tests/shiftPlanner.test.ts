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

console.log("Shift planner staggers rental workflow checks by park.");
