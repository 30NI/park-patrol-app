import type { LightTask } from "@/types/light";
import type { Rental } from "@/types/rental";
import { minutesToTime, timeToMinutes } from "./time";

const lightStartTime = "8:30 PM";
const lightStartMinutes = timeToMinutes(lightStartTime);

const lightCapableFacilities = [
  "HBP - Diamond #1",
  "HBP - Soccer Field",
  "CP - Diamond #1",
  "CP - Diamond #2",
  "CP - Diamond #3",
  "CP - Soccer #1",
  "CP - Soccer #2",
];

function hasLights(facility: string) {
  return lightCapableFacilities.some((lightFacility) =>
    facility.startsWith(lightFacility),
  );
}

export function getLightTasks(rentals: Rental[]): LightTask[] {
  const lightRentals = rentals
    .filter(
      (rental) =>
        hasLights(rental.facility) &&
        timeToMinutes(rental.endTime) > lightStartMinutes,
    )
    .sort((a, b) => {
      const parkCompare = a.park.localeCompare(b.park);

      if (parkCompare !== 0) {
        return parkCompare;
      }

      return a.facility.localeCompare(b.facility);
    });

  let previousPark = "";
  let scheduledOnMinutes = lightStartMinutes;

  return lightRentals
    .map((rental) => ({
      id: `light-${rental.id}`,
      rentalId: rental.id,
      park: rental.park,
      facility: rental.facility,
      organization: rental.organization,
      rentalStartTime: rental.startTime,
      rentalEndTime: rental.endTime,
      scheduledOnTime: "",
      scheduledOffTime: rental.endTime,
    }))
    .map((task, index) => {
      if (index > 0) {
        scheduledOnMinutes += task.park === previousPark ? 5 : 15;
      }

      previousPark = task.park;

      return {
        ...task,
        scheduledOnTime: minutesToTime(scheduledOnMinutes),
      };
    });
}
