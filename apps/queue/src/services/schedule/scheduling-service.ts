import { ProcessingJob, StepType } from "@mailjot/types";
import {
  ProcessingWindow,
  RateLimits,
  SequenceStep,
  TimingType,
  BusinessHours,
} from "@mailjot/types";
import { logger } from "@/services/log/logger";
import {
  addDays,
  addHours,
  addMinutes,
  format,
  parse,
  isWeekend,
  setHours,
  setMinutes,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";
import sinon from "sinon";

// Development mode flag
const isDevelopment = process.env.NODE_ENV === "development";

export interface ScheduleGenerator {
  calculateNextRun(
    currentTime: Date,
    step: SequenceStep,
    businessHours?: BusinessHours,
    rateLimits?: RateLimits,
    isDemoMode?: boolean
  ): Date;

  distributeLoad(
    jobs: ProcessingJob[],
    window: ProcessingWindow,
    limits: RateLimits
  ): ProcessingJob[];

  // Add new methods for time manipulation
  advanceTimeTo?(targetDate: Date): void;
  resetTime?(): void;
}

export class SchedulingService implements ScheduleGenerator {
  private clock?: sinon.SinonFakeTimers;
  private defaultRateLimits: RateLimits = {
    perMinute: 60,
    perHour: 500,
    perDay: 2000,
    perContact: 3,
    perSequence: 1000,
    cooldown: {
      afterBounce: 24 * 60 * 60 * 1000, // 24 hours
      afterError: 15 * 60 * 1000, // 15 minutes
    },
  };

  constructor() {
    if (isDevelopment) {
      this.clock = sinon.useFakeTimers({
        now: new Date(),
        shouldAdvanceTime: true,
      });
      logger.info("🔧 Development mode: Time manipulation enabled");
    }
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  // Method to advance time to a specific date (only in development)
  public advanceTimeTo(targetDate: Date): void {
    if (!isDevelopment) {
      logger.warn("⚠️ Time manipulation is only available in development mode");
      return;
    }

    if (this.clock) {
      const currentTime = new Date();
      const timeToAdvance = targetDate.getTime() - currentTime.getTime();

      if (timeToAdvance > 0) {
        this.clock.tick(timeToAdvance);
        logger.info("⏰ Advanced time to:", {
          from: currentTime.toISOString(),
          to: new Date().toISOString(),
          advancedBy: `${timeToAdvance}ms`,
        });
      } else {
        logger.warn("⚠️ Cannot advance time to the past", {
          current: currentTime.toISOString(),
          target: targetDate.toISOString(),
        });
      }
    }
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  // Method to reset time to real time (only in development)
  public resetTime(): void {
    if (!isDevelopment) {
      logger.warn("⚠️ Time manipulation is only available in development mode");
      return;
    }

    if (this.clock) {
      this.clock.restore();
      this.clock = sinon.useFakeTimers({
        now: new Date(),
        shouldAdvanceTime: true,
      });
      logger.info("⏰ Reset time to current time:", new Date().toISOString());
    }
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  // Method to get current time (handles both real and fake time)
  private getCurrentTime(): Date {
    return new Date();
  }

  calculateNextRun(
    currentTime: Date,
    step: SequenceStep,
    businessHours?: BusinessHours,
    rateLimits: RateLimits = this.defaultRateLimits,
    isDemoMode: boolean = false
  ): Date {
    try {
      // Use getCurrentTime instead of new Date() for consistency
      const effectiveCurrentTime = isDevelopment
        ? this.getCurrentTime()
        : currentTime;

      logger.info("⏰ Calculating next run time", {
        currentTime: effectiveCurrentTime.toISOString(),
        stepType: step.stepType,
        timing: step.timing,
        isDemoMode,
        hasBusinessHours: !!businessHours,
        isDevelopment,
      });

      if (isDemoMode) {
        return this.calculateDemoModeNextRun(effectiveCurrentTime, step);
      }

      if (!businessHours) {
        return this.calculateNextRunWithoutBusinessHours(
          effectiveCurrentTime,
          step,
          rateLimits
        );
      }

      return this.calculateNextRunWithBusinessHours(
        effectiveCurrentTime,
        step,
        businessHours,
        rateLimits
      );
    } catch (error) {
      logger.error("Error calculating next run:", error);
      return addHours(currentTime, 1);
    }
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  private calculateDemoModeNextRun(
    currentTime: Date,
    step: SequenceStep
  ): Date {
    logger.debug("🎮 Demo mode: Calculating simplified delay");

    // Convert to minutes for consistent handling
    let delayMinutes = this.calculateBaseDelay(step);

    // Cap the delay to stay within the same day (max 8 hours)
    const maxDemoDelayMinutes = 8 * 60; // 8 hours in minutes
    const cappedDelayMinutes = Math.min(delayMinutes, maxDemoDelayMinutes);

    const demoResult = addMinutes(currentTime, cappedDelayMinutes);

    logger.debug("🎮 Demo mode: Calculated time", {
      originalDelay: delayMinutes,
      cappedDelay: cappedDelayMinutes,
      result: demoResult.toISOString(),
    });

    return demoResult;
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  private calculateNextRunWithoutBusinessHours(
    currentTime: Date,
    step: SequenceStep,
    rateLimits: RateLimits
  ): Date {
    const baseDelay = this.calculateBaseDelay(step);
    const nextRun = addMinutes(currentTime, baseDelay);

    logger.debug("⏱️ Calculated next run without business hours", {
      currentTime: currentTime.toISOString(),
      baseDelay,
      nextRun: nextRun.toISOString(),
    });

    return nextRun;
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  private calculateNextRunWithBusinessHours(
    currentTime: Date,
    step: SequenceStep,
    businessHours: BusinessHours,
    rateLimits: RateLimits
  ): Date {
    // Convert to business timezone
    const zonedDate = utcToZonedTime(currentTime, businessHours.timezone);
    logger.debug("🌐 Converted to business timezone", {
      utcTime: currentTime.toISOString(),
      zonedTime: zonedDate.toISOString(),
      timezone: businessHours.timezone,
    });

    // Calculate initial delay
    const baseDelay = this.calculateBaseDelay(step);
    let nextTime = addMinutes(zonedDate, baseDelay);

    // Adjust to business hours
    nextTime = this.adjustToBusinessHours(nextTime, businessHours);

    // Convert back to UTC
    const utcResult = new Date(
      formatInTimeZone(
        nextTime,
        businessHours.timezone,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      )
    );

    logger.info("✅ Next run time calculated", {
      finalTime: utcResult.toISOString(),
      originalTime: currentTime.toISOString(),
      totalDelay: utcResult.getTime() - currentTime.getTime(),
    });

    return utcResult;
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  private adjustToBusinessHours(
    date: Date,
    businessHours: BusinessHours
  ): Date {
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
      const dayStart = setHours(
        setMinutes(adjustedDate, startMinute),
        startHour
      );
      const dayEnd = setHours(setMinutes(adjustedDate, endMinute), endHour);

      // Check if the time falls within business hours
      if (isWithinInterval(adjustedDate, { start: dayStart, end: dayEnd })) {
        break;
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

    if (iterations >= maxIterations) {
      logger.warn("⚠️ Max iterations reached while adjusting business hours", {
        initialDate: date.toISOString(),
        finalDate: adjustedDate.toISOString(),
        iterations,
      });
    }

    return adjustedDate;
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  private isWithinBusinessHours(
    date: Date,
    businessHours: BusinessHours
  ): boolean {
    logger.debug("🔍 Checking if time is within business hours", {
      date: date.toISOString(),
      timezone: businessHours.timezone,
    });

    // Check if it's a holiday
    const isHoliday = businessHours.holidays.some((holiday) =>
      isSameDay(date, holiday)
    );
    if (isHoliday) {
      return false;
    }

    // Check if it's a work day
    const isWorkDay = businessHours.workDays.includes(date.getDay());
    if (!isWorkDay) {
      return false;
    }

    // Parse work hours
    const [startHour, startMinute] = businessHours.workHoursStart
      .split(":")
      .map(Number);
    const [endHour, endMinute] = businessHours.workHoursEnd
      .split(":")
      .map(Number);

    const dayStart = setHours(setMinutes(date, startMinute), startHour);
    const dayEnd = setHours(setMinutes(date, endMinute), endHour);

    return isWithinInterval(date, { start: dayStart, end: dayEnd });
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  private getNextBusinessDay(date: Date, businessHours: BusinessHours): Date {
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
      nextDay = addDays(nextDay, 1);
    }

    if (iterations >= maxIterations) {
      logger.warn("⚠️ Max iterations reached while finding next business day", {
        startDate: date.toISOString(),
        endDate: nextDay.toISOString(),
        iterations,
      });
    }

    return nextDay;
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  distributeLoad(
    jobs: ProcessingJob[],
    window: ProcessingWindow,
    limits: RateLimits = this.defaultRateLimits
  ): ProcessingJob[] {
    try {
      logger.debug("🔄 Distributing load", {
        jobCount: jobs.length,
        window: {
          start: window.start.toISOString(),
          end: window.end.toISOString(),
          currentLoad: window.currentLoad,
          maxJobsPerWindow: window.maxJobsPerWindow,
        },
      });

      // Sort jobs by priority
      const sortedJobs = [...jobs].sort((a, b) => a.priority - b.priority);

      // Calculate available capacity
      const windowDuration = window.end.getTime() - window.start.getTime();
      const maxJobsForWindow = Math.min(
        window.maxJobsPerWindow,
        Math.floor((windowDuration / (60 * 1000)) * limits.perMinute)
      );

      // If we're already at or over capacity, return empty array
      if (window.currentLoad >= maxJobsForWindow) {
        logger.debug("⚠️ Window at capacity", {
          currentLoad: window.currentLoad,
          maxJobs: maxJobsForWindow,
        });
        return [];
      }

      // Calculate how many more jobs we can add
      const availableCapacity = maxJobsForWindow - window.currentLoad;
      const selectedJobs = sortedJobs.slice(0, availableCapacity);

      logger.debug("✅ Load distribution complete", {
        availableCapacity,
        selectedJobCount: selectedJobs.length,
      });

      return selectedJobs;
    } catch (error) {
      logger.error("Error distributing load:", error);
      return [];
    }
  }

  //-------------------------------------------------------
  //-------------------------------------------------------
  //-------------------------------------------------------

  private calculateBaseDelay(step: SequenceStep): number {
    logger.debug("⌛ Calculating base delay", {
      stepType: step.stepType,
      timing: step.timing,
      delayAmount: step.delayAmount,
      delayUnit: step.delayUnit,
    });

    let delay: number;

    switch (step.stepType) {
      case StepType.WAIT:
        if (!step.delayAmount || !step.delayUnit) {
          delay = 60; // Default 1 hour in minutes
        } else {
          switch (step.delayUnit) {
            case "minutes":
              delay = step.delayAmount;
              break;
            case "hours":
              delay = step.delayAmount * 60;
              break;
            case "days":
              delay = step.delayAmount * 24 * 60;
              break;
            default:
              delay = 60;
          }
        }
        break;

      case StepType.MANUAL_EMAIL:
      case StepType.AUTOMATED_EMAIL:
        switch (step.timing) {
          case TimingType.IMMEDIATE:
            delay = 0;
            break;
          case TimingType.DELAY:
            delay = step.delayAmount || 60;
            break;
          default:
            delay = 30; // Default 30 minutes delay for emails
        }
        break;

      default:
        delay = 30; // Default 30 minutes for other step types
    }

    logger.debug("✓ Base delay calculated", { delay });
    return delay;
  }
}

// Export singleton instance
export const schedulingService = new SchedulingService();
