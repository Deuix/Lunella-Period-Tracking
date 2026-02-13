import { DAY_MS } from "./index.constants";
import type {
  CalendarDay,
  CycleContext,
  DayCategory,
  GoalOption,
  MonthlyInsight,
  PregnancyProbabilityDetail,
} from "./index.types";

export function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return startOfDay(nextDate);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function diffInDays(later: Date, earlier: Date): number {
  return Math.floor((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}

export function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function buildCalendarDays(visibleMonth: Date): CalendarDay[] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: CalendarDay[] = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i -= 1) {
    const dayNumber = daysInPrevMonth - i;
    cells.push({
      date: new Date(year, month - 1, dayNumber),
      dayNumber,
      isCurrentMonth: false,
    });
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push({
      date: new Date(year, month, dayNumber),
      dayNumber,
      isCurrentMonth: true,
    });
  }

  let nextMonthDay = 1;
  while (cells.length < 42) {
    cells.push({
      date: new Date(year, month + 1, nextMonthDay),
      dayNumber: nextMonthDay,
      isCurrentMonth: false,
    });
    nextMonthDay += 1;
  }

  return cells;
}

export function getDayCategory(
  targetDate: Date,
  lastPeriodStart: Date,
  cycleLength: number,
  periodLength: number,
): DayCategory {
  const diffFromBaseline = diffInDays(targetDate, lastPeriodStart);
  const cycleIndex = Math.floor(diffFromBaseline / cycleLength);
  const cycleStart = addDays(lastPeriodStart, cycleIndex * cycleLength);
  const cycleDay = diffInDays(targetDate, cycleStart);

  if (cycleDay < periodLength) {
    return "period";
  }

  const ovulationDay = cycleLength - 14;
  const fertilityStart = ovulationDay - 5;
  const fertilityEnd = ovulationDay + 1;

  if (cycleDay === ovulationDay) {
    return "ovulation";
  }

  if (cycleDay >= fertilityStart && cycleDay <= fertilityEnd) {
    return "fertility";
  }

  return "normal";
}

export function getCycleContext(
  referenceDate: Date,
  lastPeriodStart: Date,
  cycleLength: number,
  periodLength: number,
): CycleContext {
  const today = startOfDay(referenceDate);
  const baseline = startOfDay(lastPeriodStart);
  const cycleIndex = Math.floor(diffInDays(today, baseline) / cycleLength);
  const currentCycleStart = addDays(baseline, cycleIndex * cycleLength);
  const currentCycleDay = diffInDays(today, currentCycleStart);
  const nextPeriodStart = addDays(currentCycleStart, cycleLength);

  const currentCycleOvulation = addDays(currentCycleStart, cycleLength - 14);
  const nextOvulationDate =
    diffInDays(currentCycleOvulation, today) >= 0
      ? currentCycleOvulation
      : addDays(currentCycleOvulation, cycleLength);

  const fertilityStartDate = addDays(nextOvulationDate, -5);
  const fertilityEndDate = addDays(nextOvulationDate, 1);

  const isPeriodDay = currentCycleDay >= 0 && currentCycleDay < periodLength;
  const isFertilityWindow =
    diffInDays(today, fertilityStartDate) >= 0 && diffInDays(fertilityEndDate, today) >= 0;

  return {
    currentCycleStart,
    nextPeriodStart,
    nextOvulationDate,
    fertilityStartDate,
    fertilityEndDate,
    daysUntilNextPeriod: Math.max(0, diffInDays(nextPeriodStart, today)),
    daysUntilOvulation: Math.max(0, diffInDays(nextOvulationDate, today)),
    daysUntilFertilityStart: diffInDays(fertilityStartDate, today),
    isPeriodDay,
    periodDayNumber: isPeriodDay ? currentCycleDay + 1 : 0,
    isFertilityWindow,
    fertilityDaysLeft: isFertilityWindow ? diffInDays(fertilityEndDate, today) + 1 : 0,
  };
}


