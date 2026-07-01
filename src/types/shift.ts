export type ShiftTimelineTask = {
  id: string;
  time: string;
  endTime?: string;
  sortOrder: number;
  category: "washroom" | "rental" | "lights" | "garbage" | "custom";
  title: string;
  detail: string;
  href: string;
  targetId?: string;
  targetIds?: string[];
};
