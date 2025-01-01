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
import { logger } from "@/lib/log";
import { prisma } from "@mailjot/database";

// const prisma = new PrismaClient();

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
  ): Promise<Date>;

  distributeLoad(
    jobs: ProcessingJob[],
    window: ProcessingWindow,
    limits: RateLimits
  ): ProcessingJob[];
}

export class ScheduleGenerator implements ScheduleGenerator {
  private static instance: ScheduleGenerator;
  private readonly MIN_DELAY = 1; // Minimum delay in minutes
  private readonly DEFAULT_DELAY = 30; // Default delay in minutes
  private readonly DISTRIBUTION_WINDOW = 15; // Minutes to distribute load within
  private readonly MAX_EMAILS_PER_MINUTE = 50; // Maximum emails per minute
  private readonly MAX_EMAILS_PER_HOUR = 1000; // Maximum emails per hour

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

  private constructor() {
    logger.info("🕒 Initializing SchedulingService");
  }

  public static getInstance(): ScheduleGenerator {
    if (!ScheduleGenerator.instance) {
      ScheduleGenerator.instance = new ScheduleGenerator();
    }
    return ScheduleGenerator.instance;
  }

  /**
   * Returns the current time. In production, this is always the real current time.
   */
  private getCurrentTime(): Date {
    return new Date();
  }

  /**
   * Calculate next run time with rate limit consideration
   */
  async calculateNextRun(
    currentTime: Date,
    step: SequenceStep,
    businessHours?: BusinessHours,
    rateLimits: RateLimits = this.defaultRateLimits,
    isDemoMode: boolean = false
  ): Promise<Date> {
    try {
      // Always use the provided current time
      const effectiveCurrentTime = currentTime;

      logger.info(
        `
---
🔄 Starting Next Run Calculation
- Current Time: ${effectiveCurrentTime.toISOString()}
- Step Type: ${step.stepType}
- Timing: ${step.timing}
- Delay Amount: ${step.delayAmount || "N/A"}
- Delay Unit: ${step.delayUnit || "N/A"}
- Demo Mode: ${isDemoMode}
- Has Business Hours: ${!!businessHours}
- Business Hours Timezone: ${businessHours?.timezone || "N/A"}
- Development Mode: ${isDevelopment}
---`
      );

      const baseDelayMinutes = this.calculateBaseDelay(step, isDemoMode);
      logger.info(
        `
---
📊 Base Delay Calculation
- Base Delay (minutes): ${baseDelayMinutes}
- Base Delay (hours): ${(baseDelayMinutes / 60).toFixed(2)}
---`
      );

      const utcNow = DateTime.fromJSDate(effectiveCurrentTime, { zone: "utc" });
      let targetTime = utcNow.plus({ minutes: baseDelayMinutes });

      logger.info(
        `
---
🎯 Initial Target Time
- UTC Now: ${utcNow.toISO()}
- Target Time: ${targetTime.toISO()}
- Added Minutes: ${baseDelayMinutes}
- Time Difference: ${targetTime.diff(utcNow).toHuman()}
---`
      );

      if (!businessHours) {
        logger.info(
          `
---
⏭️ No Business Hours Defined
- Returning UTC Target Time: ${targetTime.toISO()}
- No Business Hours Adjustments Needed
---`
        );
        return targetTime.toJSDate();
      }

      // With business hours: Convert to local timezone and adjust
      logger.info(
        `
---
🌐 Converting to Business Hours Timezone
- From UTC: ${targetTime.toISO()}
- To Timezone: ${businessHours.timezone}
- Business Hours: ${businessHours.workHoursStart} - ${businessHours.workHoursEnd}
- Work Days: ${businessHours.workDays.join(", ")}
---`
      );

      let localTarget = this.adjustToBusinessHours(
        targetTime.setZone(businessHours.timezone),
        businessHours
      );

      // Check rate limits and adjust if needed
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const { minuteAvailable, hourAvailable } =
          await this.checkTimeSlotAvailability(localTarget);

        if (minuteAvailable && hourAvailable) {
          break;
        }

        logger.info(
          `
---
⚖️ Rate Limit Adjustment (Attempt ${attempts + 1})
- Minute Available: ${minuteAvailable}
- Hour Available: ${hourAvailable}
- Current Time: ${localTarget.toISO()}
---`
        );

        // Adjust time based on availability
        if (!minuteAvailable) {
          const distributionMinutes = Math.floor(
            Math.random() * this.DISTRIBUTION_WINDOW
          );
          localTarget = localTarget.plus({ minutes: distributionMinutes });
          logger.info(
            `
---
⏱️ Minute Rate Limit Adjustment
- Added Minutes: ${distributionMinutes}
- New Target: ${localTarget.toISO()}
---`
          );
        }

        if (!hourAvailable) {
          localTarget = localTarget.plus({ hours: 1 });
          const distributionMinutes = Math.floor(Math.random() * 60);
          localTarget = localTarget.set({ minute: distributionMinutes });
          logger.info(
            `
---
⏰ Hour Rate Limit Adjustment
- Added Hours: 1
- Random Minutes: ${distributionMinutes}
- New Target: ${localTarget.toISO()}
---`
          );
        }

        // If we've moved outside business hours, find next business day
        if (!this.isValidBusinessTime(localTarget, businessHours)) {
          const oldTarget = localTarget;
          localTarget = this.nextBusinessStart(localTarget, businessHours);
          logger.info(
            `
---
📅 Business Hours Adjustment
- Outside Business Hours Detected
- Old Target: ${oldTarget.toISO()}
- New Target: ${localTarget.toISO()}
- Adjustment: ${localTarget.diff(oldTarget).toHuman()}
---`
          );
        }

        attempts++;
      }

      // Convert back to UTC
      const finalUtc = localTarget.toUTC();

      logger.info(
        `
---
✅ Final Calculation Complete
- Original Time: ${effectiveCurrentTime.toISOString()}
- Final Time (UTC): ${finalUtc.toISO()}
- Total Delay: ${finalUtc.diff(utcNow, ["hours", "minutes"]).toHuman()}
- Business Hours:
  • Start: ${businessHours.workHoursStart}
  • End: ${businessHours.workHoursEnd}
  • Timezone: ${businessHours.timezone}
- Rate Limit Attempts: ${attempts}
---`
      );

      return finalUtc.toJSDate();
    } catch (error) {
      logger.error(
        `
---
❌ Error Calculating Next Run
- Error: ${error instanceof Error ? error.message : "Unknown error"}
- Fallback: Adding 1 hour to current time
---`
      );
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
      logger.debug("🎮 Demo mode: Skipping business hours adjustment");
      return date;
    }

