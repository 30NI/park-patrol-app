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

const noisyTesseractText = `
Reservation Master Report
Facil Type: Field - Bassbal, Field - Soccer
Jun 9, 2026
CP-DBmond# (Hardbal) PMBA June - Games 2026 Palham Minor Bassball Ri1625
Field - Baseball Ball Diamond - Games wil Lines Associaton (PBA)
Contannial Park
600 PM- 1030 PM Edema Reservation Gary Charters
HBP - Diamond #1-Softvall PMBAJune-Games 2026. Pelham Minor Baseball. Ri1625
Field Basobal Boll Diamond - Games with Lines Associaton (PMBA)
Harold Black Park
600 PM -B00PM Extemal Reservation Carly Charters
8p Diamond #2- Hardball PMBA ne Praclicos 2026 Pelham Minor Basabal Ritezs
Field. Baseball Ball Dlarond - No Manienanco Associaton (PHBA)
Harold Black Park
500PM-T:30PM Extomal Resonvaton Carly Chartors
HBP - Soccer Fild-7V7 Sos Pelham Soccer June 2020 Palnam Soccer Club Rite24
Fild Soccer Soccer Flo Renal Minor
Harold Black Park Edomal Reservation Nicolo Biro
600PM-830PM
NPP Diamond #1 (Piching Machine) PMBAUno -Pracices 2026 Pelham Minar Baseball Rites
Field Baseball
G00PM-700PM Koti Pelham Park Extemal Reservation Carly Charters
NPP - Diamond #2 (T-bal) PMBA une - Practices 2026 Polham Minor Baseball Ri1825
Fild - Baseball Ball Diamond - No Maintenance Association (PMBA)
Nor Panam Park
600PM-700PM Exeral Resorvaton Carly Charters
GymAGreen Palham Soccer June 2026 Pelham Soccer Club Rit624
Fil Soccer Soccer Feld Renta - Minor
Gym A Green Exemal Resorvaton Nico Biol
600 PM-800PM
CP Soccer #1 - Ful Feld Pelham Soccer June 2026 Pelham Soccer Club Rit624
Fild- Soccer Soccer Feld Rental -Minor
Cantonal Park Edemal Resorvaton Nicol Biel
630PM-830PM
CP Soccer #2. Ful Feld Pelham Soccer June 2026 Pelham Soccer Club Rito24
Fld Soccor Soccer Fold Renta Minor
Centennial Park Extemal Reservation Nicol Biel
630 PM-B30PM
Page: 2 of 2
Reservation Master Report Jun 9, 2026
CP - Diamond #2 (Sofbal) Men's -Tuosdays Paha Siopich League
Fit Sabal Ba Diamond Games wih Lines
64s PM-015 PI amet Resevston
HBP - Diamond #1-Softzall PMBA Jno -Pracices 2026 Pelham Minor Baseball
Folds Ba Dimond ahloranc Assodate
o0P-030PM Elomi Resonaton
`.trim();

const noisyResult = parseRentalSheetTextWithDebug(noisyTesseractText);
const noisyFacilities = noisyResult.rentals.map((rental) => rental.facility);

function assertNoisyRental(
  facility: string,
  startTime: string,
  endTime: string,
  scheduleType: string,
) {
  const rental = noisyResult.rentals.find((item) => item.facility === facility);

  assert.ok(rental, `Expected ${facility} to be detected`);
  assert.equal(rental.startTime, startTime);
  assert.equal(rental.endTime, endTime);
  assert.equal(rental.scheduleType, scheduleType);
}

