export type ShiftTimelineTask = {
  id: string;
  time: string;
  sortOrder: number;
  category: "washroom" | "rental" | "lights" | "garbage";
  title: string;
  detail: string;
  href: string;
  targetId?: string;
};
