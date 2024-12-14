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
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";
import type { BusinessHours } from "@mailjot/types";
import { logger } from "@/lib/log/logger";

interface DelayConfig {
  amount: number;
  unit: "minutes" | "hours" | "days";
}

export function calculateNextSendTime(
  currentTime: Date,
  delay: DelayConfig,
  businessHours: BusinessHours,
  isDemoMode: boolean = false
): Date {
  logger.info("⏰ Calculating next send time", {
    currentTime: currentTime.toISOString(),
    delay,
    timezone: businessHours.timezone,
    workHours: {
      start: businessHours.workHoursStart,
      end: businessHours.workHoursEnd,
    },
    workDays: businessHours.workDays,
    isDemoMode,
  });

  if (isDemoMode) {
    // In demo mode, we'll keep everything within the same day
    // and ignore business hours constraints
    logger.debug("🎮 Demo mode: Calculating simplified delay");

    // Convert to minutes for consistent handling
    let delayMinutes = 0;
    switch (delay.unit) {
      case "minutes":
        delayMinutes = delay.amount;
        break;
      case "hours":
        delayMinutes = delay.amount * 60;
        break;
      case "days":
        delayMinutes = delay.amount * 24 * 60;
        break;
    }

    // Cap the delay to stay within the same day (max 8 hours)
    const maxDemoDelayMinutes = 8 * 60; // 8 hours in minutes
    const cappedDelayMinutes = Math.min(delayMinutes, maxDemoDelayMinutes);

    const demoResult = addMinutes(currentTime, cappedDelayMinutes);

    logger.debug("🎮 Demo mode: Calculated time", {
      originalDelay: {
        amount: delay.amount,
        unit: delay.unit,
        totalMinutes: delayMinutes,
      },
      cappedDelay: {
        minutes: cappedDelayMinutes,
      },
      result: demoResult.toISOString(),
    });

    return demoResult;
  }

  // Regular processing for non-demo mode
  // Convert current time to business timezone
  const zonedCurrentTime = utcToZonedTime(currentTime, businessHours.timezone);
  logger.debug("🌐 Converted to business timezone", {
    utcTime: currentTime.toISOString(),
    zonedTime: zonedCurrentTime.toISOString(),
    timezone: businessHours.timezone,
  });

  // Calculate initial delay
  let nextTime = addDelay(zonedCurrentTime, delay);
  logger.debug("⏱️ Added initial delay", {
    beforeDelay: zonedCurrentTime.toISOString(),
    afterDelay: nextTime.toISOString(),
    delay,
  });

  // If we're using business hours, adjust the time to fall within them
  nextTime = adjustToBusinessHours(nextTime, businessHours);
  logger.debug("📅 Adjusted to business hours", {
    beforeAdjustment: zonedCurrentTime.toISOString(),
    afterAdjustment: nextTime.toISOString(),
  });

  // Convert back to UTC by formatting in UTC timezone
  const utcResult = new Date(
    formatInTimeZone(
      nextTime,
      businessHours.timezone,
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    )
  );

  logger.info("✅ Next send time calculated", {
    finalTime: utcResult.toISOString(),
    originalTime: currentTime.toISOString(),
    totalDelay: utcResult.getTime() - currentTime.getTime(),
  });

  return utcResult;
}

function addDelay(date: Date, delay: DelayConfig): Date {
  logger.debug("⌛ Adding delay", {
    startDate: date.toISOString(),
    amount: delay.amount,
    unit: delay.unit,
  });

  let result: Date;
  switch (delay.unit) {
    case "minutes":
      result = addMinutes(date, delay.amount);
      break;
    case "hours":
      result = addHours(date, delay.amount);
      break;
    case "days":
      result = addBusinessDays(date, delay.amount);
      break;
    default:
      logger.error("❌ Invalid delay unit", { unit: delay.unit });
      throw new Error(`Invalid delay unit: ${delay.unit}`);
  }

  logger.debug("✓ Delay added", {
    startDate: date.toISOString(),
    endDate: result.toISOString(),
    delay,
  });

  return result;
}