assert.equal(noisyResult.rentals.length, 11);
assert.ok(noisyFacilities.includes("HBP - Soccer Field - 7V7 Sizes"));
assertNoisyRental(
  "CP - Diamond #3 (Hardball)",
  "6:00 PM",
  "10:30 PM",
  "Ball Diamond - Games with Lines",
);
assertNoisyRental(
  "HBP - Diamond #1 - Softball",
  "6:00 PM",
  "8:00 PM",
  "Ball Diamond - Games with Lines",
);
assert.ok(
  noisyResult.rentals.some(
    (rental) =>
      rental.facility === "HBP - Diamond #1 - Softball" &&
      rental.startTime === "8:00 PM" &&
      rental.endTime === "9:30 PM" &&
      rental.scheduleType === "Ball Diamond - No Maintenance",
  ),
);
assertNoisyRental(
  "HBP - Diamond #2 - Hardball",
  "6:00 PM",
  "7:30 PM",
  "Ball Diamond - No Maintenance",
);
assertNoisyRental(
  "HBP - Soccer Field - 7V7 Sizes",
  "6:00 PM",
  "8:30 PM",
  "Soccer Field Rental - Minor",
);
assertNoisyRental(
  "NPP - Diamond #1 (Pitching Machine)",
  "6:00 PM",
  "7:00 PM",
  "Ball Diamond - No Maintenance",
);
assertNoisyRental(
  "NPP - Diamond #2 (T-ball)",
  "6:00 PM",
  "7:00 PM",
  "Ball Diamond - No Maintenance",
);
assertNoisyRental(
  "Glynn A. Green Field - Soccer",
  "6:00 PM",
  "8:00 PM",
  "Soccer Field Rental - Minor",
);
assertNoisyRental(
  "CP - Soccer #1 - Full Field",
  "6:30 PM",
  "8:30 PM",
  "Soccer Field Rental - Minor",
);
assertNoisyRental(
  "CP - Soccer #2 - Full Field",
  "6:30 PM",
  "8:30 PM",
  "Soccer Field Rental - Minor",
);
assertNoisyRental(
  "CP - Diamond #2 (Softball)",
  "6:45 PM",
  "9:15 PM",
  "Ball Diamond - Games with Lines",
);

console.log(
  `Rental sheet parser detected ${result.rentals.length} clean rentals and ${noisyResult.rentals.length} noisy rentals.`,
);

const timeFirstOcrText = `
Reservation Master Report
Reservation Date: From Jun 17, 2026 through Jun 17, 2026
Facility Type: Field - Baseball, Field - Soccer
5:15 PM - 6:15 PM
NPP - Diamond #1 (Pitching Machine)
Field - Baseball
North Pelham Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Pelham Minor Baseball Association (PMBA)
R11825
5:15 PM - 6:15 PM
NPP - Diamond #2 (T-ball)
Field - Baseball
North Pelham Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Pelham Minor Baseball Association (PMBA)
R11825
6:00 PM - 8:00 PM
CP - Diamond #1 (Softball) (Pitch Mach)
Field - Baseball
Centennial Park
PMBA June - Games 2026
Ball Diamond - Games with Lines
Pelham Minor Baseball Association (PMBA)
R11825
6:00 PM - 8:00 PM
CP - Diamond #3 (Hardball)
Field - Baseball
Centennial Park
PMBA June - Games 2026
Ball Diamond - Games with Lines
Pelham Minor Baseball Association (PMBA)
R11825
6:00 PM - 8:30 PM
HBP - Soccer Field - 7V7 Sizes
Field - Soccer
Harold Black Park
Pelham Soccer June 2026
Soccer Field Rental - Minor
Pelham Soccer Club
R11624
6:00 PM - 8:00 PM
Glynn.A.Green
Field - Soccer
Glynn A. Green
Pelham Soccer June 2026
Soccer Field Rental - Minor
Pelham Soccer Club
R11624
6:30 PM - 9:00 PM
CP - Soccer #1 - Full Field
Field - Soccer
Centennial Park
Pelham Soccer June 2026
Soccer Field Rental - Minor
Pelham Soccer Club
R11624
6:30 PM - 9:00 PM
CP - Soccer #2 - Full Field
Field - Soccer
Centennial Park
Pelham Soccer June 2026
Soccer Field Rental - Minor
Pelham Soccer Club
R11624
6:30 PM - 7:30 PM
NPP - Diamond #2 (T-ball)
Field - Baseball
North Pelham Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Pelham Minor Baseball Association (PMBA)
R11825
6:30 PM - 7:30 PM
NPP - Diamond #1 (Pitching Machine)
Field - Baseball
North Pelham Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Pelham Minor Baseball Association (PMBA)
R11825
7:15 PM - 8:30 PM
HBP - Diamond #2 - Hardball
Field - Baseball
Harold Black Park
PMBA June - Practices 2026
Ball Diamond - No Maintenance
Pelham Minor Baseball Association (PMBA)
R11825
`.trim();