    const { workHoursStart, workHoursEnd, workDays, holidays, timezone } =
      businessHours;
    const [startHour, startMinute] = workHoursStart.split(":").map(Number);
    const [endHour, endMinute] = workHoursEnd.split(":").map(Number);

    let result = date;
    let iteration = 0;
    const maxIterations = 14;

    // First check if the current time is already valid
    if (this.isValidBusinessTime(result, businessHours)) {
      logger.debug("✅ Time is already within business hours", {
        time: result.toISO(),
      });
      return result;
    }

    while (
      !this.isValidBusinessTime(result, businessHours) &&
      iteration < maxIterations
    ) {
      iteration++;
      logger.debug(`🔄 Adjustment iteration ${iteration}`, {
        currentDateTime: result.toISO(),
      });

      const dayStart = result.set({
        hour: startHour,
        minute: startMinute,
        second: 0,
      });
      const dayEnd = result.set({
        hour: endHour,
        minute: endMinute,
        second: 0,
      });

      // If holiday/not a workday or before dayStart
      if (
        !workDays.includes(result.weekday % 7) ||
        holidays.some((h) =>
          result.hasSame(DateTime.fromJSDate(h, { zone: timezone }), "day")
        ) ||
        result < dayStart
      ) {
        logger.debug("📅 Invalid business day or before hours", {
          isWorkDay: workDays.includes(result.weekday % 7),
          isBeforeStart: result < dayStart,
          currentTime: result.toISO(),
          dayStart: dayStart.toISO(),
        });
        // Move to the start of the next valid day
        result = this.nextBusinessStart(result, businessHours);
        continue;
      }

      // If after business hours
      if (result > dayEnd) {
        logger.debug("🌙 After business hours", {
          currentTime: result.toISO(),
          dayEnd: dayEnd.toISO(),
        });
        result = this.nextBusinessStart(
          result.plus({ days: 1 }),
          businessHours
        );
      }
    }

    // Add distribution within the business day ONLY if we had to adjust the time
    if (iteration > 0) {
      const businessDayMinutes =
        endHour * 60 + endMinute - (startHour * 60 + startMinute);
      const distributionMinutes = Math.floor(
        Math.random() * businessDayMinutes
      );

      // Calculate the distributed time
      result = result
        .set({
          hour: startHour,
          minute: startMinute,
          second: Math.floor(Math.random() * 60),
          millisecond: Math.floor(Math.random() * 1000),
        })
        .plus({ minutes: distributionMinutes });
    }

    logger.info("✅ Business hours adjustment complete", {
      inputDate: date.toISO(),
      adjustedDate: result.toISO(),
      timezone: businessHours.timezone,
      demoMode: DEMO_MODE,
    });

    return result;
  }

  /**
   * Check if the time slot is available based on rate limits
   */
  private async checkTimeSlotAvailability(
    dateTime: DateTime
  ): Promise<{ minuteAvailable: boolean; hourAvailable: boolean }> {
    // Get existing scheduled emails for this minute and hour
    const existingScheduled = await prisma.sequenceContact.count({
      where: {
        nextScheduledAt: {
          gte: dateTime.minus({ minutes: 1 }).toJSDate(),
          lt: dateTime.plus({ minutes: 1 }).toJSDate(),
        },
      },
    });

    const existingScheduledHour = await prisma.sequenceContact.count({
      where: {
        nextScheduledAt: {
          gte: dateTime.minus({ hours: 1 }).toJSDate(),
          lt: dateTime.plus({ hours: 1 }).toJSDate(),
        },
      },
    });

    return {
      minuteAvailable: existingScheduled < this.MAX_EMAILS_PER_MINUTE,
      hourAvailable: existingScheduledHour < this.MAX_EMAILS_PER_HOUR,
    };
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
export const scheduleGenerator = ScheduleGenerator.getInstance();