function adjustToBusinessHours(date: Date, businessHours: BusinessHours): Date {
  logger.debug("🕒 Adjusting to business hours", {
    initialDate: date.toISOString(),
    workHours: {
      start: businessHours.workHoursStart,
      end: businessHours.workHoursEnd,
    },
    workDays: businessHours.workDays,
  });

  const [startHour, startMinute] = businessHours.workHoursStart
    .split(":")
    .map(Number);
  const [endHour, endMinute] = businessHours.workHoursEnd
    .split(":")
    .map(Number);

  let adjustedDate = date;
  let iterations = 0;
  const maxIterations = 14; // Prevent infinite loops

  // Keep adjusting until we find a valid business day and time
  while (iterations < maxIterations) {
    iterations++;
    logger.debug(`🔄 Adjustment iteration ${iterations}`, {
      currentDate: adjustedDate.toISOString(),
    });

    // Check if it's a holiday
    const isHoliday = businessHours.holidays.some((holiday) =>
      isSameDay(adjustedDate, holiday)
    );

    // Check if it's a work day
    const isWorkDay = businessHours.workDays.includes(adjustedDate.getDay());

    if (isHoliday || !isWorkDay) {
      logger.debug("📅 Not a valid business day", {
        date: adjustedDate.toISOString(),
        isHoliday,
        isWorkDay,
        dayOfWeek: adjustedDate.getDay(),
      });

      // Move to next day at start time
      adjustedDate = setHours(addDays(adjustedDate, 1), startHour);
      adjustedDate = setMinutes(adjustedDate, startMinute);
      continue;
    }

    // Create work hours interval for the current day
    const dayStart = setHours(setMinutes(adjustedDate, startMinute), startHour);
    const dayEnd = setHours(setMinutes(adjustedDate, endMinute), endHour);

    logger.debug("⏰ Checking work hours", {
      time: adjustedDate.toISOString(),
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
    });

    // Check if the time falls within business hours
    if (isWithinInterval(adjustedDate, { start: dayStart, end: dayEnd })) {
      logger.debug("✅ Time is within business hours", {
        time: adjustedDate.toISOString(),
      });
      break; // We found a valid time
    }

    // If it's before business hours, set to start of current day
    if (adjustedDate < dayStart) {
      logger.debug("⏪ Time is before business hours", {
        time: adjustedDate.toISOString(),
        movingTo: dayStart.toISOString(),
      });
      adjustedDate = dayStart;
      break;
    }

    // If it's after business hours, move to next business day
    logger.debug("⏩ Time is after business hours", {
      time: adjustedDate.toISOString(),
      movingToNextDay: true,
    });
    adjustedDate = setHours(addDays(adjustedDate, 1), startHour);
    adjustedDate = setMinutes(adjustedDate, startMinute);
  }

  if (iterations >= maxIterations) {
    logger.warn("⚠️ Max iterations reached while adjusting business hours", {
      initialDate: date.toISOString(),
      finalDate: adjustedDate.toISOString(),
      iterations,
    });
  }

  logger.debug("✅ Business hours adjustment complete", {
    initialDate: date.toISOString(),
    finalDate: adjustedDate.toISOString(),
    iterations,
  });

  return adjustedDate;
}

export function isWithinBusinessHours(
  date: Date,
  businessHours: BusinessHours
): boolean {
  logger.debug("🔍 Checking if time is within business hours", {
    date: date.toISOString(),
    timezone: businessHours.timezone,
  });

  // Convert to business timezone
  const zonedDate = utcToZonedTime(date, businessHours.timezone);

  // Check if it's a holiday
  const isHoliday = businessHours.holidays.some((holiday) =>
    isSameDay(zonedDate, holiday)
  );
  if (isHoliday) {
    logger.debug("📅 Date is a holiday", { date: zonedDate.toISOString() });
    return false;
  }

  // Check if it's a work day
  const isWorkDay = businessHours.workDays.includes(zonedDate.getDay());
  if (!isWorkDay) {
    logger.debug("📅 Not a work day", {
      date: zonedDate.toISOString(),
      dayOfWeek: zonedDate.getDay(),
    });
    return false;
  }

  // Check if it's within work hours
  const [startHour, startMinute] = businessHours.workHoursStart
    .split(":")
    .map(Number);
  const [endHour, endMinute] = businessHours.workHoursEnd
    .split(":")
    .map(Number);

  const dayStart = setHours(setMinutes(zonedDate, startMinute), startHour);
  const dayEnd = setHours(setMinutes(zonedDate, endMinute), endHour);

  const isWithinHours = isWithinInterval(zonedDate, {
    start: dayStart,
    end: dayEnd,
  });

  logger.debug("⏰ Work hours check result", {
    date: zonedDate.toISOString(),
    isWithinHours,
    workHours: {
      start: dayStart.toISOString(),
      end: dayEnd.toISOString(),
    },
  });

  return isWithinHours;
}