const timeFirstResult = parseRentalSheetTextWithDebug(timeFirstOcrText);

assert.equal(timeFirstResult.rentals.length, 11);
assert.ok(
  timeFirstResult.rentals.some(
    (rental) =>
      rental.facility === "NPP - Diamond #1 (Pitching Machine)" &&
      rental.startTime === "5:15 PM" &&
      rental.endTime === "6:15 PM",
  ),
);
assert.ok(
  timeFirstResult.rentals.some(
    (rental) =>
      rental.facility === "HBP - Diamond #2 - Hardball" &&
      rental.startTime === "7:15 PM" &&
      rental.endTime === "8:30 PM",
  ),
);

const preprocessedScreenshotOcrText = `
Reservation Master Report
Reservation Date: From Jun 17, 2026 through Jun 17. 2026
Facirty Type: Field - Baseball. Field - Soccer
NPP - Dramond #1 (Pilching Machine)
Field - Baseball
PMBA June - Practices 2026
Ball Diamond - No Mantenance
Pelham Minor Baseball Associaton (PMBA)
6:30 PM - 7:30 PM
North Pelham Park
HBP - Diamond #2 - Hardball
Field - Baseball
Harold Black Park
PMBA June - Practices 2026
Ball Diamond - No Mantenance
Pelham Minor Baseball Associaton (PMBA)
7:15 PM - 8:30 PM
Page : 1 of 2
Reservation Master Report
Jun 17. 2026 Wednesday NPP - Diamond #1 (Pitching Machine)
Field - Baseball
5:15PM - 6:15 PM North Pelham Park
NPP - Diamond #2 (T-bal)
Field - Baseball
5:15PM - 6:15 PM
CP . Diamond #1 (Softball) (Pitch Mach)
Field - Baseball
6:00 PM - 8:00 PM Centennial Park
CP - Diamond 83 (Hardbal)
Field - Baseball
Centennial Park
6:00 PM - 8.00 PM
HBP - Soccer Field - 7V7 Sizes
Field - Soccer
Harold Black Park
6:00 PM - 8:30 PM
Glynn. A.Green
Field - Soccer
Glynn A. Green
6:00 PM - 8:00 PM
CP - Soccer #1 - Full Field
Field - Soccer
6:30 PM - 9:00 PM
CP - Soccer #2 - Full Field
Field - Soccer
6:30 PM - 9:00 PM
NPP - Diamond #2 (T-bal)
Field - Baseball
6:30 PM - 7:30 PM
`.trim();

const preprocessedResult = parseRentalSheetTextWithDebug(
  preprocessedScreenshotOcrText,
);

assert.ok(preprocessedResult.rentals.length >= 8);
assert.ok(
  preprocessedResult.rentals.some(
    (rental) =>
      rental.facility === "NPP - Diamond #1 (Pitching Machine)",
  ),
);
assert.ok(
  preprocessedResult.rentals.some(
    (rental) =>
      rental.facility === "CP - Diamond #3 (Hardball)" &&
      rental.startTime === "6:00 PM" &&
      rental.endTime === "8:00 PM",
  ),
);
assert.ok(
  preprocessedResult.rentals.some(
    (rental) => rental.facility === "HBP - Diamond #2 - Hardball",
  ),
);

