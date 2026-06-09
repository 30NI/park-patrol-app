export type LightTask = {
  id: string;
  rentalId: string;
  park: string;
  facility: string;
  organization: string;
  rentalStartTime: string;
  rentalEndTime: string;
  scheduledOnTime: string;
  scheduledOffTime: string;
};

export type LightTaskState = {
  turnedOn: boolean;
  turnedOff: boolean;
  turnedOnAt: string | null;
  turnedOffAt: string | null;
};