export function getNextBusinessDay(
  date: Date,
  businessHours: BusinessHours
): Date {
  logger.debug("📅 Finding next business day", {
    startDate: date.toISOString(),
  });

  let nextDay = addDays(date, 1);
  let iterations = 0;
  const maxIterations = 14; // Prevent infinite loops

  while (
    iterations < maxIterations &&
    (isWeekend(nextDay) ||
      !businessHours.workDays.includes(nextDay.getDay()) ||
      businessHours.holidays.some((holiday) => isSameDay(nextDay, holiday)))
  ) {
    iterations++;
    logger.debug(`🔄 Next day iteration ${iterations}`, {
      currentDate: nextDay.toISOString(),
      isWeekend: isWeekend(nextDay),
      dayOfWeek: nextDay.getDay(),
    });
    nextDay = addDays(nextDay, 1);
  }

  if (iterations >= maxIterations) {
    logger.warn("⚠️ Max iterations reached while finding next business day", {
      startDate: date.toISOString(),
      endDate: nextDay.toISOString(),
      iterations,
    });
  }

  logger.debug("✅ Found next business day", {
    startDate: date.toISOString(),
    nextBusinessDay: nextDay.toISOString(),
    iterations,
  });

  return nextDay;
}

export function calculateProcessingWindow(businessHours: BusinessHours): {
  start: Date;
  end: Date;
} {
  logger.debug("🕒 Calculating processing window", {
    timezone: businessHours.timezone,
    workHours: {
      start: businessHours.workHoursStart,
      end: businessHours.workHoursEnd,
    },
  });

  const now = new Date();
  const zonedNow = utcToZonedTime(now, businessHours.timezone);

  const [startHour, startMinute] = businessHours.workHoursStart
    .split(":")
    .map(Number);
  const [endHour, endMinute] = businessHours.workHoursEnd
    .split(":")
    .map(Number);

  const todayStart = setHours(setMinutes(zonedNow, startMinute), startHour);
  const todayEnd = setHours(setMinutes(zonedNow, endMinute), endHour);

  logger.debug("📊 Current time info", {
    currentTime: now.toISOString(),
    zonedTime: zonedNow.toISOString(),
    todayStart: todayStart.toISOString(),
    todayEnd: todayEnd.toISOString(),
  });

  // If we're before today's start time, use today's window
  if (zonedNow < todayStart) {
    logger.debug("⏪ Before today's business hours", {
      window: {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString(),
      },
    });
    return { start: todayStart, end: todayEnd };
  }

  // If we're after today's end time or it's not a business day,
  // find the next business day
  if (
    zonedNow > todayEnd ||
    !businessHours.workDays.includes(zonedNow.getDay()) ||
    businessHours.holidays.some((holiday) => isSameDay(zonedNow, holiday))
  ) {
    logger.debug("⏩ After today's business hours or non-business day", {
      afterEndTime: zonedNow > todayEnd,
      dayOfWeek: zonedNow.getDay(),
      isWorkDay: businessHours.workDays.includes(zonedNow.getDay()),
    });

    const nextBusinessDay = getNextBusinessDay(zonedNow, businessHours);
    const nextStart = setHours(
      setMinutes(nextBusinessDay, startMinute),
      startHour
    );
    const nextEnd = setHours(setMinutes(nextBusinessDay, endMinute), endHour);

    logger.debug("📅 Next business day window", {
      window: {
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
      },
    });

    return { start: nextStart, end: nextEnd };
  }

  // We're within today's business hours
  logger.debug("✅ Within today's business hours", {
    window: {
      start: zonedNow.toISOString(),
      end: todayEnd.toISOString(),
    },
  });

  return { start: zonedNow, end: todayEnd };
}