const dotSeparatedOcrText = `
Page . 1 of 2
Reservation Master Report
Reservabon Date From Jun 17 2026 through Jun 17 2026
Facity Type. Field - Basebal Field - Soccer
Jun 17.2026
10.09 AM
Date /
Setup - Ready Time / Facility / Equipment / Type / Event / Event Type / ) Permits
Start - End Time Center Schedule Type Contact Information Attend/Qty ~~ Notes
Jun 17. 20268 Wednesday NPP - Diamond #1 (Pitcheng PMBA June - Practices 2026 Pelham Minor Baseball R11825
Machine) Ball Diamond - No Mantenance Associaton (PMBA) 1
Fiedd - Baseball {Mmnor) {Commercial)
S:15PM . 6.15 PM North Pelham Park External Reservation Carly Charters
NPP . Diamond #2 (T-bal} PIABA June Practices 2026 Pelham nor Baseball R11825
Fieid - Baseball Ball Dumond - No Manienance Associaton (PMBA) 1
North Pelham Park {Minor ) {Commercial
5.15PM. 6 15 PM Exiernyl Reservation Carly Charters
CP - Diamond 81 (Softball) (Pitch PMBA June - Games 2026 Pelham Minor Baseball R11825
Mach) Ball Diamond - Games with Lines Associason (PMBA) 30
Fiedd - Baseball {Mmnor) {Commercial)
6:00 PM - 8.00 PM Centennial Park External Reservation Carly Charters
CP Diamond 83 (Hardball) PMIBA June - Games 2028 Pelham Minor Baseball R11825
Fiedd - Baseball Ball Dumond - Games with Lines Associaton (PMBA) 20
Centenniyl Park {Minor ) {Commercial
6.00 PA 8 00 PM External Reservation Carty Charters
HBP .- Soccer Field - 7V7 Sizes Pelham Soccer June 2026 Pelham Soccer Club R11624
Fiedd - Soccer Soccer Feid Rental - Minor {Commercial) 20
Haroki Black Park External Reservation Nicole Birrell
6:00 PM - 8.30 PM
Ghnn A. Green Pelham Soccer June 2026 Pelham Soccer Cub R11624
Fiedd - Soccer Soccer Fieid Renta - Minor {Commerciali 20
Ghnn A. Green External Reservation Nicole Birrel
6.00 PM - 8 00 PM
CP - Soccer #1 - Full Frekd Pelham Soccer June 2026 Pelham Soccer Club R11624
Fiedd - Soccer Soccer Feid Rental - Minor {Commercial) 20
Centennial Park External Reservation Nicole Birrell
6:30 PM - 9.00 PM
CP Soccer 82 - Full Field Pelham Soccer June 2026 Pelham Soccer Cub R11624
Fiedd - Soccer Soccer Fieid Renta - Minor {Commerciali 20
Centennal Park Exiernal Reservation Nicole Birred
6.30 PM - 9 00 PM
NPP . Diamond #2 (T-bal) PMBA June - Practices 20268 Pelham Minor Baseball R11825
6:30 PM - 7.30 PM
Fiedd - Baseball
North Pelham Park
Ball Diamond - No Mantenance
`.trim();

const dotSeparatedResult = parseRentalSheetTextWithDebug(dotSeparatedOcrText);

assert.equal(dotSeparatedResult.rentals.length, 9);
assert.ok(
  dotSeparatedResult.rentals.some(
    (rental) =>
      rental.facility === "NPP - Diamond #1 (Pitching Machine)" &&
      rental.startTime === "5:15 PM" &&
      rental.endTime === "6:15 PM",
  ),
);
assert.ok(
  dotSeparatedResult.rentals.some(
    (rental) =>
      rental.facility === "CP - Soccer #2 - Full Field" &&
      rental.startTime === "6:30 PM" &&
      rental.endTime === "9:00 PM",
  ),
);

