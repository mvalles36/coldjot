// Reintroducing imports from the original snippet
import sinon from "sinon";

// Importing Luxon and other necessary types
import { DateTime } from "luxon";
import {
  ProcessingJob,
  type StepType,
  RateLimits,
  SequenceStep,
  TimingType,
  BusinessHours,
  ProcessingWindow,
  StepTypeEnum,
} from "@mailjot/types";
import { logger } from "@/services/log/logger";

// Development mode flag
const isDevelopment = process.env.NODE_ENV === "development" ? true : false;
// Demo mode flag - will bypass business hours checks
const DEMO_MODE = process.env.DEMO_MODE === "true" ? true : false;

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

  // Restored time manipulation methods
  advanceTimeTo?(targetDate: Date): void;
  resetTime?(): void;
}

export class SchedulingService implements ScheduleGenerator {
  private readonly MIN_DELAY = 1; // Minimum delay in minutes
  private readonly DEFAULT_DELAY = 30; // Default delay in minutes
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
    // If in development, use sinon fake timers to allow time manipulation
    if (isDevelopment) {
      this.clock = sinon.useFakeTimers({
        now: new Date(),
        shouldAdvanceTime: true,
      });
      logger.info("🔧 Development mode: Time manipulation enabled");
    }
  }

  /**
   * Advances the current time to a specific target date/time (only in development mode).
   * This uses the sinon fake timer to simulate time passing.
   */
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

  /**
   * Resets the time to real current time (only in development mode).
   * Restores and reinitializes the fake timer to the new current real time.
   */
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

  /**
   * Returns the current time. If we are in development mode and using fake timers,
   * this will reflect the manipulated time. Otherwise, it returns the real current time.
   */
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
      // If in development, prefer the possibly faked current time
      const effectiveCurrentTime = isDevelopment
        ? this.getCurrentTime()
        : currentTime;

      logger.info(
        {
          currentTime: effectiveCurrentTime.toISOString(),
          stepType: step.stepType,
          timing: step.timing,
          delayAmount: step.delayAmount,
          delayUnit: step.delayUnit,
          isDemoMode,
          hasBusinessHours: !!businessHours,
          businessHoursTimezone: businessHours?.timezone,
          isDevelopment,
        },
        "⏰ Starting next run calculation"
      );

      const baseDelayMinutes = this.calculateBaseDelay(step, isDemoMode);
      logger.info(
        {
          baseDelayMinutes,
          inHours: baseDelayMinutes / 60,
        },
        "📊 Base delay calculated"
      );

      const utcNow = DateTime.fromJSDate(effectiveCurrentTime, { zone: "utc" });
      let targetTime = utcNow.plus({ minutes: baseDelayMinutes });

      logger.info(
        {
          utcNow: utcNow.toISO(),
          targetTime: targetTime.toISO(),
          addedMinutes: baseDelayMinutes,
        },
        "🎯 Initial target time calculated"
      );

      if (!businessHours) {
        logger.info("⏭️ No business hours defined, returning UTC target time");
        return targetTime.toJSDate();
      }

      // With business hours: Convert to local timezone and adjust
      logger.info(
        {
          fromUTC: targetTime.toISO(),
          toTimezone: businessHours.timezone,
        },
        "🌐 Converting to business hours timezone"
      );

      const localTarget = this.adjustToBusinessHours(
        targetTime.setZone(businessHours.timezone),
        businessHours
      );

      logger.info(
        {
          beforeAdjustment: targetTime.setZone(businessHours.timezone).toISO(),
          afterAdjustment: localTarget.toISO(),
          timezone: businessHours.timezone,
        },
        "⚡ Adjusted to business hours"
      );

      // Convert back to UTC
      const finalUtc = localTarget.toUTC();

      logger.info(
        {
          originalTime: effectiveCurrentTime.toISOString(),
          finalTimeUTC: finalUtc.toISO(),
          totalDelayMinutes: finalUtc.diff(utcNow, "minutes").minutes,
          businessHours: {
            start: businessHours.workHoursStart,
            end: businessHours.workHoursEnd,
            timezone: businessHours.timezone,
          },
        },
        "✅ Final calculation complete"
      );

      return finalUtc.toJSDate();
    } catch (error) {
      logger.error("❌ Error calculating next run:", error);
      return DateTime.fromJSDate(currentTime, { zone: "utc" })
        .plus({ hours: 1 })
        .toJSDate();
    }
  }

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

      // Sort by priority
      const sortedJobs = [...jobs].sort((a, b) => a.priority - b.priority);

      const windowDuration = window.end.getTime() - window.start.getTime();
      const maxJobsForWindow = Math.min(
        window.maxJobsPerWindow,
        Math.floor((windowDuration / (60 * 1000)) * limits.perMinute)
      );

      if (window.currentLoad >= maxJobsForWindow) {
        logger.debug("⚠️ Window at capacity");
        return [];
      }

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

  private calculateBaseDelay(step: SequenceStep, isDemoMode: boolean): number {
    logger.info("⌛ Starting base delay calculation", {
      stepType: step.stepType,
      timing: step.timing,
      delayAmount: step.delayAmount,
      delayUnit: step.delayUnit,
      isDemoMode,
    });

    let delay: number;

    switch (step.stepType.toUpperCase()) {
      case StepTypeEnum.WAIT:
        if (!step.delayAmount || !step.delayUnit) {
          delay = this.DEFAULT_DELAY;
          logger.debug("Using default delay for WAIT step", { delay });
        } else {
          delay = this.convertToMinutes(step.delayAmount, step.delayUnit);
          logger.debug("⏳ Calculated WAIT delay", {
            originalAmount: step.delayAmount,
            originalUnit: step.delayUnit,
            resultMinutes: delay,
          });
        }
        break;

      case StepTypeEnum.MANUAL_EMAIL:
      case StepTypeEnum.AUTOMATED_EMAIL:
        if (step.timing === TimingType.IMMEDIATE) {
          delay = 0; // No delay for immediate
          logger.debug("⚡ Immediate email, no delay");
        } else if (step.timing === TimingType.DELAY && step.delayAmount) {
          // Use exact delay if specified
          delay = step.delayAmount;
          logger.debug("⏰ Using exact specified delay", {
            specifiedDelay: step.delayAmount,
          });
        } else {
          delay = this.DEFAULT_DELAY;
          logger.debug("⚠️ No timing specified, using default delay", {
            delay,
          });
        }
        break;

      default:
        delay = this.DEFAULT_DELAY;
        logger.debug("⚠️ Unknown step type, using default delay", { delay });
    }

    // Only apply minimum delay if it's more than 30 minutes
    if (delay > this.DEFAULT_DELAY) {
      delay = Math.max(delay, this.DEFAULT_DELAY);
      logger.debug("📊 Applied minimum delay threshold", {
        finalDelay: delay,
        reason: "Delay > 30 minutes",
      });
    } else {
      logger.debug("📊 Using exact delay", {
        delay,
        reason: "Delay <= 30 minutes",
      });
    }

    if (isDemoMode) {
      const originalDelay = delay;
      delay = Math.min(delay, 480); // Cap at 8 hours for demo mode
      logger.info("🎮 Demo mode delay adjustment", {
        originalDelay,
        cappedDelay: delay,
        wasAdjusted: originalDelay !== delay,
      });
    }

    logger.info("✅ Final base delay calculated", {
      finalDelayMinutes: delay,
      inHours: delay / 60,
      isDemoMode,
    });

    return delay;
  }

  private convertToMinutes(amount: number, unit: string): number {
    switch (unit) {
      case "minutes":
        return amount;
      case "hours":
        return amount * 60;
      case "days":
        return amount * 24 * 60;
      default:
        return 60; // default
    }
  }

  private isValidBusinessTime(
    dt: DateTime,
    businessHours: BusinessHours
  ): boolean {
    // If in demo mode, always return true
    if (DEMO_MODE) {
      logger.debug("🎮 Demo mode: Bypassing business hours check");
      return true;
    }

    const { workDays, holidays, timezone } = businessHours;

    // Check if holiday
    const isHoliday = holidays.some((h) =>
      dt.hasSame(DateTime.fromJSDate(h, { zone: timezone }), "day")
    );

    // Check if workday
    const isWorkDay = workDays.includes(dt.weekday % 7);

    const [startHour, startMinute] = businessHours.workHoursStart
      .split(":")
      .map(Number);
    const [endHour, endMinute] = businessHours.workHoursEnd
      .split(":")
      .map(Number);

    const dayStart = dt.set({
      hour: startHour,
      minute: startMinute,
      second: 0,
    });
    const dayEnd = dt.set({ hour: endHour, minute: endMinute, second: 0 });

    const isWithinHours = dt >= dayStart && dt <= dayEnd;

    logger.debug("🔍 Checking business time validity", {
      dateTime: dt.toISO(),
      isHoliday,
      isWorkDay,
      isWithinHours,
      dayStart: dayStart.toISO(),
      dayEnd: dayEnd.toISO(),
      demoMode: DEMO_MODE,
    });

    return !isHoliday && isWorkDay && isWithinHours;
  }

  private adjustToBusinessHours(
    date: DateTime,
    businessHours: BusinessHours
  ): DateTime {
    logger.info("🕒 Starting business hours adjustment", {
      inputDate: date.toISO(),
      timezone: businessHours.timezone,
      workHours: {
        start: businessHours.workHoursStart,
        end: businessHours.workHoursEnd,
      },
      workDays: businessHours.workDays,
      demoMode: DEMO_MODE,
    });

    // If in demo mode, return the date as is
    if (DEMO_MODE) {
      logger.debug("�� Demo mode: Skipping business hours adjustment");
      return date;
    }

    const { workHoursStart, workHoursEnd, workDays, holidays, timezone } =
      businessHours;
    const [startHour, startMinute] = workHoursStart.split(":").map(Number);
    const [endHour, endMinute] = workHoursEnd.split(":").map(Number);

    let adjusted = date;
    let iteration = 0;
    const maxIterations = 14;

    while (
      !this.isValidBusinessTime(adjusted, businessHours) &&
      iteration < maxIterations
    ) {
      iteration++;
      logger.debug(`🔄 Adjustment iteration ${iteration}`, {
        currentDateTime: adjusted.toISO(),
      });

      const dayStart = adjusted.set({
        hour: startHour,
        minute: startMinute,
        second: 0,
      });
      const dayEnd = adjusted.set({
        hour: endHour,
        minute: endMinute,
        second: 0,
      });

      // If holiday/not a workday or before dayStart
      if (
        !workDays.includes(adjusted.weekday % 7) ||
        holidays.some((h) =>
          adjusted.hasSame(DateTime.fromJSDate(h, { zone: timezone }), "day")
        ) ||
        adjusted < dayStart
      ) {
        logger.debug("📅 Invalid business day or before hours", {
          isWorkDay: workDays.includes(adjusted.weekday % 7),
          isBeforeStart: adjusted < dayStart,
          currentTime: adjusted.toISO(),
          dayStart: dayStart.toISO(),
        });
        // Move to the start of the next valid day
        adjusted = this.nextBusinessStart(adjusted, businessHours);
        continue;
      }

      // If after business hours
      if (adjusted > dayEnd) {
        logger.debug("🌙 After business hours", {
          currentTime: adjusted.toISO(),
          dayEnd: dayEnd.toISO(),
        });
        adjusted = this.nextBusinessStart(
          adjusted.plus({ days: 1 }),
          businessHours
        );
      }
    }

    if (iteration >= maxIterations) {
      logger.warn("⚠️ Max iterations reached while adjusting business hours", {
        initialDate: date.toISO(),
        finalDate: adjusted.toISO(),
        iterations: iteration,
      });
    }

    logger.info("✅ Business hours adjustment complete", {
      inputDate: date.toISO(),
      adjustedDate: adjusted.toISO(),
      iterations: iteration,
      timezone: businessHours.timezone,
      demoMode: DEMO_MODE,
    });

    return adjusted;
  }

  private nextBusinessStart(
    date: DateTime,
    businessHours: BusinessHours
  ): DateTime {
    logger.debug("🔄 Finding next business day start", {
      fromDate: date.toISO(),
      timezone: businessHours.timezone,
    });

    const { workHoursStart, workDays, holidays, timezone } = businessHours;
    const [startHour, startMinute] = workHoursStart.split(":").map(Number);

    let candidate = date
      .startOf("day")
      .set({ hour: startHour, minute: startMinute });
    let iteration = 0;
    const maxIterations = 14;

    while (iteration < maxIterations) {
      iteration++;
      const isHoliday = holidays.some((h) =>
        candidate.hasSame(DateTime.fromJSDate(h, { zone: timezone }), "day")
      );
      const isWorkDay = workDays.includes(candidate.weekday % 7);

      logger.debug(`📅 Checking candidate day (iteration ${iteration})`, {
        candidateDate: candidate.toISO(),
        isHoliday,
        isWorkDay,
        weekday: candidate.weekday,
      });

      if (!isHoliday && isWorkDay) {
        logger.debug("✅ Valid business day found", {
          date: candidate.toISO(),
          iterations: iteration,
        });
        return candidate;
      }

      candidate = candidate
        .plus({ days: 1 })
        .set({ hour: startHour, minute: startMinute });
    }

    logger.warn("⚠️ Max iterations reached while finding next business day", {
      startDate: date.toISO(),
      finalCandidate: candidate.toISO(),
      iterations: iteration,
    });

    return candidate;
  }
}

// Export singleton instance
export const schedulingService = new SchedulingService();