export function getCycleTimingForDate(targetDate: Date, lastPeriodStart: Date, cycleLength: number) {
  const selectedDate = startOfDay(targetDate);
  const baseline = startOfDay(lastPeriodStart);
  const cycleIndex = Math.floor(diffInDays(selectedDate, baseline) / cycleLength);
  const cycleStart = addDays(baseline, cycleIndex * cycleLength);
  const ovulationDate = addDays(cycleStart, cycleLength - 14);
  const fertilityStartDate = addDays(ovulationDate, -5);
  const fertilityEndDate = addDays(ovulationDate, 1);

  return {
    ovulationDate,
    fertilityStartDate,
    fertilityEndDate,
    cycleDayNumber: diffInDays(selectedDate, cycleStart) + 1,
    daysFromOvulation: diffInDays(selectedDate, ovulationDate),
  };
}

export function buildPregnancyProbabilityDetail(
  targetDate: Date,
  lastPeriodStart: Date,
  cycleLength: number,
  periodLength: number,
  goals: GoalOption[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): PregnancyProbabilityDetail {
  const timing = getCycleTimingForDate(targetDate, lastPeriodStart, cycleLength);
  const category = getDayCategory(targetDate, lastPeriodStart, cycleLength, periodLength);
  const isTryingToConceive = goals.includes("trying_to_conceive");

  let level: PregnancyProbabilityDetail["level"] = "Low";
  let chanceRangeLabel = "5-10%";
  let summary = t("pregnancy.summaryDefault");
  let recommendation = t("pregnancy.recommendDefault");

  if (category === "period") {
    level = "Low";
    chanceRangeLabel = "1-5%";
    summary = t("pregnancy.summaryPeriod");
    recommendation = t("pregnancy.recommendPeriod");
  } else if (Math.abs(timing.daysFromOvulation) <= 1) {
    level = "High";
    chanceRangeLabel = "30-40%";
    summary = t("pregnancy.summaryHigh");
    recommendation = isTryingToConceive
      ? t("pregnancy.recommendHighConceive")
      : t("pregnancy.recommendHighAvoid");
  } else if (timing.daysFromOvulation >= -5 && timing.daysFromOvulation <= 2) {
    level = "Medium";
    chanceRangeLabel = "12-25%";
    summary = t("pregnancy.summaryMedium");
    recommendation = isTryingToConceive
      ? t("pregnancy.recommendMediumConceive")
      : t("pregnancy.recommendMediumAvoid");
  }

  return {
    level,
    chanceRangeLabel,
    summary,
    recommendation,
    ovulationDate: timing.ovulationDate,
    fertilityStartDate: timing.fertilityStartDate,
    fertilityEndDate: timing.fertilityEndDate,
    cycleDayNumber: timing.cycleDayNumber,
  };
}

export function buildMonthlyInsight(
  monthDate: Date,
  lastPeriodStart: Date,
  cycleLength: number,
  periodLength: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  dateLocale: string,
): MonthlyInsight {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let periodDays = 0;
  let ovulationDays = 0;
  let fertilityDays = 0;
  let firstPeriodDay: number | null = null;
  let lastPeriodDay: number | null = null;
  let ovulationDayOfMonth: number | null = null;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const category = getDayCategory(date, lastPeriodStart, cycleLength, periodLength);

    if (category === "period") {
      periodDays += 1;
      firstPeriodDay ??= day;
      lastPeriodDay = day;
      continue;
    }

    if (category === "ovulation") {
      ovulationDays += 1;
      ovulationDayOfMonth ??= day;
      continue;
    }

    if (category === "fertility") {
      fertilityDays += 1;
    }
  }

  const monthLabel = monthDate.toLocaleDateString(dateLocale, { month: "long" });
  const periodRangeLabel =
    firstPeriodDay !== null && lastPeriodDay !== null
      ? `${monthLabel} ${firstPeriodDay}-${lastPeriodDay}`
      : t("insights.noPredictedPeriodDays");

  const predictedSymptomScore = Math.max(
    3,
    Math.round(periodDays * 1.5 + fertilityDays * 0.6 + ovulationDays * 1.1),
  );

  return {
    monthDate,
    monthLabel,
    periodDays,
    ovulationDays,
    fertilityDays,
    ovulationDayOfMonth,
    periodRangeLabel,
    predictedSymptomScore,
  };
}
