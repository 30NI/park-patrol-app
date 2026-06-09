export type WashroomStatus = "Green" | "Yellow" | "Red";
export type TimedCheckStatus = WashroomStatus;
export type GarbageCheckType = "litter" | "garbageCans";

export type ActivityCategory =
  | "washroom"
  | "rental"
  | "lights"
  | "garbage"
  | "report";

export type ActivityLogEntry = {
  id: string;
  timestamp: string;
  park?: string;
  category: ActivityCategory;
  action: string;
  notes?: string;
  targetId?: string;
};
