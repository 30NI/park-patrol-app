export function timeToMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return 0;
  }

  const [, hourValue, minuteValue, period] = match;
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const normalizedHour =
    period.toUpperCase() === "PM" && hour !== 12
      ? hour + 12
      : period.toUpperCase() === "AM" && hour === 12
        ? 0
        : hour;

  return normalizedHour * 60 + minute;
}

export function minutesToTime(totalMinutes: number) {
  const minutesInDay = 24 * 60;
  const normalizedTotal =
    ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hour24 = Math.floor(normalizedTotal / 60);
  const minute = normalizedTotal % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}