const facilityBeforeTimeOcrText = `
Page : 2 of 2
Reservation Master Report
Reservabon Date: From Jun 17, 2026 through Jun 17. 2026
Facirty Type: Field - Baseball. Field - Soccer
Jun 17, 2026
10:09 AM
Date /
Setup - Ready Time /       Facility / Equipment / Type /         Event / Event Type /                                                                    Permits
Start . End Time             Center                                   Schedule Type                         Contact information                AttendiQty Notes
NPP - Dramond #1 (Pilching          PMBA June - Practices 2026         Pelham Minor Baseball                   R11825
Machine)                               Ball Diamond - No Mantenance Associaton (PMBA)                             1
Field - Baseball                       {Minor)                                 {Commercial)
6:30 PM - 7:30 PM         North Pelham Park                    Exiernal Reservation                  Carly Charters
H: {9065} 933-8583
HBP - Diamond #2 - Hardball         PMBA June - Practices 2026         Pelham Minor Baseball                    R11825
Field - Baseball                         Ball Diamond - No Mantenance ~~ Associaton (PMBA)                              1
Harold Black Park                        (Minor)                                       (Commercial)
7:15 PM - 8:30 PM                                                      External Reservation                   Carly Charters
H: (906) 933-8583
`.trim();

const facilityBeforeTimeResult = parseRentalSheetTextWithDebug(
  facilityBeforeTimeOcrText,
);

assert.equal(facilityBeforeTimeResult.rentals.length, 2);
assert.ok(
  facilityBeforeTimeResult.rentals.some(
    (rental) =>
      rental.facility === "NPP - Diamond #1 (Pitching Machine)" &&
      rental.startTime === "6:30 PM" &&
      rental.endTime === "7:30 PM",
  ),
);
assert.ok(
  facilityBeforeTimeResult.rentals.some(
    (rental) =>
      rental.facility === "HBP - Diamond #2 - Hardball" &&
      rental.startTime === "7:15 PM" &&
      rental.endTime === "8:30 PM",
  ),
);

const pastedJun9ProblemOcrText = `
Jun©,2026 -Tuesddy+ CP Dif                   p-Gamea2026 "Pelham Minor
a.    Feld = B:                          nd - Games with Lines ;, Association (PMBA)!
6:00 PM - 10:30 PM
HBP - Diamond #1 - Softball            PMBA June - Practices 2026            Pelham Minor Baseball
Fleid - Baseball                                Ball Diamond - No Maintenance Association (PMBA)                             Ri1625
800 PM.-ga0pM, ow Black Park:         (Minor)                (Commercial)                 1
-9S0PM.                              .                                 External Reservation                       Carty Charters
CP - Soccer #1 - Full Field             Pelham Soccer June 2026             Pelham Soccer Club                         R11624
Centennial Park                          Extemal Reservation                    Nicole Birrell
6:30 PM - 8:30 PM
CP Soccer 82 - Full Field              Pelham Soccer June 2026              Petham Soccer Club                          R11624
Centennial Park                          External Reservation                    Nicole Birrell
8:30 PM - 8:30 PM
HBP - Dsamond #2 - Hardball PMBA June - Practices 2026 Pelham Manor Baseball
R11825
7:15PM - 8.30 PM
Fiedd - Baseball
Haroki Black Park
Ball Diamond - No Msntenance
`.trim();

const pastedJun9ProblemResult = parseRentalSheetTextWithDebug(
  pastedJun9ProblemOcrText,
);

assert.ok(
  pastedJun9ProblemResult.rentals.some(
    (rental) =>
      rental.facility === "CP - Diamond #3 (Hardball)" &&
      rental.startTime === "6:00 PM" &&
      rental.endTime === "10:30 PM",
  ),
);
assert.ok(
  pastedJun9ProblemResult.rentals.some(
    (rental) =>
      rental.facility === "CP - Soccer #2 - Full Field" &&
      rental.startTime === "6:30 PM" &&
      rental.endTime === "8:30 PM",
  ),
);
assert.ok(
  pastedJun9ProblemResult.rentals.some(
    (rental) =>
      rental.facility === "HBP - Diamond #1 - Softball" &&
      rental.startTime === "8:00 PM" &&
      rental.endTime === "9:30 PM",
  ),
);
assert.ok(
  pastedJun9ProblemResult.rentals.some(
    (rental) =>
      rental.facility === "HBP - Diamond #2 - Hardball" &&
      rental.startTime === "7:15 PM" &&
      rental.endTime === "8:30 PM",
  ),
);

