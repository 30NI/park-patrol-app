import type { LightTask } from "@/types/light";
import type { Rental } from "@/types/rental";
import { minutesToTime, timeToMinutes } from "./time";

const lightStartTime = "8:00 PM";
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

      const endTimeDifference = timeToMinutes(a.endTime) - timeToMinutes(b.endTime);

      return endTimeDifference !== 0
        ? endTimeDifference
        : a.facility.localeCompare(b.facility);
    });
  const onTimeByRentalId = new Map<string, string>();
  let previousOnPark = "";
  let cumulativeRouteMinutes = 0;

  lightRentals.forEach((rental) => {
    if (previousOnPark) {
      cumulativeRouteMinutes += rental.park === previousOnPark ? 5 : 15;
    }

    onTimeByRentalId.set(
      rental.id,
      minutesToTime(lightStartMinutes + cumulativeRouteMinutes),
    );
    previousOnPark = rental.park;
  });

  let previousOffPark = "";
  let previousOffMinutes: number | null = null;
  const offTimeByRentalId = new Map<string, string>();

  [...lightRentals]
    .sort((a, b) => {
      const endTimeDifference = timeToMinutes(a.endTime) - timeToMinutes(b.endTime);

      if (endTimeDifference !== 0) {
        return endTimeDifference;
      }

      const parkCompare = a.park.localeCompare(b.park);

      return parkCompare !== 0
        ? parkCompare
        : a.facility.localeCompare(b.facility);
    })
    .forEach((rental) => {
      const rentalEndMinutes = timeToMinutes(rental.endTime);
      const travelMinutes =
        previousOffMinutes === null
          ? 0
          : rental.park === previousOffPark
            ? 0
            : 15;
      const scheduledOffMinutes =
        previousOffMinutes === null
          ? rentalEndMinutes
          : Math.max(rentalEndMinutes, previousOffMinutes + travelMinutes);

      offTimeByRentalId.set(rental.id, minutesToTime(scheduledOffMinutes));
      previousOffPark = rental.park;
      previousOffMinutes = scheduledOffMinutes;
    });

  return lightRentals
    .map((rental) => ({
      id: `light-${rental.id}`,
      rentalId: rental.id,
      park: rental.park,
      facility: rental.facility,
      organization: rental.organization,
      rentalStartTime: rental.startTime,
      rentalEndTime: rental.endTime,
      scheduledOnTime: onTimeByRentalId.get(rental.id) ?? lightStartTime,
      scheduledOffTime: offTimeByRentalId.get(rental.id) ?? rental.endTime,
    }))
    .flatMap((task) => {
      if (
        timeToMinutes(task.scheduledOnTime) >=
        timeToMinutes(task.scheduledOffTime)
      ) {
        return [];
      }

      return [task];
    });
}
