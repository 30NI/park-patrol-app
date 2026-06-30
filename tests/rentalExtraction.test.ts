import assert from "node:assert/strict";
import {
  dedupeRentals,
  fuzzyMatchFacility,
  normalizeExtractedRentals,
} from "../src/lib/rentalExtraction";

const messyRows = normalizeExtractedRentals(
  [
    {
      facility: "CP - Diam0nd #3 (Hardbal)",
      park: "Centenniyl Park",
      facilityType: "Field - Basebal",
      startTime: "6:00 PM",
      endTime: "10:30 PM",
      eventName: "PMBA June - Games 2026",
      eventType: "External Reservation",
      scheduleType: "Ball Diamond - Games with Lines",
      permitNumber: "R11825",
      attendQty: "30",
      notes: "",
      confidence: 0.82,
    },
    {
      facility: "HBP - Soccer FieId - 7V7 Sizes",
      park: "",
      facilityType: "Field - Soccer",
      startTime: "6:00 PM",
      endTime: "9:00 PM",
      eventName: "Pelham Soccer June 2026",
      eventType: "External Reservation",
      scheduleType: "Soccer FieId Rental - Minor",
      permitNumber: "R11624",
      attendQty: "20",
      notes: "",
      confidence: 0.7,
    },
    {
      facility: "NPP Diamond #1 Pitching Machine",
      park: "North Pelham Park",
      facilityType: "Field - Baseball",
      startTime: "6 PM",
      endTime: "7:30 PM",
      eventName: "PMBA June - Practices 2026",
      eventType: "External Reservation",
      scheduleType: "Ball Diamond - No Manienance",
      permitNumber: "R11825",
      attendQty: "1",
      notes: "",
      confidence: 0.92,
    },
    {
      facility: "CP - Diamond #3 (Hardball)",
      park: "Centennial Park",
      facilityType: "Field - Baseball",
      startTime: "6:00 PM",
      endTime: "10:30 PM",
      eventName: "PMBA June - Games 2026",
      eventType: "External Reservation",
      scheduleType: "Ball Diamond - Games with Lines",
      permitNumber: "R11825",
      attendQty: "30",
      notes: "duplicate",
      confidence: 0.99,
    },
    {
      facility: "CP - Diamond #3 (Hardball)",
      park: "Centennial Park",
      facilityType: "Field - Baseball",
      startTime: "8:00 PM",
      endTime: "9:30 PM",
      eventName: "PMBA June - Practices 2026",
      eventType: "External Reservation",
      scheduleType: "Ball Diamond - No Maintenance",
      permitNumber: "R11825",
      attendQty: "1",
      notes: "different event/time",
      confidence: 0.99,
    },
  ],
  "Jun 29, 2026",
);

assert.equal(messyRows.length, 4);
assert.equal(messyRows[0].facility, "CP - Diamond #3 (Hardball)");
assert.equal(messyRows[0].park, "Centennial Park");
assert.equal(messyRows[0].rentalDate, "2026-06-29");
assert.equal(messyRows[0].startTime, "6:00 PM");
assert.equal(messyRows[0].endTime, "10:30 PM");
assert.equal(messyRows[0].scheduleType, "Ball Diamond - Games with Lines");

assert.equal(messyRows[1].facility, "HBP - Soccer Field - 7V7 Sizes");
assert.equal(messyRows[1].park, "Harold Black Park");
assert.equal(messyRows[1].scheduleType, "Soccer Field Rental - Minor");
assert.ok(messyRows[1].warnings?.includes("Low AI confidence."));

assert.equal(messyRows[2].facility, "NPP - Diamond #1 (Pitching Machine)");
assert.equal(messyRows[2].startTime, "6:00 PM");
assert.equal(messyRows[2].scheduleType, "Ball Diamond - No Maintenance");

assert.equal(
  fuzzyMatchFacility("Soccer FieId at HBP")?.facility.facility,
  "HBP - Soccer Field - 7V7 Sizes",
);

assert.equal(
  dedupeRentals([
    messyRows[0],
    { ...messyRows[0], notes: "same row duplicate" },
    messyRows[3],
  ]).length,
  2,
);

const invalidRows = normalizeExtractedRentals(
  [
    {
      facility: "Unknown Diam0nd",
      park: "",
      facilityType: "",
      startTime: "",
      endTime: "10:30 PM",
      eventName: "",
      eventType: "",
      scheduleType: "",
      permitNumber: "",
      attendQty: "",
      notes: "",
      confidence: 0.4,
    },
  ],
  "2026-06-29",
);

assert.ok(
  invalidRows[0].warnings?.some((warning) => /Unknown facility/i.test(warning)),
);
assert.ok(
  invalidRows[0].warnings?.some((warning) => /invalid start\/end/i.test(warning)),
);

console.log("Rental extraction normalization tests passed.");
