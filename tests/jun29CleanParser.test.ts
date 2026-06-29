import assert from "node:assert/strict";
import { parseRentalSheetTextWithDebug } from "../src/lib/rentalSheetParser";

const cleanJun29OcrText = `
Page : 1 of 2
Reservation Master Report
Reservation Date: From Jun 29, 2026 through Jun 29. 2026
Facility Type: Field - Baseball, Field - Soccer
Date /
Setup - Ready Time / Facility / Equipment / Type / Event / Event Type / Permit#
Start - End Time Center Schedule Type Contact Information Attend/Qty Notes
Jun 29, 2026 Monday CP - Diamond #1 (Softball) (Pitch PMBA June - Games 2026 Pelham Minor Baseball R11825
Mach) Ball Diamond - Games with Lines Association (PMBA) 30
Field - Baseball (Minor) {Commercial)
6:00 PM - 8:00 PM Centennial Park External Reservation Carly Charters
CP - Diamond #3 (Hardball) PMBA June - Games 2026 Pelham Minor Baseball R11825
Field - Baseball Ball Diamond - Games with Lines Association (PMBA) 30
Centennial Park (Minor) (Commercial)
6:00 PM - 10:30 PM External Reservation Carly Charters
HBP - Soccer Field - 7V7 Sizes Pelham Soccer June 2026 Pelham Soccer Club R11624
Field - Soccer Soccer Field Rental - Minor (Commercial) 20
Harold Black Park External Reservation Nicole Birrell
6:00 PM - 9:00 PM
NPP - Diamond #1 (Pitching PMBA June - Practices 2026 Pelham Minor Baseball R11825
Machine) Ball Diamond - No Maintenance Association (PMBA) 1
Field - Baseball (Minor) (Commercial)
6:00 PM - 7:30 PM North Pelham Park External Reservation Carly Charters
NPP - Diamond #2 (T-ball) PMBA June - Practices 2026 Pelham Minor Baseball R11825
Field - Baseball Ball Diamond - No Maintenance Association (PMBA) 1
North Pelham Park (Minor) (Commercial)
6:00 PM - 7:30 PM External Reservation Carly Charters
Glynn.A Green Pelham Soccer June 2026 Pelham Soccer Club R11624
Field - Soccer Soccer Field Rental - Minor (Commercial) 20
Glynn. A. Green External Reservation Nicole Birrell
6:00 PM - 8:00 PM
CP - Soccer #2 - Full Field Pelham Soccer June 2026 Pelham Soccer Club R11624
Field - Soccer Soccer Field Rental - Minor (Commercial) 20
Centennial Park External Reservation Nicole Birrell
6:00 PM - 9:30 PM
HBP - Diamond #1 - Softball PMBA June - Practices 2026 Pelham Minor Baseball R11825
6:00 PM - 7:30 PM
Field - Baseball
Harold Black Park
Ball Diamond - No Maintenance
(Minor)
External Reservation
Association (PMBA)
(Commercial)
Carly Charters
1
Page : 2 of 2
HBP - Diamond #2 - Hardball PMBA June - Practices 2026 Pelham Minor Baseball R11825
Field - Baseball Ball Diamond - No Maintenance Association (PMBA) 1
Harold Black Park (Minor) (Commercial)
6:30 PM - 9:00 PM External Reservation Carly Charters
CP - Soccer #1 - Full Field Pelham Soccer June 2026 Pelham Soccer Club R11624
Field - Soccer Soccer Field Rental - Minor (Commercial) 20
Centennial Park External Reservation Nicole Birrell
6:30 PM - 9:00 PM
CP - Diamond #2 (Softball) Co-Ed Softball 2026 - Monday Pelham Slo-pitch League R11578
Field - Baseball Ball Diamond - Games with Lines (Commercial) 20
Centennial Park (Adult) Joe Racz
6:45PM- 9:15 PM External Reservation
CP - Diamond #1 (Softball) (Pitch PMBA June - Practices 2026 Pelham Minor Baseball R11825
8:00 PM - 9:30 PM
Mach)
Field - Baseball
Centennial Park
Ball Diamond - No Maintenance
(Minor)
External Reservation
Association (PMBA)
(Commercial)
Carly Charters
1
`.trim();

const result = parseRentalSheetTextWithDebug(cleanJun29OcrText);
const rows = result.rentals.map((rental) => ({
  facility: rental.facility,
  startTime: rental.startTime,
  endTime: rental.endTime,
  eventName: rental.eventName,
}));

assert.equal(result.rentals.length, 12);
assert.deepEqual(result.skippedLines, []);

[
  ["CP - Diamond #1 (Softball)", "6:00 PM", "8:00 PM"],
  ["CP - Diamond #3 (Hardball)", "6:00 PM", "10:30 PM"],
  ["HBP - Soccer Field - 7V7 Sizes", "6:00 PM", "9:00 PM"],
  ["NPP - Diamond #1 (Pitching Machine)", "6:00 PM", "7:30 PM"],
  ["NPP - Diamond #2 (T-ball)", "6:00 PM", "7:30 PM"],
  ["Glynn A. Green Field - Soccer", "6:00 PM", "8:00 PM"],
  ["CP - Soccer #2 - Full Field", "6:00 PM", "9:30 PM"],
  ["HBP - Diamond #1 - Softball", "6:00 PM", "7:30 PM"],
  ["HBP - Diamond #2 - Hardball", "6:30 PM", "9:00 PM"],
  ["CP - Soccer #1 - Full Field", "6:30 PM", "9:00 PM"],
  ["CP - Diamond #2 (Softball)", "6:45 PM", "9:15 PM"],
  ["CP - Diamond #1 (Softball)", "8:00 PM", "9:30 PM"],
].forEach(([facility, startTime, endTime]) => {
  assert.ok(
    rows.some(
      (rental) =>
        rental.facility === facility &&
        rental.startTime === startTime &&
        rental.endTime === endTime,
    ),
    `Expected ${facility} ${startTime} - ${endTime}`,
  );
});

assert.ok(
  rows.some(
    (rental) =>
      rental.facility === "CP - Diamond #2 (Softball)" &&
      rental.startTime === "6:45 PM" &&
      rental.endTime === "9:15 PM" &&
      rental.eventName === "Co-Ed Softball 2026 - Monday",
  ),
  "Expected CP Diamond #2 to keep the Co-Ed Softball event name",
);

console.log("Jun 29 clean rental sheet parser test passed.");
