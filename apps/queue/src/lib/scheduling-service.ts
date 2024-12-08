import { ProcessingJob, StepType } from "../types/queue";
import {
  ProcessingWindow,
  RateLimits,
  SequenceStep,
  TimingType,
  BusinessHours,
} from "@mailjot/types";
import { logger } from "./logger";
import { addDays, addHours, addMinutes, format, parse } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export interface ScheduleGenerator {
  calculateNextRun(
    currentTime: Date,
    step: SequenceStep,
    businessHours?: BusinessHours,
    rateLimits?: RateLimits
  ): Date;

  distributeLoad(
    jobs: ProcessingJob[],
    window: ProcessingWindow,
    limits: RateLimits
  ): ProcessingJob[];
}

export class SchedulingService implements ScheduleGenerator {
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

  calculateNextRun(
    currentTime: Date,
    step: SequenceStep,
    businessHours?: BusinessHours,
    rateLimits: RateLimits = this.defaultRateLimits
  ): Date {
    try {
      if (!businessHours) {
        return this.calculateNextRunWithoutBusinessHours(
          currentTime,
          step,
          rateLimits
        );
      }

      return this.calculateNextRunWithBusinessHours(
        currentTime,
        step,
        businessHours,
        rateLimits
      );
    } catch (error) {
      logger.error("Error calculating next run:", error);
      return addHours(currentTime, 1);
    }
  }

  private calculateNextRunWithoutBusinessHours(
    currentTime: Date,
    step: SequenceStep,
    rateLimits: RateLimits
  ): Date {
    const baseDelay = this.calculateBaseDelay(step);
    return addMinutes(currentTime, baseDelay);
  }

  private calculateNextRunWithBusinessHours(
    currentTime: Date,
    step: SequenceStep,
    businessHours: BusinessHours,
    rateLimits: RateLimits
  ): Date {
    const zonedDate = toZonedTime(currentTime, businessHours.timezone);

    // If date is already within business hours, return it
    if (this.isWithinBusinessHours(zonedDate, businessHours)) {
      return currentTime;
    }

    // Find the next business day
    let nextBusinessDay = this.getNextBusinessDay(zonedDate, businessHours);

    // Parse work hours
    const startTime = parse(
      businessHours.workHoursStart,
      "HH:mm",
      nextBusinessDay
    );

    // Set the time to the start of business hours
    nextBusinessDay.setHours(
      startTime.getHours(),
      startTime.getMinutes(),
      0,
      0
    );

    // Convert back to UTC
    return new Date(
      formatInTimeZone(
        nextBusinessDay,
        businessHours.timezone,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      )
    );
  }

  private isWithinBusinessHours(
    date: Date,
    businessHours: BusinessHours
  ): boolean {
    const dayOfWeek = date.getDay();
    if (!businessHours.workDays.includes(dayOfWeek)) {
      return false;
    }

    // Check if it's a holiday
    const dateString = format(date, "yyyy-MM-dd");
    if (
      businessHours.holidays.some(
        (holiday: Date) => format(holiday, "yyyy-MM-dd") === dateString
      )
    ) {
      return false;
    }

    // Check work hours
    const timeString = format(date, "HH:mm");
    return (
      timeString >= businessHours.workHoursStart &&
      timeString <= businessHours.workHoursEnd
    );
  }

  private getNextBusinessDay(date: Date, businessHours: BusinessHours): Date {
    let nextDay = date;
    let attempts = 0;
    const maxAttempts = 14; // Prevent infinite loop

    while (attempts < maxAttempts) {
      nextDay = addDays(nextDay, 1);

      // Skip weekends and holidays
      if (
        businessHours.workDays.includes(nextDay.getDay()) &&
        !businessHours.holidays.some(
          (holiday: Date) =>
            format(holiday, "yyyy-MM-dd") === format(nextDay, "yyyy-MM-dd")
        )
      ) {
        return nextDay;
      }

      attempts++;
    }

    // If no valid business day found within maxAttempts, return next day
    return addDays(date, 1);
  }

  distributeLoad(
    jobs: ProcessingJob[],
    window: ProcessingWindow,
    limits: RateLimits = this.defaultRateLimits
  ): ProcessingJob[] {
    try {
      // Sort jobs by priority
      const sortedJobs = [...jobs].sort((a, b) => a.priority - b.priority);

      // Calculate available capacity
      const windowDuration = window.end.getTime() - window.start.getTime(); // in milliseconds
      const maxJobsForWindow = Math.min(
        window.maxJobsPerWindow,
        Math.floor((windowDuration / (60 * 1000)) * limits.perMinute) // Convert window duration to minutes and multiply by per-minute limit
      );

      // If we're already at or over capacity, return empty array
      if (window.currentLoad >= maxJobsForWindow) {
        return [];
      }

      // Calculate how many more jobs we can add
      const availableCapacity = maxJobsForWindow - window.currentLoad;

      // Return the number of highest priority jobs that fit within our capacity
      return sortedJobs.slice(0, availableCapacity);
    } catch (error) {
      logger.error("Error distributing load:", error);
      return [];
    }
  }

  private calculateBaseDelay(step: SequenceStep): number {
    switch (step.stepType) {
      case StepType.WAIT:
        if (!step.delayAmount || !step.delayUnit) {
          return 60; // Default 1 hour in minutes
        }
        switch (step.delayUnit) {
          case "minutes":
            return step.delayAmount;
          case "hours":
            return step.delayAmount * 60;
          case "days":
            return step.delayAmount * 24 * 60;
          default:
            return 60;
        }
      case StepType.MANUAL_EMAIL:
      case StepType.AUTOMATED_EMAIL:
        // For email steps, use timing settings
        switch (step.timing) {
          case TimingType.IMMEDIATE:
            return 0;
          case TimingType.DELAY:
            return step.delayAmount || 60;
          default:
            return 30; // Default 30 minutes delay for emails
        }
      default:
        return 30; // Default 30 minutes for other step types
    }
  }
}

// Export singleton instance
export const schedulingService = new SchedulingService();
