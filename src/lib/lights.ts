import type { LightTask } from "@/types/light";
import type { Rental } from "@/types/rental";
import { minutesToTime, timeToMinutes } from "./time";

const lightStartTime = "8:30 PM";
const lightStartMinutes = timeToMinutes(lightStartTime);
const latestLightOnMinutes = timeToMinutes("8:55 PM");

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
      const endTimeDifference = timeToMinutes(a.endTime) - timeToMinutes(b.endTime);

      if (endTimeDifference !== 0) {
        return endTimeDifference;
      }

      const parkCompare = a.park.localeCompare(b.park);

      if (parkCompare !== 0) {
        return parkCompare;
      }

      return a.facility.localeCompare(b.facility);
    });

  let previousPark = "";
  let cumulativeRouteMinutes = 0;
  const routeOffsets = lightRentals.map((rental) => {
    if (previousPark !== "") {
      cumulativeRouteMinutes += rental.park === previousPark ? 5 : 15;
    }

    previousPark = rental.park;

    return cumulativeRouteMinutes;
  });
  const scheduledStartMinutes = Math.min(
    lightStartMinutes,
    latestLightOnMinutes - cumulativeRouteMinutes,
  );

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
    .flatMap((task, index) => {
      const scheduledOnMinutes = scheduledStartMinutes + routeOffsets[index];

      if (scheduledOnMinutes >= timeToMinutes(task.scheduledOffTime)) {
        return [];
      }

      return [{
        ...task,
        scheduledOnTime: minutesToTime(scheduledOnMinutes),
      }];
    });
}
