import assert from "node:assert/strict";
import { parseRentalSheetTextWithDebug } from "../src/lib/rentalSheetParser";

const fullSampleRentalSheetText = `
Reservation Master Report
Reservation Date: Jun 9, 2026 through Jun 9, 2026
Facility Type: Field - Baseball, Field - Soccer
Page: 1 of 2
Date / Setup - Ready Time / Start - End Time
Facility / Equipment / Type / Center
Event / Event Type / Schedule Type
Contact Information
Permit# Attend/Qty
Notes
6:00 PM - 10:30 PM
CP - Diamond #3 (Hardball)
Field - Baseball
Centennial Park
PMBA June - Games 2026
Ball Diamond - Games with Lines
Local Baseball Association
R11825
30
6:00 PM - 8:00 PM
HBP - Diamond #1 - Softball
Field - Baseball
Harold Black Park
PMBA June - Games 2026
Ball Diamond - Games with Lines
Local Baseball Association
R11825
30
6:00 PM - 7:30 PM
HBP - Diamond #2 - Hardball
Field - Baseball
Harold Black Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Local Baseball Association
R11825
1
6:00 PM - 8:30 PM
HBP - Soccer Field - 7V7 Sizes
Field - Soccer
Harold Black Park
Soccer Field Rental - Minor
Local Soccer Club
R11624
20
6:00 PM - 7:00 PM
NPP - Diamond #1 (Pitching Machine)
Field - Baseball
North Pelham Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Local Baseball Association
R11825
1
6:00 PM - 7:00 PM
NPP - Diamond #2 (T-ball)
Field - Baseball
North Pelham Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Local Baseball Association
R11825
1
6:00 PM - 8:00 PM
Glynn A. Green Field - Soccer
Field - Soccer
Glynn A. Green
Soccer Field Rental - Minor
Local Soccer Club
R11624
20
6:30 PM - 8:30 PM
CP - Soccer #1 - Full Field
CP - Soccer #2 - Full Field
Field - Soccer
Centennial Park
Soccer Field Rental - Minor
Local Soccer Club
R11624
20
Page: 2 of 2
6:45 PM - 9:15 PM | CP - Diamond #2 (Softball) | Field - Baseball | Men's - Tuesdays | Ball Diamond - Games with Lines | Local Softball League | Rental Contact | (905) 000-0000 | R11578 | 20 | Centennial Park
8:00 PM - 9:30 PM | HBP - Diamond #1 - Softball | Field - Baseball | PMBA June - Practices 2026 | Ball Diamond - No Maintenance | Local Baseball Association | Rental Contact | (905) 000-0000 | R11825 | 1 | Harold Black Park
`.trim();

const result = parseRentalSheetTextWithDebug(fullSampleRentalSheetText);
const facilities = result.rentals.map((rental) => rental.facility);

assert.equal(result.rentals.length, 11);
assert.equal(result.rawText, fullSampleRentalSheetText);
assert.ok(facilities.includes("CP - Diamond #3 (Hardball)"));
assert.ok(facilities.includes("HBP - Diamond #1 - Softball"));
assert.ok(facilities.includes("HBP - Diamond #2 - Hardball"));
assert.ok(facilities.includes("HBP - Soccer Field - 7V7 Sizes"));
assert.ok(facilities.includes("NPP - Diamond #1 (Pitching Machine)"));
assert.ok(facilities.includes("NPP - Diamond #2 (T-ball)"));
assert.ok(facilities.includes("Glynn A. Green Field - Soccer"));
assert.ok(facilities.includes("CP - Soccer #1 - Full Field"));
assert.ok(facilities.includes("CP - Soccer #2 - Full Field"));
assert.ok(facilities.includes("CP - Diamond #2 (Softball)"));

const sixPmRentals = result.rentals.filter(
  (rental) => rental.startTime === "6:00 PM",
);
assert.equal(sixPmRentals.length, 7);

const centennialSoccerRentals = result.rentals.filter(
  (rental) =>
    rental.park === "Centennial Park" &&
    rental.startTime === "6:30 PM" &&
    rental.endTime === "8:30 PM" &&
    rental.facility.startsWith("CP - Soccer"),
);
assert.equal(centennialSoccerRentals.length, 2);

const parks = new Set(result.rentals.map((rental) => rental.park));
assert.deepEqual(
  [...parks].sort(),
  [
    "Centennial Park",
    "Glynn A. Green",
    "Harold Black Park",
    "North Pelham Park",
  ],
);

console.log(`Rental sheet parser detected ${result.rentals.length} rentals.`);
