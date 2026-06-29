import assert from "node:assert/strict";
import { parseRentalSheetTextWithDebug } from "../src/lib/rentalSheetParser";

const roughColumnJun29OcrText = `
Page :      1
Date /
Setup - Ready Time /
Start - End Time
Facility / Equipment / Type /
Center
Reservation Master Report
Jun 29, 2026
9:40 AM
Reservation Date: From Jun 29, 2026 through Jun 29, 2026
Facility Type: Field - Baseball, Field - Soccer
Event / Event Type /
Schedule Type
Contact Information
Permit#
Attend/Qty        Notes
Jun 29, 2026 Monday
6:00 PM - 8:00 PM
6:00 PM - 10:30 PM
6:00 PM - 9:00 PM
6:00 PM - 7:30 PM
6:00 PM - 7:30 PM
6:00 PM - 8:00 PM
6:00 PM - 9:30 PM
6:00 PM - 7:30 PM
CP - Diamond #1 (Softball) (Pitch
Mach)
Field - Baseball
Centennial Park
CP - Diamond #3 (Hardball)
Field - Baseball
Centennial Park
HBP - Soccer Field - 7V7 Sizes
Field - Soccer
Harold Black Park
NPP - Diamond #1 (Pitching
Machine)
Field - Baseball
North Pelham Park
NPP - Diamond #2 (T-ball)
Field - Baseball
North Pelham Park
Glynn.A.Green
Field - Soccer
Glynn. A. Green
CP - Soccer #2 - Full Field
Field - Soccer
Centennial Park
HBP - Diamond #1 - Softball
Field - Baseball
Harold Black Park
PMBA June - Games 2026
Ball Diamond - Games with Lines
(Minor)
External Reservation
PMBA June - Games 2026
Ball Diamond - Games with Lines
(Minor)
External Reservation
Pelham Soccer June 2026
Soccer Field Rental - Minor
External Reservation
PMBA June - Practices 2026
Ball Diamond - No Maintenance
(Minor)
External Reservation
PMBA June - Practices 2026
Ball Diamond - No Maintenance
(Minor)
External Reservation
Pelham Soccer June 2026
Soccer Field Rental - Minor
External Reservation
Pelham Soccer June 2026
Soccer Field Rental - Minor
External Reservation
PMBA June - Practices 2026
Ball Diamond - No Maintenance
(Minor)
External Reservation
Pelham Minor Baseball
Association (PMBA)
(Commercial)
Carly Charters
H: (905) 933-8563
R11825
30
R11825
30
R11624
20
R11825
1
R11825
1
R11624
20
R11624
20
R11825
1
Page :  24 Of?
Reservation Master Report
Reservation Date: From Jun 29, 2026 through Jun 29, 2026
Facility Type: Field - Baseball, Field - Soccer
Jun 29, 2026
9:40 AM
Date /
Setup - Ready Time /       Facility / Equipment / Type /        Event / Event Type /                                        :                     Permit#
Start - End Time              Center                                      Schedule Type                           Contact Information                 Attend/Qty ~~ Notes
HBP - Diamond #2 - Hardball         PMBA June - Practices 2026         Pelham Minor Baseball                   R11825
Field - Baseball                       Ball Diamond - No Maintenance ~~ Association (PMBA)                            1
Harold Black Park                    (Minor)                                 (Commercial)
6:30 PM - 9:00 PM                                                   External Reservation                  Carly Charters
H: (905) 933-8563
CP - Soccer #1 - Full Field            Pelham Soccer June 2026            Pelham Soccer Club                       R11624
Field - Soccer                          Soccer Field Rental - Minor          (Commercial)                                    20
Centennial Park                     External Reservation               Nicole Birrell
6:30 PM - 9:00 PM
H: (905) 327-5856
CP - Diamond #2 (Softball)           Co-Ed Softball 2026 - Monday       Pelham Slo-pitch League                R11578
Field - Baseball                         Ball Diamond - Games with Lines (Commercial)                                    20
Centennial Park                     (Adult)                               Joe Racz
6:45 PM - 9:15 PM                                                 External Reservation
H: (905) 736-0561
CP - Diamond #1 (Softball) (Pitch. PMBA June - Practices 2026         Pelham Minor Baseball                    R11825
Mach)                                   Ball Diamond - No Maintenance Association (PMBA)                             1
Field - Baseball                         (Minor)                                  (Commercial)
8:00 PM - 9:30 PM         Centennial Park                       External Reservation                 Carly Charters
H: (905) 933-8563
RSI
`.trim();

const result = parseRentalSheetTextWithDebug(roughColumnJun29OcrText);
const rows = result.rentals.map((rental) => ({
  facility: rental.facility,
  startTime: rental.startTime,
  endTime: rental.endTime,
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

console.log("Jun 29 rough column rental sheet parser test passed.");
