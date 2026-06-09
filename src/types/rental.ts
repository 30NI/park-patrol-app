export type GameGroomingStatus = "alreadyGroomed" | "groomedOnShift";

export type Rental = {
  id: string;
  rentalDate: string;
  park: string;
  facility: string;
  equipmentType: string;
  startTime: string;
  endTime: string;
  eventName: string;
  eventType: string;
  scheduleType: string;
  organization: string;
  contactName: string;
  contactPhone: string;
  permitNumber: string;
  attendanceQuantity: string;
  checkedIn: boolean;
  groomingStatus?: GameGroomingStatus;
  notes: string;
};

export type RentalInput = Omit<Rental, "id" | "checkedIn" | "groomingStatus">;
