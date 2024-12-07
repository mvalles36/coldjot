import {
  addMinutes,
  addHours,
  addDays,
  isWithinInterval,
  setHours,
  setMinutes,
  isSameDay,
  addBusinessDays,
  isWeekend,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { BusinessHours } from "@/types/sequences";

interface DelayConfig {
  amount: number;
  unit: "minutes" | "hours" | "days";
}

export function calculateNextSendTime(
  currentTime: Date,
  delay: DelayConfig,
  businessHours: BusinessHours
): Date {
  // Convert current time to business timezone
  const zonedCurrentTime = toZonedTime(currentTime, businessHours.timezone);

  // Calculate initial delay
  let nextTime = addDelay(zonedCurrentTime, delay);

  // If we're using business hours, adjust the time to fall within them
  nextTime = adjustToBusinessHours(nextTime, businessHours);

  // Convert back to UTC by formatting in UTC timezone
  return new Date(
    formatInTimeZone(
      nextTime,
      businessHours.timezone,
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    )
  );
}

function addDelay(date: Date, delay: DelayConfig): Date {
  switch (delay.unit) {
    case "minutes":
      return addMinutes(date, delay.amount);
    case "hours":
      return addHours(date, delay.amount);
    case "days":
      return addBusinessDays(date, delay.amount);
    default:
      throw new Error(`Invalid delay unit: ${delay.unit}`);
  }
}

function adjustToBusinessHours(date: Date, businessHours: BusinessHours): Date {
  const [startHour, startMinute] = businessHours.workHours.start
    .split(":")
    .map(Number);
  const [endHour, endMinute] = businessHours.workHours.end
    .split(":")
    .map(Number);

  let adjustedDate = date;

  // Keep adjusting until we find a valid business day and time
  while (true) {
    // Check if it's a holiday
    const isHoliday = businessHours.holidays.some((holiday) =>
      isSameDay(adjustedDate, holiday)
    );

    // Check if it's a work day
    const isWorkDay = businessHours.workDays.includes(adjustedDate.getDay());

    if (isHoliday || !isWorkDay) {
      // Move to next day at start time
      adjustedDate = setHours(addDays(adjustedDate, 1), startHour);
      adjustedDate = setMinutes(adjustedDate, startMinute);
      continue;
    }

    // Create work hours interval for the current day
    const dayStart = setHours(setMinutes(adjustedDate, startMinute), startHour);
    const dayEnd = setHours(setMinutes(adjustedDate, endMinute), endHour);

    // Check if the time falls within business hours
    if (isWithinInterval(adjustedDate, { start: dayStart, end: dayEnd })) {
      break; // We found a valid time
    }

    // If it's before business hours, set to start of current day
    if (adjustedDate < dayStart) {
      adjustedDate = dayStart;
      break;
    }

    // If it's after business hours, move to next business day
    adjustedDate = setHours(addDays(adjustedDate, 1), startHour);
    adjustedDate = setMinutes(adjustedDate, startMinute);
  }

  return adjustedDate;
}

export function isWithinBusinessHours(
  date: Date,
  businessHours: BusinessHours
): boolean {
  // Convert to business timezone
  const zonedDate = toZonedTime(date, businessHours.timezone);

  // Check if it's a holiday
  const isHoliday = businessHours.holidays.some((holiday) =>
    isSameDay(zonedDate, holiday)
  );
  if (isHoliday) return false;

  // Check if it's a work day
  const isWorkDay = businessHours.workDays.includes(zonedDate.getDay());
  if (!isWorkDay) return false;

  // Check if it's within work hours
  const [startHour, startMinute] = businessHours.workHours.start
    .split(":")
    .map(Number);
  const [endHour, endMinute] = businessHours.workHours.end
    .split(":")
    .map(Number);

  const dayStart = setHours(setMinutes(zonedDate, startMinute), startHour);
  const dayEnd = setHours(setMinutes(zonedDate, endMinute), endHour);

  return isWithinInterval(zonedDate, { start: dayStart, end: dayEnd });
}

export function getNextBusinessDay(
  date: Date,
  businessHours: BusinessHours
): Date {
  let nextDay = addDays(date, 1);

  while (
    isWeekend(nextDay) ||
    !businessHours.workDays.includes(nextDay.getDay()) ||
    businessHours.holidays.some((holiday) => isSameDay(nextDay, holiday))
  ) {
    nextDay = addDays(nextDay, 1);
  }

  return nextDay;
}

export function calculateProcessingWindow(businessHours: BusinessHours): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const zonedNow = toZonedTime(now, businessHours.timezone);

  const [startHour, startMinute] = businessHours.workHours.start
    .split(":")
    .map(Number);
  const [endHour, endMinute] = businessHours.workHours.end
    .split(":")
    .map(Number);

  const todayStart = setHours(setMinutes(zonedNow, startMinute), startHour);
  const todayEnd = setHours(setMinutes(zonedNow, endMinute), endHour);

  // If we're before today's start time, use today's window
  if (zonedNow < todayStart) {
    return { start: todayStart, end: todayEnd };
  }

  // If we're after today's end time or it's not a business day,
  // find the next business day
  if (
    zonedNow > todayEnd ||
    !businessHours.workDays.includes(zonedNow.getDay()) ||
    businessHours.holidays.some((holiday) => isSameDay(zonedNow, holiday))
  ) {
    const nextBusinessDay = getNextBusinessDay(zonedNow, businessHours);
    const nextStart = setHours(
      setMinutes(nextBusinessDay, startMinute),
      startHour
    );
    const nextEnd = setHours(setMinutes(nextBusinessDay, endMinute), endHour);
    return { start: nextStart, end: nextEnd };
  }

  // We're within today's business hours
  return { start: zonedNow, end: todayEnd };
}
