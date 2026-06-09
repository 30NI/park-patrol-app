export const parks = [
    "Centennial Park",
    "Harold Black Park",
    "Marlene Streit Stewart Park",
    "North Pelham Park",
    "Peace Park",
  ] as const;
  
  export type ParkName = (typeof parks)[number];