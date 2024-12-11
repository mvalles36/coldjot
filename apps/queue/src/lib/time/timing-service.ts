import { addMinutes, addHours, addDays, isWithinInterval } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import type { BusinessHours } from "@mailjot/types";

export async function calculateNextSendTime(
  timing: "immediate" | "delay",
  delay: {
    amount: number;
    unit: "minutes" | "hours" | "days";
  },
  businessHours: BusinessHours
): Promise<Date | null> {
  try {
    // Start with current time
    let nextTime = new Date();

    // If there's a delay, add it
    if (timing === "delay") {
      switch (delay.unit) {
        case "minutes":
          nextTime = addMinutes(nextTime, delay.amount);
          break;
        case "hours":
          nextTime = addHours(nextTime, delay.amount);
          break;
        case "days":
          nextTime = addDays(nextTime, delay.amount);
          break;
      }
    }

    // Convert to business hours timezone
    const zonedTime = utcToZonedTime(nextTime, businessHours.timezone);

    // Check if time falls within business hours
    const workStart = new Date(zonedTime);
    workStart.setHours(
      parseInt(businessHours.workHoursStart.split(":")[0]),
      parseInt(businessHours.workHoursStart.split(":")[1]),
      0
    );

    const workEnd = new Date(zonedTime);
    workEnd.setHours(
      parseInt(businessHours.workHoursEnd.split(":")[0]),
      parseInt(businessHours.workHoursEnd.split(":")[1]),
      0
    );

    // Check if current time is within work hours
    const isWorkHour = isWithinInterval(zonedTime, {
      start: workStart,
      end: workEnd,
    });

    // Check if current day is a work day
    const isWorkDay = businessHours.workDays.includes(zonedTime.getDay());

    // If not within work hours or not a work day, adjust to next available time
    if (!isWorkHour || !isWorkDay) {
      // Find next work day
      while (!businessHours.workDays.includes(zonedTime.getDay())) {
        zonedTime.setDate(zonedTime.getDate() + 1);
        zonedTime.setHours(
          parseInt(businessHours.workHoursStart.split(":")[0]),
          parseInt(businessHours.workHoursStart.split(":")[1]),
          0
        );
      }

      // If after work hours, move to start of next work day
      if (zonedTime > workEnd) {
        zonedTime.setDate(zonedTime.getDate() + 1);
        zonedTime.setHours(
          parseInt(businessHours.workHoursStart.split(":")[0]),
          parseInt(businessHours.workHoursStart.split(":")[1]),
          0
        );
      }

      // If before work hours, move to start of work day
      if (zonedTime < workStart) {
        zonedTime.setHours(
          parseInt(businessHours.workHoursStart.split(":")[0]),
          parseInt(businessHours.workHoursStart.split(":")[1]),
          0
        );
      }
    }

    // Check if the date is a holiday
    const isHoliday = businessHours.holidays.some(
      (holiday) =>
        holiday.getFullYear() === zonedTime.getFullYear() &&
        holiday.getMonth() === zonedTime.getMonth() &&
        holiday.getDate() === zonedTime.getDate()
    );

    // If it's a holiday, move to next work day
    if (isHoliday) {
      do {
        zonedTime.setDate(zonedTime.getDate() + 1);
        zonedTime.setHours(
          parseInt(businessHours.workHoursStart.split(":")[0]),
          parseInt(businessHours.workHoursStart.split(":")[1]),
          0
        );
      } while (
        !businessHours.workDays.includes(zonedTime.getDay()) ||
        businessHours.holidays.some(
          (holiday) =>
            holiday.getFullYear() === zonedTime.getFullYear() &&
            holiday.getMonth() === zonedTime.getMonth() &&
            holiday.getDate() === zonedTime.getDate()
        )
      );
    }

    // Convert back to UTC
    return zonedTimeToUtc(zonedTime, businessHours.timezone);
  } catch (error) {
    console.error("Error calculating next send time:", error);
    return null;
  }
}
