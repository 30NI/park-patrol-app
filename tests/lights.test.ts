import assert from "node:assert/strict";
import { getLightTasks } from "../src/lib/lights";
import { timeToMinutes } from "../src/lib/time";
import type { Rental } from "../src/types/rental";

function rental(
  id: string,
  facility: string,
  park: string,
  startTime: string,
  endTime: string,
): Rental {
  return {
    id,
    rentalDate: "Jun 29, 2026",
    park,
    facility,
    equipmentType: facility.includes("Soccer") ? "Field - Soccer" : "Field - Baseball",
    startTime,
    endTime,
    eventName: "Test Rental",
    eventType: "External Reservation",
    scheduleType: "Test",
    organization: "Test Organization",
    contactName: "",
    contactPhone: "",
    permitNumber: "",
    attendanceQuantity: "",
    checkedIn: false,
    notes: "",
  };
}

const lightTasks = getLightTasks([
  rental("cp1-early", "CP - Diamond #1 (Softball)", "Centennial Park", "6:00 PM", "8:00 PM"),
  rental("cp3", "CP - Diamond #3 (Hardball)", "Centennial Park", "6:00 PM", "10:30 PM"),
  rental("hbp-soccer", "HBP - Soccer Field - 7V7 Sizes", "Harold Black Park", "6:00 PM", "9:00 PM"),
  rental("cp-soccer-2", "CP - Soccer #2 - Full Field", "Centennial Park", "6:00 PM", "9:30 PM"),
  rental("hbp-2", "HBP - Diamond #2 - Hardball", "Harold Black Park", "6:30 PM", "9:00 PM"),
  rental("cp-soccer-1", "CP - Soccer #1 - Full Field", "Centennial Park", "6:30 PM", "9:00 PM"),
  rental("cp2", "CP - Diamond #2 (Softball)", "Centennial Park", "6:45 PM", "9:15 PM"),
  rental("cp1-late", "CP - Diamond #1 (Softball)", "Centennial Park", "8:00 PM", "9:30 PM"),
]);

assert.ok(lightTasks.length > 0);

lightTasks.forEach((task) => {
  assert.notEqual(task.scheduledOnTime, "9:00 PM");
  assert.notEqual(task.scheduledOnTime, "9:05 PM");
});

assert.ok(
  lightTasks.every(
    (task) => timeToMinutes(task.scheduledOnTime) < timeToMinutes(task.scheduledOffTime),
  ),
  "Light-on time should stay before light-off time",
);

assert.ok(
  lightTasks.every(
    (task) => timeToMinutes(task.scheduledOnTime) <= timeToMinutes("8:55 PM"),
  ),
  "Light-on route should finish before 9 PM",
);

assert.ok(
  lightTasks.some((task) => task.scheduledOnTime === "8:00 PM"),
  "Light-on route should start at 8 PM",
);

const cpOnTimes = new Set(
  lightTasks
    .filter((task) => task.park === "Centennial Park")
    .map((task) => task.scheduledOnTime),
);

assert.ok(cpOnTimes.size > 1);

[...cpOnTimes].forEach((time) => {
  assert.ok(timeToMinutes(time) >= timeToMinutes("8:00 PM"));
});

const cpOnMinutes = [...cpOnTimes].map(timeToMinutes).sort((a, b) => a - b);

assert.ok(cpOnMinutes.some((time, index) => time - cpOnMinutes[index - 1] === 5));

assert.ok(
  lightTasks.some((task) => task.facility === "CP - Diamond #3 (Hardball)"),
);

console.log("Light planner buffers same-park light routes.");
