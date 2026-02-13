import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  buildCalendarDays,
  buildMonthlyInsight,
  buildPregnancyProbabilityDetail,
  getCycleContext,
  getDayCategory,
  startOfDay,
} from "../features/main-screen/utils";

const t = (key: string): string => key;

test("startOfDay normalizes time", () => {
  const date = new Date(2025, 0, 10, 14, 35, 50, 120);
  const normalized = startOfDay(date);

  assert.equal(normalized.getFullYear(), 2025);
  assert.equal(normalized.getMonth(), 0);
  assert.equal(normalized.getDate(), 10);
  assert.equal(normalized.getHours(), 0);
  assert.equal(normalized.getMinutes(), 0);
  assert.equal(normalized.getSeconds(), 0);
  assert.equal(normalized.getMilliseconds(), 0);
});

test("buildCalendarDays returns 6-week grid", () => {
  const days = buildCalendarDays(new Date(2025, 0, 1));

  assert.equal(days.length, 42);
  assert.equal(days.some((day) => !day.isCurrentMonth), true);
  assert.equal(days.some((day) => day.isCurrentMonth), true);
});

test("getDayCategory classifies cycle states", () => {
  const lastPeriodStart = new Date(2025, 0, 1);
  const cycleLength = 28;
  const periodLength = 5;

  assert.equal(
    getDayCategory(new Date(2025, 0, 1), lastPeriodStart, cycleLength, periodLength),
    "period",
  );
  assert.equal(
    getDayCategory(new Date(2025, 0, 10), lastPeriodStart, cycleLength, periodLength),
    "fertility",
  );
  assert.equal(
    getDayCategory(new Date(2025, 0, 15), lastPeriodStart, cycleLength, periodLength),
    "ovulation",
  );
});

test("getCycleContext returns next period and fertility windows", () => {
  const context = getCycleContext(new Date(2025, 0, 10), new Date(2025, 0, 1), 28, 5);

  assert.equal(context.daysUntilNextPeriod, 19);
  assert.equal(context.daysUntilOvulation, 5);
  assert.equal(context.isFertilityWindow, true);
  assert.equal(context.daysUntilFertilityStart, 0);
  assert.equal(context.fertilityDaysLeft, 7);
});

test("buildPregnancyProbabilityDetail returns high chance near ovulation", () => {
  const detail = buildPregnancyProbabilityDetail(
    new Date(2025, 0, 15),
    new Date(2025, 0, 1),
    28,
    5,
    ["trying_to_conceive"],
    t,
  );

  assert.equal(detail.level, "High");
  assert.equal(detail.chanceRangeLabel, "30-40%");
  assert.equal(detail.summary, "pregnancy.summaryHigh");
});

test("buildMonthlyInsight produces stable month stats", () => {
  const insight = buildMonthlyInsight(
    new Date(2025, 0, 1),
    new Date(2025, 0, 1),
    28,
    5,
    t,
    "en-US",
  );

  assert.equal(insight.monthDate.getMonth(), 0);
  assert.equal(insight.periodDays > 0, true);
  assert.equal(insight.fertilityDays > 0, true);
  assert.equal(insight.predictedSymptomScore >= 3, true);
  assert.equal(insight.periodRangeLabel.includes("January"), true);
});

test("addDays keeps date math in day precision", () => {
  const base = new Date(2025, 0, 1, 20, 30);
  const result = addDays(base, 3);

  assert.equal(result.getDate(), 4);
  assert.equal(result.getHours(), 0);
});
