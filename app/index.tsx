import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDateLocale, persistLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";
import { streamOpenRouterChatReply } from "../services/openrouter";
import {
  addRevenueCatCustomerInfoListener,
  getPackagesFromOffering,
  getRevenueCatCustomerInfo,
  getRevenueCatOfferings,
  hasLunellaProEntitlement,
  initializeRevenueCat,
  isRevenueCatAlreadyPurchasedError,
  isRevenueCatUserCancelledError,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  presentRevenueCatPaywallIfNeeded,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  syncRevenueCatPurchases,
  type RevenueCatPackagesMap,
  type RevenueCatPlanId,
} from "../services/revenuecat";

type GoalOption = "cycle_tracking" | "trying_to_conceive" | "pregnancy_tracking";
type HomeTab = "home" | "insights" | "ai" | "tips" | "profile";
type DayCategory = "period" | "ovulation" | "fertility" | "normal";
type BreathPhase = "ready" | "inhale" | "hold" | "exhale" | "done";
type ProfileView = "main" | "settings" | "edit_profile";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type SymptomLogEntry = {
  id: string;
  dateISO: string;
  flowKey: string;
  moods: string[];
};

type MentalProgramId = "calm_reset" | "luteal_balance" | "sleep_release";
type MentalSessionFormat = "breathwork" | "grounding" | "journal";
type MentalCyclePhase = "period" | "fertility" | "luteal" | "follicular";

type MentalProgramSession = {
  id: string;
  titleKey: string;
  durationMinutes: number;
  format: MentalSessionFormat;
  promptKey: string;
  journalPromptKey: string;
  steps: string[];
};

type MentalProgram = {
  id: MentalProgramId;
  titleKey: string;
  subtitleKey: string;
  descriptionKey: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor: string;
  targetPhase: MentalCyclePhase | "any";
  sessions: MentalProgramSession[];
};

type MentalHealthLogEntry = {
  id: string;
  dateISO: string;
  programId: MentalProgramId;
  sessionId: string;
  moodBefore: number;
  moodAfter: number;
  journalNote: string;
};

type ProUpsellSource = "ai" | "insights" | "export" | "health_sync" | "passcode" | "mental_health";

type PersistedAppState = {
  isOnboardingDone: boolean;
  name: string;
  goals: GoalOption[];
  lastPeriodDateISO: string;
  cycleLength: number;
  periodLength: number;
  remindersEnabled: boolean;
  selectedFlow: string;
  selectedMoods: string[];
  insightNudgesEnabled: boolean;
  healthSyncEnabled: boolean;
  pinLockEnabled: boolean;
  aiMessages: AiMessage[];
  symptomLogs: SymptomLogEntry[];
  mentalHealthLogs: MentalHealthLogEntry[];
  aiUsageDateISO: string;
  aiUsageCount: number;
  isPro: boolean;
};

type MoodOption = {
  emoji: string;
  labelKey: string;
};

type MenstrualFlowOption = {
  key: string;
  labelKey: string;
  drops: number;
};

type GirlTip = {
  titleKey: string;
  detailKey: string;
};

type BreathStep = {
  phase: Exclude<BreathPhase, "ready" | "done">;
  labelKey: string;
  seconds: number;
  targetScale: number;
  guidanceKey: string;
};

type MonthlyInsight = {
  monthDate: Date;
  monthLabel: string;
  periodDays: number;
  ovulationDays: number;
  fertilityDays: number;
  ovulationDayOfMonth: number | null;
  periodRangeLabel: string;
  predictedSymptomScore: number;
};

type PregnancyProbabilityDetail = {
  level: "High" | "Medium" | "Low";
  chanceRangeLabel: string;
  summary: string;
  recommendation: string;
  ovulationDate: Date;
  fertilityStartDate: Date;
  fertilityEndDate: Date;
  cycleDayNumber: number;
};

type CalendarDay = {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
};

type DecoratedCalendarDay = CalendarDay & {
  category: DayCategory;
  isToday: boolean;
};

type CycleContext = {
  currentCycleStart: Date;
  nextPeriodStart: Date;
  nextOvulationDate: Date;
  fertilityStartDate: Date;
  fertilityEndDate: Date;
  daysUntilNextPeriod: number;
  daysUntilOvulation: number;
  daysUntilFertilityStart: number;
  isPeriodDay: boolean;
  periodDayNumber: number;
  isFertilityWindow: boolean;
  fertilityDaysLeft: number;
};

type NumberAdjusterProps = {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const GOAL_OPTIONS: { id: GoalOption; labelKey: string }[] = [
  { id: "cycle_tracking", labelKey: "goals.cycleTracking" },
  { id: "trying_to_conceive", labelKey: "goals.tryingToConceive" },
  { id: "pregnancy_tracking", labelKey: "goals.pregnancyTracking" },
];
const WEEK_DAY_KEYS = [
  "weekDays.sun",
  "weekDays.mon",
  "weekDays.tue",
  "weekDays.wed",
  "weekDays.thu",
  "weekDays.fri",
  "weekDays.sat",
];

const NAV_ITEMS: { key: HomeTab; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", labelKey: "nav.home", icon: "home" },
  { key: "insights", labelKey: "nav.insights", icon: "bar-chart" },
  { key: "ai", labelKey: "nav.ai", icon: "sparkles" },
  { key: "tips", labelKey: "nav.tips", icon: "bulb" },
  { key: "profile", labelKey: "nav.profile", icon: "person" },
];

const MOOD_OPTIONS: MoodOption[] = [
  { emoji: "😊", labelKey: "moods.happy" },
  { emoji: "😌", labelKey: "moods.calm" },
  { emoji: "🥰", labelKey: "moods.loved" },
  { emoji: "😴", labelKey: "moods.tired" },
  { emoji: "😣", labelKey: "moods.cramps" },
  { emoji: "😕", labelKey: "moods.low" },
  { emoji: "😤", labelKey: "moods.stressed" },
  { emoji: "🤕", labelKey: "moods.headache" },
];

const MENSTRUAL_FLOW_OPTIONS: MenstrualFlowOption[] = [
  { key: "light", labelKey: "flow.light", drops: 1 },
  { key: "medium", labelKey: "flow.medium", drops: 1 },
  { key: "heavy", labelKey: "flow.heavy", drops: 2 },
];

const GIRL_TIPS: GirlTip[] = [
  {
    titleKey: "girlTips.tip1Title",
    detailKey: "girlTips.tip1Detail",
  },
  {
    titleKey: "girlTips.tip2Title",
    detailKey: "girlTips.tip2Detail",
  },
  {
    titleKey: "girlTips.tip3Title",
    detailKey: "girlTips.tip3Detail",
  },
  {
    titleKey: "girlTips.tip4Title",
    detailKey: "girlTips.tip4Detail",
  },
  {
    titleKey: "girlTips.tip5Title",
    detailKey: "girlTips.tip5Detail",
  },
];

const MENTAL_HEALTH_PROGRAMS: MentalProgram[] = [
  {
    id: "calm_reset",
    titleKey: "mentalHealth.programCalmTitle",
    subtitleKey: "mentalHealth.programCalmSubtitle",
    descriptionKey: "mentalHealth.programCalmDescription",
    icon: "heart-pulse",
    accentColor: "#8F72C5",
    targetPhase: "fertility",
    sessions: [
      {
        id: "calm-breath-1",
        titleKey: "mentalHealth.sessionCalmBreathTitle",
        durationMinutes: 4,
        format: "breathwork",
        promptKey: "mentalHealth.sessionCalmBreathPrompt",
        journalPromptKey: "mentalHealth.journalPromptCalm",
        steps: [
          "mentalHealth.stepBoxBreathing1",
          "mentalHealth.stepBoxBreathing2",
          "mentalHealth.stepBoxBreathing3",
        ],
      },
      {
        id: "calm-ground-1",
        titleKey: "mentalHealth.sessionGroundingTitle",
        durationMinutes: 5,
        format: "grounding",
        promptKey: "mentalHealth.sessionGroundingPrompt",
        journalPromptKey: "mentalHealth.journalPromptGrounding",
        steps: [
          "mentalHealth.stepGrounding1",
          "mentalHealth.stepGrounding2",
          "mentalHealth.stepGrounding3",
        ],
      },
    ],
  },
  {
    id: "luteal_balance",
    titleKey: "mentalHealth.programLutealTitle",
    subtitleKey: "mentalHealth.programLutealSubtitle",
    descriptionKey: "mentalHealth.programLutealDescription",
    icon: "brain",
    accentColor: "#A887D9",
    targetPhase: "luteal",
    sessions: [
      {
        id: "luteal-journal-1",
        titleKey: "mentalHealth.sessionReframeTitle",
        durationMinutes: 6,
        format: "journal",
        promptKey: "mentalHealth.sessionReframePrompt",
        journalPromptKey: "mentalHealth.journalPromptReframe",
        steps: [
          "mentalHealth.stepReframe1",
          "mentalHealth.stepReframe2",
          "mentalHealth.stepReframe3",
        ],
      },
      {
        id: "luteal-breath-1",
        titleKey: "mentalHealth.sessionSlowBreathTitle",
        durationMinutes: 4,
        format: "breathwork",
        promptKey: "mentalHealth.sessionSlowBreathPrompt",
        journalPromptKey: "mentalHealth.journalPromptLuteal",
        steps: [
          "mentalHealth.stepSlowBreath1",
          "mentalHealth.stepSlowBreath2",
          "mentalHealth.stepSlowBreath3",
        ],
      },
    ],
  },
  {
    id: "sleep_release",
    titleKey: "mentalHealth.programSleepTitle",
    subtitleKey: "mentalHealth.programSleepSubtitle",
    descriptionKey: "mentalHealth.programSleepDescription",
    icon: "weather-night",
    accentColor: "#6B6EA8",
    targetPhase: "period",
    sessions: [
      {
        id: "sleep-body-1",
        titleKey: "mentalHealth.sessionBodyScanTitle",
        durationMinutes: 7,
        format: "grounding",
        promptKey: "mentalHealth.sessionBodyScanPrompt",
        journalPromptKey: "mentalHealth.journalPromptSleep",
        steps: [
          "mentalHealth.stepBodyScan1",
          "mentalHealth.stepBodyScan2",
          "mentalHealth.stepBodyScan3",
        ],
      },
      {
        id: "sleep-release-1",
        titleKey: "mentalHealth.sessionReleaseTitle",
        durationMinutes: 5,
        format: "journal",
        promptKey: "mentalHealth.sessionReleasePrompt",
        journalPromptKey: "mentalHealth.journalPromptRelease",
        steps: [
          "mentalHealth.stepRelease1",
          "mentalHealth.stepRelease2",
          "mentalHealth.stepRelease3",
        ],
      },
    ],
  },
];

const MENTAL_HEALTH_ROUTINE_DAYS = 7;
const MOOD_RATING_OPTIONS = [
  { value: 1, emoji: "😔" },
  { value: 2, emoji: "😟" },
  { value: 3, emoji: "😐" },
  { value: 4, emoji: "🙂" },
  { value: 5, emoji: "😁" },
];

const BREATHING_TOTAL_ROUNDS = 4;
const APP_STATE_STORAGE_KEY = "lunella_app_state_v1";
const FREE_AI_DAILY_LIMIT = 3;
const EMPTY_REVENUECAT_PACKAGES: RevenueCatPackagesMap = {
  monthly: null,
  yearly: null,
  lifetime: null,
};
const INITIAL_AI_MESSAGES: AiMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    text: "",
  },
];
const BREATHING_STEPS: BreathStep[] = [
  {
    phase: "inhale",
    labelKey: "breathing.inhaleLabel",
    seconds: 4,
    targetScale: 1.2,
    guidanceKey: "breathing.inhaleGuidance",
  },
  {
    phase: "hold",
    labelKey: "breathing.holdLabel",
    seconds: 3,
    targetScale: 1.2,
    guidanceKey: "breathing.holdGuidance",
  },
  {
    phase: "exhale",
    labelKey: "breathing.exhaleLabel",
    seconds: 6,
    targetScale: 1,
    guidanceKey: "breathing.exhaleGuidance",
  },
];

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return startOfDay(nextDate);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function diffInDays(later: Date, earlier: Date): number {
  return Math.floor((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function buildCalendarDays(visibleMonth: Date): CalendarDay[] {
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

function getDayCategory(
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

function getCycleContext(
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

function getMentalCyclePhase(cycleContext: CycleContext): MentalCyclePhase {
  if (cycleContext.isPeriodDay) {
    return "period";
  }

  if (cycleContext.isFertilityWindow || cycleContext.daysUntilOvulation <= 1) {
    return "fertility";
  }

  if (cycleContext.daysUntilNextPeriod <= 7) {
    return "luteal";
  }

  return "follicular";
}

function getRecommendedMentalProgramId(phase: MentalCyclePhase): MentalProgramId {
  if (phase === "period") {
    return "sleep_release";
  }

  if (phase === "luteal") {
    return "luteal_balance";
  }

  return "calm_reset";
}

function getMentalWellnessStreak(logs: MentalHealthLogEntry[]): number {
  if (logs.length === 0) {
    return 0;
  }

  const loggedDays = new Set(logs.map((entry) => entry.dateISO));
  let streak = 0;
  let cursorDate = startOfDay(new Date());

  while (loggedDays.has(cursorDate.toISOString())) {
    streak += 1;
    cursorDate = addDays(cursorDate, -1);
  }

  return streak;
}

function getMentalWellnessAverageShift(logs: MentalHealthLogEntry[]): number | null {
  if (logs.length === 0) {
    return null;
  }

  const totalShift = logs.reduce((sum, entry) => sum + (entry.moodAfter - entry.moodBefore), 0);
  return Number((totalShift / logs.length).toFixed(1));
}

function getProgramRoutineProgressDays(logs: MentalHealthLogEntry[], programId: MentalProgramId): number {
  const uniqueDays = new Set(
    logs.filter((entry) => entry.programId === programId).map((entry) => entry.dateISO),
  );
  return Math.min(MENTAL_HEALTH_ROUTINE_DAYS, uniqueDays.size);
}

function getCycleTimingForDate(targetDate: Date, lastPeriodStart: Date, cycleLength: number) {
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

function buildPregnancyProbabilityDetail(
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

function buildMonthlyInsight(
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

function DecorativeBackground() {
  return (
    <View pointerEvents="none" style={styles.decorLayer}>
      <LinearGradient
        colors={["#C9C3F2", "#EFCFDA", "#FFF9FC"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MaterialCommunityIcons
        name="flower-tulip-outline"
        size={34}
        color="#B09ACF"
        style={[styles.decorIcon, { top: 72, left: 22 }]}
      />
      <MaterialCommunityIcons
        name="flower-poppy"
        size={24}
        color="#D8A8C7"
        style={[styles.decorIcon, { top: 124, right: 26 }]}
      />
      <MaterialCommunityIcons
        name="flower"
        size={28}
        color="#CAA8D9"
        style={[styles.decorIcon, { top: "44%", left: 26 }]}
      />
      <MaterialCommunityIcons
        name="flower-outline"
        size={22}
        color="#E2BFD4"
        style={[styles.decorIcon, { top: "58%", right: 34 }]}
      />
      <View style={[styles.bubble, { top: "26%", left: "68%" }]} />
      <View style={[styles.bubble, { top: "36%", left: "18%", width: 8, height: 8 }]} />
      <View style={[styles.bubble, { top: "48%", right: "16%", width: 10, height: 10 }]} />
    </View>
  );
}

function WelcomeIllustration() {
  return (
    <View style={styles.welcomeIllustration}>
      <Image
        source={require("@/assets/images/onboarding.png")}
        style={styles.onboardingImage}
        contentFit="contain"
      />
    </View>
  );
}

function NumberAdjuster({ label, hint, value, min, max, onChange }: NumberAdjusterProps) {
  return (
    <View style={styles.adjusterWrap}>
      <View style={styles.adjusterTextWrap}>
        <Text style={styles.adjusterLabel}>{label}</Text>
        <Text style={styles.adjusterHint}>{hint}</Text>
      </View>
      <View style={styles.adjusterControls}>
        <Pressable
          style={[styles.adjustButton, value <= min && styles.adjustButtonDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={styles.adjustButtonText}>-</Text>
        </Pressable>
        <Text style={styles.adjustValue}>{value}</Text>
        <Pressable
          style={[styles.adjustButton, value >= max && styles.adjustButtonDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={styles.adjustButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Index() {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language as SupportedLanguage);
  const todayISO = startOfDay(new Date()).toISOString();

  const [isHydrated, setIsHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [isOnboardingDone, setIsOnboardingDone] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isDebugProOverrideEnabled, setIsDebugProOverrideEnabled] = useState(false);
  const [isRevenueCatEnabled, setIsRevenueCatEnabled] = useState(false);
  const [isSubscriptionModalVisible, setIsSubscriptionModalVisible] = useState(false);
  const [isRevenueCatLoading, setIsRevenueCatLoading] = useState(false);
  const [isProSuccessVisible, setIsProSuccessVisible] = useState(false);
  const [revenueCatPackages, setRevenueCatPackages] = useState<RevenueCatPackagesMap>(EMPTY_REVENUECAT_PACKAGES);

  const [name, setName] = useState("");
  const [draftProfileName, setDraftProfileName] = useState("");
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [lastPeriodDate, setLastPeriodDate] = useState(startOfDay(new Date()));
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const [onboardingMonth, setOnboardingMonth] = useState(startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState<HomeTab>("home");
  const [profileView, setProfileView] = useState<ProfileView>("main");
  const [selectedFlow, setSelectedFlow] = useState("medium");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [breathingPhase, setBreathingPhase] = useState<BreathPhase>("ready");
  const [breathingSecondsLeft, setBreathingSecondsLeft] = useState(0);
  const [breathingRound, setBreathingRound] = useState(0);
  const [breathingStepIndex, setBreathingStepIndex] = useState<number | null>(null);
  const [insightNudgesEnabled, setInsightNudgesEnabled] = useState(true);
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(false);
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);
  const [mentalHealthLogs, setMentalHealthLogs] = useState<MentalHealthLogEntry[]>([]);
  const [selectedMentalProgramId, setSelectedMentalProgramId] = useState<MentalProgramId>("calm_reset");
  const [selectedMentalSessionId, setSelectedMentalSessionId] = useState<string>(MENTAL_HEALTH_PROGRAMS[0].sessions[0].id);
  const [mentalMoodBefore, setMentalMoodBefore] = useState<number | null>(null);
  const [mentalMoodAfter, setMentalMoodAfter] = useState<number | null>(null);
  const [mentalJournalNote, setMentalJournalNote] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiUsageDateISO, setAiUsageDateISO] = useState(todayISO);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>(INITIAL_AI_MESSAGES);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [checkInHistoryVisible, setCheckInHistoryVisible] = useState(false);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);

  const monthOptions = useMemo(() => {
    const base = startOfMonth(new Date());
    return Array.from({ length: 12 }, (_, index) => addMonths(base, index - 2));
  }, []);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(2);
  const [selectedInsightsMonthIndex, setSelectedInsightsMonthIndex] = useState(2);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(startOfDay(new Date()));

  const onboardingAnimation = useRef(new Animated.Value(1)).current;
  const breathingScale = useRef(new Animated.Value(1)).current;
  const breathingRippleAnim = useRef(new Animated.Value(0)).current;
  const breathingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiMessagesScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const hydrateAppState = async () => {
      try {
        const storedStateRaw = await AsyncStorage.getItem(APP_STATE_STORAGE_KEY);
        if (!storedStateRaw) {
          setIsHydrated(true);
          return;
        }

        const storedState = JSON.parse(storedStateRaw) as Partial<PersistedAppState>;

        if (typeof storedState.isOnboardingDone === "boolean") {
          setIsOnboardingDone(storedState.isOnboardingDone);
        }
        if (typeof storedState.isPro === "boolean") {
          setIsPro(storedState.isPro);
        }
        if (typeof storedState.name === "string") {
          setName(storedState.name);
        }
        if (Array.isArray(storedState.goals)) {
          setGoals(storedState.goals.filter((goal) => GOAL_OPTIONS.some((option) => option.id === goal)) as GoalOption[]);
        }
        if (typeof storedState.lastPeriodDateISO === "string") {
          const parsedDate = new Date(storedState.lastPeriodDateISO);
          if (!Number.isNaN(parsedDate.getTime())) {
            setLastPeriodDate(startOfDay(parsedDate));
            setSelectedCalendarDate(startOfDay(parsedDate));
          }
        }
        if (typeof storedState.cycleLength === "number") {
          setCycleLength(storedState.cycleLength);
        }
        if (typeof storedState.periodLength === "number") {
          setPeriodLength(storedState.periodLength);
        }
        if (typeof storedState.remindersEnabled === "boolean") {
          setRemindersEnabled(storedState.remindersEnabled);
        }
        if (typeof storedState.selectedFlow === "string") {
          setSelectedFlow(storedState.selectedFlow);
        }
        if (Array.isArray(storedState.selectedMoods)) {
          setSelectedMoods(storedState.selectedMoods);
        }
        if (typeof storedState.insightNudgesEnabled === "boolean") {
          setInsightNudgesEnabled(storedState.insightNudgesEnabled);
        }
        if (typeof storedState.healthSyncEnabled === "boolean") {
          setHealthSyncEnabled(storedState.healthSyncEnabled);
        }
        if (typeof storedState.pinLockEnabled === "boolean") {
          setPinLockEnabled(storedState.pinLockEnabled);
        }
        if (Array.isArray(storedState.symptomLogs)) {
          setSymptomLogs(storedState.symptomLogs);
        }
        if (Array.isArray(storedState.mentalHealthLogs)) {
          setMentalHealthLogs(storedState.mentalHealthLogs);
        }
        if (typeof storedState.aiUsageDateISO === "string") {
          setAiUsageDateISO(storedState.aiUsageDateISO);
        }
        if (typeof storedState.aiUsageCount === "number") {
          setAiUsageCount(storedState.aiUsageCount);
        }

        if (Array.isArray(storedState.aiMessages) && storedState.aiMessages.length > 0) {
          setAiMessages(storedState.aiMessages);
        }
      } catch {
        // Если состояние повреждено, продолжаем со значениями по умолчанию.
      } finally {
        setIsHydrated(true);
      }
    };

    void hydrateAppState();
  }, []);

  const refreshRevenueCatState = useCallback(async () => {
    if (!isRevenueCatEnabled) {
      return;
    }

    try {
      const [customerInfo, offerings] = await Promise.all([
        getRevenueCatCustomerInfo(),
        getRevenueCatOfferings(),
      ]);

      if (customerInfo) {
        setIsPro(hasLunellaProEntitlement(customerInfo));
      }
      setRevenueCatPackages(getPackagesFromOffering(offerings?.current ?? null));
    } catch (error) {
      if (__DEV__) {
        console.warn("RevenueCat refresh failed", error);
      }
    }
  }, [isRevenueCatEnabled]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupRevenueCat = async () => {
      try {
        const enabled = await initializeRevenueCat();
        setIsRevenueCatEnabled(enabled);

        if (!enabled) {
          return;
        }

        const [customerInfo, offerings] = await Promise.all([
          getRevenueCatCustomerInfo(),
          getRevenueCatOfferings(),
        ]);

        if (customerInfo) {
          setIsPro(hasLunellaProEntitlement(customerInfo));
        }
        setRevenueCatPackages(getPackagesFromOffering(offerings?.current ?? null));

        unsubscribe = addRevenueCatCustomerInfoListener((updatedInfo) => {
          setIsPro(hasLunellaProEntitlement(updatedInfo));
        });
      } catch {
        setIsRevenueCatEnabled(false);
      }
    };

    void setupRevenueCat();

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persistedState: PersistedAppState = {
      isOnboardingDone,
      name,
      goals,
      lastPeriodDateISO: lastPeriodDate.toISOString(),
      cycleLength,
      periodLength,
      remindersEnabled,
      selectedFlow,
      selectedMoods,
      insightNudgesEnabled,
      healthSyncEnabled,
      pinLockEnabled,
      aiMessages,
      symptomLogs,
      mentalHealthLogs,
      aiUsageDateISO,
      aiUsageCount,
      isPro,
    };

    void AsyncStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(persistedState));
  }, [
    aiMessages,
    aiUsageCount,
    aiUsageDateISO,
    cycleLength,
    goals,
    healthSyncEnabled,
    insightNudgesEnabled,
    isHydrated,
    isOnboardingDone,
    isPro,
    lastPeriodDate,
    mentalHealthLogs,
    name,
    periodLength,
    pinLockEnabled,
    remindersEnabled,
    selectedFlow,
    selectedMoods,
    symptomLogs,
  ]);

  useEffect(() => {
    const currentDayISO = startOfDay(new Date()).toISOString();
    if (aiUsageDateISO !== currentDayISO) {
      setAiUsageDateISO(currentDayISO);
      setAiUsageCount(0);
    }
  }, [aiUsageDateISO]);

  useEffect(() => {
    onboardingAnimation.setValue(0);
    Animated.timing(onboardingAnimation, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, onboardingAnimation]);

  useEffect(() => {
    return () => {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab === "tips") {
      return;
    }

    if (breathingTimerRef.current) {
      clearInterval(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }

    if (breathingStepIndex !== null || breathingPhase !== "ready") {
      setBreathingStepIndex(null);
      setBreathingPhase("ready");
      setBreathingSecondsLeft(0);
      setBreathingRound(0);
      breathingScale.setValue(1);
    }
  }, [activeTab, breathingPhase, breathingScale, breathingStepIndex]);

  useEffect(() => {
    if (breathingStepIndex === null) {
      Animated.timing(breathingRippleAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
      return;
    }

    const totalSteps = BREATHING_STEPS.length * BREATHING_TOTAL_ROUNDS;

    if (breathingStepIndex >= totalSteps) {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
        breathingTimerRef.current = null;
      }

      setBreathingStepIndex(null);
      setBreathingPhase("done");
      setBreathingRound(BREATHING_TOTAL_ROUNDS);
      setBreathingSecondsLeft(0);

      Animated.parallel([
        Animated.timing(breathingScale, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(breathingRippleAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    const step = BREATHING_STEPS[breathingStepIndex % BREATHING_STEPS.length];
    const currentRound = Math.floor(breathingStepIndex / BREATHING_STEPS.length) + 1;

    setBreathingRound(currentRound);
    setBreathingPhase(step.phase);
    setBreathingSecondsLeft(step.seconds);

    Animated.parallel([
      Animated.timing(breathingScale, {
        toValue: step.targetScale,
        duration: step.seconds * 1000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathingRippleAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathingRippleAnim, {
            toValue: 0.4,
            duration: 2000,
            easing: Easing.in(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    ]).start();

    if (breathingTimerRef.current) {
      clearInterval(breathingTimerRef.current);
    }

    breathingTimerRef.current = setInterval(() => {
      setBreathingSecondsLeft((currentSeconds) => {
        if (currentSeconds <= 1) {
          if (breathingTimerRef.current) {
            clearInterval(breathingTimerRef.current);
            breathingTimerRef.current = null;
          }

          setBreathingStepIndex((currentIndex) => {
            if (currentIndex === null) {
              return null;
            }
            return currentIndex + 1;
          });
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
        breathingTimerRef.current = null;
      }
    };
  }, [breathingRippleAnim, breathingScale, breathingStepIndex]);

  useEffect(() => {
    if (activeTab !== "tips") {
      return;
    }

    if (breathingPhase === "inhale") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (breathingPhase === "hold") {
      void Haptics.selectionAsync();
      return;
    }

    if (breathingPhase === "exhale") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    if (breathingPhase === "done") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [activeTab, breathingPhase]);

  useEffect(() => {
    if (activeTab !== "ai") {
      return;
    }

    const timeout = setTimeout(() => {
      aiMessagesScrollRef.current?.scrollToEnd({ animated: true });
    }, 40);

    return () => {
      clearTimeout(timeout);
    };
  }, [activeTab, aiMessages, isAiTyping]);

  useEffect(() => {
    if (activeTab !== "ai" && isAiTyping) {
      setIsAiTyping(false);
    }
  }, [activeTab, isAiTyping]);

  useEffect(() => {
    if (activeTab !== "profile" && profileView !== "main") {
      setProfileView("main");
    }
  }, [activeTab, profileView]);

  const onboardingDays = useMemo(() => buildCalendarDays(onboardingMonth), [onboardingMonth]);
  const onboardingMonthTitle = useMemo(
    () =>
      onboardingMonth.toLocaleDateString(dateLocale, {
        month: "long",
        year: "numeric",
      }),
    [onboardingMonth, dateLocale],
  );

  const cycleContext = useMemo(
    () => getCycleContext(new Date(), lastPeriodDate, cycleLength, periodLength),
    [lastPeriodDate, cycleLength, periodLength],
  );

  const activeMonth = monthOptions[selectedMonthIndex] ?? monthOptions[2];
  const decoratedHomeDays = useMemo<DecoratedCalendarDay[]>(() => {
    return buildCalendarDays(activeMonth).map((day) => ({
      ...day,
      category: getDayCategory(day.date, lastPeriodDate, cycleLength, periodLength),
      isToday: isSameDay(day.date, new Date()),
    }));
  }, [activeMonth, lastPeriodDate, cycleLength, periodLength]);

  const monthLabel = useMemo(
    () =>
      activeMonth.toLocaleDateString(dateLocale, {
        month: "long",
        year: "numeric",
      }),
    [activeMonth, dateLocale],
  );

  const activeInsightsMonth = monthOptions[selectedInsightsMonthIndex] ?? monthOptions[2];
  const insightsMonthLabel = useMemo(
    () =>
      activeInsightsMonth.toLocaleDateString(dateLocale, {
        month: "long",
        year: "numeric",
      }),
    [activeInsightsMonth, dateLocale],
  );

  const decoratedInsightsDays = useMemo<DecoratedCalendarDay[]>(() => {
    return buildCalendarDays(activeInsightsMonth).map((day) => ({
      ...day,
      category: getDayCategory(day.date, lastPeriodDate, cycleLength, periodLength),
      isToday: isSameDay(day.date, new Date()),
    }));
  }, [activeInsightsMonth, cycleLength, lastPeriodDate, periodLength]);

  const recentInsightMonths = useMemo(() => {
    const base = startOfMonth(new Date());
    return Array.from({ length: 6 }, (_, index) => addMonths(base, index - 5));
  }, []);

  const monthlyInsights = useMemo(() => {
    return recentInsightMonths.map((monthDate) =>
      buildMonthlyInsight(monthDate, lastPeriodDate, cycleLength, periodLength, t, dateLocale),
    );
  }, [recentInsightMonths, lastPeriodDate, cycleLength, periodLength, t, dateLocale]);

  const currentMonthInsight = monthlyInsights[monthlyInsights.length - 1];

  const cycleOverviewRows = useMemo(() => {
    return monthlyInsights.map((insight) => {
      const trendValue = Math.max(20, Math.min(95, insight.periodDays * 6 + insight.fertilityDays * 4));
      return {
        label: insight.monthDate.toLocaleDateString(dateLocale, { month: "short" }),
        value: trendValue,
        display: t("insights.activeDays", { count: insight.periodDays + insight.fertilityDays }),
      };
    });
  }, [monthlyInsights, dateLocale, t]);

  const averageSymptomScore = useMemo(() => {
    const scores = monthlyInsights.map((insight) => insight.predictedSymptomScore);
    const total = scores.reduce((sum, value) => sum + value, 0);
    return Math.round(total / Math.max(1, scores.length));
  }, [monthlyInsights]);

  const recentSymptomLogs = useMemo(() => {
    const cutoffDate = addDays(startOfDay(new Date()), -45);
    return symptomLogs.filter((entry) => {
      const entryDate = new Date(entry.dateISO);
      return !Number.isNaN(entryDate.getTime()) && diffInDays(entryDate, cutoffDate) >= 0;
    });
  }, [symptomLogs]);

  const sortedSymptomLogs = useMemo(() => {
    return [...symptomLogs].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  }, [symptomLogs]);

  const mentalCyclePhase = useMemo(() => getMentalCyclePhase(cycleContext), [cycleContext]);
  const recommendedMentalProgramId = useMemo(
    () => getRecommendedMentalProgramId(mentalCyclePhase),
    [mentalCyclePhase],
  );
  const selectedMentalProgram = useMemo(
    () => MENTAL_HEALTH_PROGRAMS.find((program) => program.id === selectedMentalProgramId) ?? MENTAL_HEALTH_PROGRAMS[0],
    [selectedMentalProgramId],
  );
  const selectedMentalSession = useMemo(() => {
    return (
      selectedMentalProgram.sessions.find((session) => session.id === selectedMentalSessionId) ??
      selectedMentalProgram.sessions[0]
    );
  }, [selectedMentalProgram, selectedMentalSessionId]);
  const mentalWellnessStreak = useMemo(() => getMentalWellnessStreak(mentalHealthLogs), [mentalHealthLogs]);
  const mentalAverageMoodShift = useMemo(() => getMentalWellnessAverageShift(mentalHealthLogs), [mentalHealthLogs]);
  const selectedProgramRoutineProgressDays = useMemo(
    () => getProgramRoutineProgressDays(mentalHealthLogs, selectedMentalProgram.id),
    [mentalHealthLogs, selectedMentalProgram.id],
  );
  const hasMentalSessionToday = useMemo(() => {
    const todayDateISO = startOfDay(new Date()).toISOString();
    return mentalHealthLogs.some((entry) => entry.dateISO === todayDateISO);
  }, [mentalHealthLogs]);

  const selectedHistoryEntry = useMemo(() => {
    if (sortedSymptomLogs.length === 0) {
      return null;
    }

    if (!selectedHistoryEntryId) {
      return sortedSymptomLogs[0];
    }

    return sortedSymptomLogs.find((entry) => entry.id === selectedHistoryEntryId) ?? sortedSymptomLogs[0];
  }, [selectedHistoryEntryId, sortedSymptomLogs]);

  const selectedHistoryEntryDate = useMemo(() => {
    if (!selectedHistoryEntry) {
      return null;
    }

    return new Date(selectedHistoryEntry.dateISO);
  }, [selectedHistoryEntry]);

  const selectedHistoryFlowOption = useMemo(() => {
    if (!selectedHistoryEntry) {
      return null;
    }

    return MENSTRUAL_FLOW_OPTIONS.find((option) => option.key === selectedHistoryEntry.flowKey) ?? null;
  }, [selectedHistoryEntry]);

  const isSelectedHistoryEntryToday = useMemo(() => {
    if (!selectedHistoryEntryDate) {
      return false;
    }

    return isSameDay(selectedHistoryEntryDate, new Date());
  }, [selectedHistoryEntryDate]);

  const isSelectedHistoryEntryYesterday = useMemo(() => {
    if (!selectedHistoryEntryDate) {
      return false;
    }

    return diffInDays(startOfDay(new Date()), selectedHistoryEntryDate) === 1;
  }, [selectedHistoryEntryDate]);

  useEffect(() => {
    if (!checkInHistoryVisible) {
      return;
    }

    if (sortedSymptomLogs.length === 0) {
      if (selectedHistoryEntryId !== null) {
        setSelectedHistoryEntryId(null);
      }
      return;
    }

    if (!selectedHistoryEntryId || !sortedSymptomLogs.some((entry) => entry.id === selectedHistoryEntryId)) {
      setSelectedHistoryEntryId(sortedSymptomLogs[0].id);
    }
  }, [checkInHistoryVisible, selectedHistoryEntryId, sortedSymptomLogs]);

  useEffect(() => {
    if (selectedMentalProgram.sessions.some((session) => session.id === selectedMentalSessionId)) {
      return;
    }

    setSelectedMentalSessionId(selectedMentalProgram.sessions[0].id);
  }, [selectedMentalProgram, selectedMentalSessionId]);

  const openCheckInHistory = useCallback(() => {
    setSelectedHistoryEntryId((currentId) => {
      if (sortedSymptomLogs.length === 0) {
        return null;
      }

      if (currentId && sortedSymptomLogs.some((entry) => entry.id === currentId)) {
        return currentId;
      }

      return sortedSymptomLogs[0].id;
    });
    setCheckInHistoryVisible(true);
  }, [sortedSymptomLogs]);

  const openEditProfile = useCallback(() => {
    setDraftProfileName(name.trim());
    setProfileView("edit_profile");
  }, [name]);

  const closeEditProfile = useCallback(() => {
    setDraftProfileName(name.trim());
    setProfileView("main");
  }, [name]);

  const handleSaveProfileName = useCallback(() => {
    const trimmedName = draftProfileName.trim();

    if (!trimmedName) {
      Alert.alert(t("profile.nameRequiredTitle"), t("profile.nameRequiredMessage"));
      return;
    }

    setName(trimmedName);
    setProfileView("main");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draftProfileName, t]);

  const proInsightsSummary = useMemo(() => {
    if (recentSymptomLogs.length === 0) {
      return {
        logsCount: 0,
        highDiscomfortDays: 0,
        topMoodKey: null as string | null,
        topFlowKey: null as string | null,
      };
    }

    const moodFrequency = new Map<string, number>();
    const flowFrequency = new Map<string, number>();
    let highDiscomfortDays = 0;

    recentSymptomLogs.forEach((entry) => {
      flowFrequency.set(entry.flowKey, (flowFrequency.get(entry.flowKey) ?? 0) + 1);

      let hasDiscomfortMood = false;
      entry.moods.forEach((moodKey) => {
        moodFrequency.set(moodKey, (moodFrequency.get(moodKey) ?? 0) + 1);
        if (moodKey === "moods.cramps" || moodKey === "moods.headache" || moodKey === "moods.low") {
          hasDiscomfortMood = true;
        }
      });

      if (hasDiscomfortMood) {
        highDiscomfortDays += 1;
      }
    });

    const topMoodKey = [...moodFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topFlowKey = [...flowFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      logsCount: recentSymptomLogs.length,
      highDiscomfortDays,
      topMoodKey,
      topFlowKey,
    };
  }, [recentSymptomLogs]);

  const freeAiRemaining = Math.max(0, FREE_AI_DAILY_LIMIT - aiUsageCount);
  const hasProAccess = isPro || (__DEV__ && isDebugProOverrideEnabled);
  const isAiLockedForFree = !hasProAccess && freeAiRemaining <= 0;

  const selectedDatePregnancyDetail = useMemo(
    () =>
      buildPregnancyProbabilityDetail(
        selectedCalendarDate,
        lastPeriodDate,
        cycleLength,
        periodLength,
        goals,
        t,
      ),
    [selectedCalendarDate, lastPeriodDate, cycleLength, periodLength, goals, t],
  );

  const selectedDateLevelStyle =
    selectedDatePregnancyDetail.level === "High"
      ? styles.probabilityBadgeHigh
      : selectedDatePregnancyDetail.level === "Medium"
        ? styles.probabilityBadgeMedium
        : styles.probabilityBadgeLow;

  const canContinue =
    step === 1
      ? name.trim().length > 0
      : step === 2
        ? goals.length > 0
        : step === 4
          ? cycleLength > periodLength
          : true;

  const stepButtonLabel =
    step === 0 ? t("onboarding.getStarted") : step === 4 ? t("onboarding.finishOnboarding") : t("onboarding.continue");

  const insightCards: {
    heroValue: string;
    heroLabel: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    bgColor: string;
    accentColor: string;
    iconBgColor: string;
  }[] = [
    {
      heroValue: cycleContext.isPeriodDay
        ? t("home.periodDay", { day: cycleContext.periodDayNumber })
        : `${cycleContext.daysUntilNextPeriod}`,
      heroLabel: cycleContext.isPeriodDay ? t("home.ofYourPeriod") : t("home.daysToPeriod"),
      subtitle: cycleContext.isPeriodDay
        ? t("home.logSymptomsFlow")
        : t("home.nextDate", { date: cycleContext.nextPeriodStart.toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) }),
      icon: "water",
      bgColor: "#FFF0F3",
      accentColor: "#D4587A",
      iconBgColor: "#FDDDE5",
    },
    {
      heroValue: cycleContext.daysUntilOvulation === 0
        ? t("home.today")
        : `${cycleContext.daysUntilOvulation}`,
      heroLabel: cycleContext.daysUntilOvulation === 0 ? t("home.isOvulationDay") : t("home.daysToOvulation"),
      subtitle: t("home.expectedDate", { date: cycleContext.nextOvulationDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) }),
      icon: "egg",
      bgColor: "#EEF4FF",
      accentColor: "#5B7FC2",
      iconBgColor: "#DCE8FD",
    },
    {
      heroValue: cycleContext.isFertilityWindow
        ? `${cycleContext.fertilityDaysLeft}`
        : `${Math.max(0, cycleContext.daysUntilFertilityStart)}`,
      heroLabel: cycleContext.isFertilityWindow ? t("home.fertileDaysLeft") : t("home.daysToFertileWindow"),
      subtitle: `${cycleContext.fertilityStartDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })} - ${cycleContext.fertilityEndDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}`,
      icon: "leaf",
      bgColor: "#EEFBF3",
      accentColor: "#4A9D6E",
      iconBgColor: "#D5F2E1",
    },
  ];

  const isBreathingRunning = breathingStepIndex !== null;
  const activeBreathingStep =
    breathingPhase === "inhale" || breathingPhase === "hold" || breathingPhase === "exhale"
      ? BREATHING_STEPS.find((step) => step.phase === breathingPhase)
      : null;

  const breathingGuideText =
    breathingPhase === "done"
      ? t("breathing.doneGuide")
      : activeBreathingStep?.guidanceKey ? t(activeBreathingStep.guidanceKey) : t("breathing.readyGuide");

  const breathingRoundText =
    breathingRound > 0
      ? t("breathing.roundProgress", { current: breathingRound, total: BREATHING_TOTAL_ROUNDS })
      : t("breathing.roundZero", { total: BREATHING_TOTAL_ROUNDS });

  const aiQuickPrompts = [
    t("ai.prompt1"),
    t("ai.prompt2"),
    t("ai.prompt3"),
    t("ai.prompt4"),
  ];

  const onboardingAnimatedStyle = {
    opacity: onboardingAnimation,
    transform: [
      {
        translateX: onboardingAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [stepDirection * 22, 0],
        }),
      },
    ],
  };

  const goToStep = (nextStep: number, direction: 1 | -1) => {
    setStepDirection(direction);
    setStep(nextStep);
  };

  const onNext = () => {
    if (!canContinue) {
      return;
    }

    if (step === 4) {
      setIsOnboardingDone(true);
      setActiveTab("home");
      return;
    }

    goToStep(step + 1, 1);
  };

  const onBack = () => {
    if (step === 0) {
      return;
    }

    goToStep(step - 1, -1);
  };

  const toggleGoal = (goalId: GoalOption) => {
    setGoals((currentGoals) => {
      if (currentGoals.includes(goalId)) {
        return currentGoals.filter((currentGoal) => currentGoal !== goalId);
      }
      return [...currentGoals, goalId];
    });
  };

  const toggleMood = (mood: string) => {
    setSelectedMoods((currentMoods) => {
      if (currentMoods.includes(mood)) {
        return currentMoods.filter((currentMood) => currentMood !== mood);
      }
      return [...currentMoods, mood];
    });
  };

  const openSubscriptionModal = () => {
    if (__DEV__ && isDebugProOverrideEnabled && !isPro) {
      setIsSubscriptionModalVisible(true);
      return;
    }

    if (!isRevenueCatEnabled) {
      Alert.alert(t("pro.revenueCatUnavailableTitle"), t("pro.revenueCatUnavailableDescription"));
      return;
    }

    if (isPro) {
      void handleOpenCustomerCenter();
      return;
    }

    void handlePresentPaywall(false);
  };

  const handlePresentPaywall = async (ifNeeded = true) => {
    if (!isRevenueCatEnabled) {
      Alert.alert(t("pro.revenueCatUnavailableTitle"), t("pro.revenueCatUnavailableDescription"));
      return;
    }

    setIsRevenueCatLoading(true);
    try {
      if (ifNeeded) {
        await presentRevenueCatPaywallIfNeeded();
      } else {
        await presentRevenueCatPaywall();
      }

      const customerInfo = await getRevenueCatCustomerInfo();
      let unlocked = hasLunellaProEntitlement(customerInfo);

      if (!unlocked) {
        const syncedCustomerInfo = await syncRevenueCatPurchases();
        unlocked = hasLunellaProEntitlement(syncedCustomerInfo ?? customerInfo);
      }

      if (unlocked && !isPro) {
        setIsProSuccessVisible(true);
      }
      setIsPro(unlocked);
      await refreshRevenueCatState();

      if (unlocked) {
        setIsSubscriptionModalVisible(false);
      }
    } catch {
      Alert.alert(t("pro.genericErrorTitle"), t("pro.paywallError"));
    } finally {
      setIsRevenueCatLoading(false);
    }
  };

  const handlePurchasePlan = async (planId: RevenueCatPlanId) => {
    if (!isRevenueCatEnabled) {
      Alert.alert(t("pro.revenueCatUnavailableTitle"), t("pro.revenueCatUnavailableDescription"));
      return;
    }

    const selectedPackage = revenueCatPackages[planId];

    if (!selectedPackage) {
      Alert.alert(t("pro.genericErrorTitle"), t("pro.productUnavailable"));
      return;
    }

    setIsRevenueCatLoading(true);
    try {
      const purchaseResult = await purchaseRevenueCatPackage(selectedPackage);
      let unlocked = hasLunellaProEntitlement(purchaseResult.customerInfo);

      if (!unlocked) {
        const syncedCustomerInfo = await syncRevenueCatPurchases();
        unlocked = hasLunellaProEntitlement(syncedCustomerInfo ?? purchaseResult.customerInfo);
      }

      if (unlocked && !isPro) {
        setIsProSuccessVisible(true);
      }
      setIsPro(unlocked);

      if (unlocked) {
        Alert.alert(t("pro.purchaseSuccessTitle"), t("pro.purchaseSuccessDescription"));
        setIsSubscriptionModalVisible(false);
      }
    } catch (error) {
      if (isRevenueCatUserCancelledError(error)) {
        return;
      }

      if (isRevenueCatAlreadyPurchasedError(error)) {
        try {
          const restoredInfo = await restoreRevenueCatPurchases();
          let unlocked = hasLunellaProEntitlement(restoredInfo);

          if (!unlocked) {
            const syncedCustomerInfo = await syncRevenueCatPurchases();
            unlocked = hasLunellaProEntitlement(syncedCustomerInfo ?? restoredInfo);
          }

          if (unlocked && !isPro) {
            setIsProSuccessVisible(true);
          }
          setIsPro(unlocked);
          if (unlocked) {
            Alert.alert(t("pro.purchaseSuccessTitle"), t("pro.purchaseSuccessDescription"));
            setIsSubscriptionModalVisible(false);
            return;
          }
        } catch {
          // Falls through to generic purchase error.
        }
      }

      Alert.alert(t("pro.genericErrorTitle"), t("pro.purchaseError"));
    } finally {
      setIsRevenueCatLoading(false);
      await refreshRevenueCatState();
    }
  };

  const handleRestoreSubscription = async () => {
    if (!isRevenueCatEnabled) {
      Alert.alert(t("pro.revenueCatUnavailableTitle"), t("pro.revenueCatUnavailableDescription"));
      return;
    }

    setIsRevenueCatLoading(true);
    try {
      const customerInfo = await restoreRevenueCatPurchases();
      let unlocked = hasLunellaProEntitlement(customerInfo);

      if (!unlocked) {
        const syncedCustomerInfo = await syncRevenueCatPurchases();
        unlocked = hasLunellaProEntitlement(syncedCustomerInfo ?? customerInfo);
      }

      if (unlocked && !isPro) {
        setIsProSuccessVisible(true);
      }
      setIsPro(unlocked);
      if (unlocked) {
        Alert.alert(t("pro.restoreSuccessTitle"), t("pro.restoreSuccessDescription"));
      } else {
        Alert.alert(t("pro.genericErrorTitle"), t("pro.restoreError"));
      }
    } catch {
      Alert.alert(t("pro.genericErrorTitle"), t("pro.restoreError"));
    } finally {
      setIsRevenueCatLoading(false);
      await refreshRevenueCatState();
    }
  };

  const handleOpenCustomerCenter = async () => {
    if (!isRevenueCatEnabled) {
      Alert.alert(t("pro.revenueCatUnavailableTitle"), t("pro.revenueCatUnavailableDescription"));
      return;
    }

    setIsRevenueCatLoading(true);
    try {
      await presentRevenueCatCustomerCenter({
        onRestoreCompleted: ({ customerInfo }) => {
          const unlocked = hasLunellaProEntitlement(customerInfo);
          if (unlocked && !isPro) {
            setIsProSuccessVisible(true);
          }
          setIsPro(unlocked);
        },
      });

      await refreshRevenueCatState();
    } catch {
      Alert.alert(t("pro.genericErrorTitle"), t("pro.customerCenterError"));
    } finally {
      setIsRevenueCatLoading(false);
    }
  };

  const showProUpsell = (source: ProUpsellSource) => {
    if (!isRevenueCatEnabled) {
      Alert.alert(t("pro.revenueCatUnavailableTitle"), t("pro.revenueCatUnavailableDescription"));
      return;
    }

    const sourceTitle =
      source === "ai"
        ? t("pro.upsellSourceAi")
        : source === "insights"
          ? t("pro.upsellSourceInsights")
          : source === "export"
            ? t("pro.upsellSourceExport")
            : source === "health_sync"
              ? t("pro.upsellSourceHealth")
              : source === "passcode"
                ? t("pro.upsellSourcePasscode")
                : t("pro.upsellSourceMentalHealth");

    Alert.alert(
      t("pro.upsellTitle", { source: sourceTitle }),
      t("pro.upsellDescription"),
      [
        {
          text: t("pro.upsellLater"),
          style: "cancel",
        },
        {
          text: t("pro.upsellOpenPaywall"),
          onPress: () => {
            void handlePresentPaywall(true);
          },
        },
      ],
    );
  };

  const handleSelectMentalProgram = (programId: MentalProgramId) => {
    setSelectedMentalProgramId(programId);
    const nextProgram = MENTAL_HEALTH_PROGRAMS.find((program) => program.id === programId);
    if (nextProgram) {
      setSelectedMentalSessionId(nextProgram.sessions[0].id);
    }
    setMentalMoodBefore(null);
    setMentalMoodAfter(null);
    setMentalJournalNote("");
  };

  const handleSelectMentalSession = (sessionId: string) => {
    setSelectedMentalSessionId(sessionId);
    setMentalMoodBefore(null);
    setMentalMoodAfter(null);
    setMentalJournalNote("");
  };

  const handleOpenMentalSafetySupport = () => {
    Alert.alert(
      t("mentalHealth.safetyTitle"),
      t("mentalHealth.safetyMessage"),
      [
        { text: t("mentalHealth.safetyClose"), style: "cancel" },
        {
          text: t("mentalHealth.safetyBreathingAction"),
          onPress: () => {
            startBreathingSession();
          },
        },
      ],
    );
  };

  const handleSaveMentalSession = () => {
    if (!hasProAccess) {
      showProUpsell("mental_health");
      return;
    }

    if (mentalMoodBefore === null || mentalMoodAfter === null) {
      Alert.alert(t("mentalHealth.ratingRequiredTitle"), t("mentalHealth.ratingRequiredMessage"));
      return;
    }

    const sessionDateISO = startOfDay(new Date()).toISOString();
    const nextEntry: MentalHealthLogEntry = {
      id: `mental-${Date.now()}`,
      dateISO: sessionDateISO,
      programId: selectedMentalProgram.id,
      sessionId: selectedMentalSession.id,
      moodBefore: mentalMoodBefore,
      moodAfter: mentalMoodAfter,
      journalNote: mentalJournalNote.trim(),
    };

    setMentalHealthLogs((currentLogs) => {
      const filteredLogs = currentLogs.filter(
        (entry) =>
          !(
            entry.dateISO === sessionDateISO &&
            entry.programId === selectedMentalProgram.id &&
            entry.sessionId === selectedMentalSession.id
          ),
      );
      return [...filteredLogs, nextEntry].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    });

    setMentalMoodBefore(null);
    setMentalMoodAfter(null);
    setMentalJournalNote("");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t("mentalHealth.savedTitle"), t("mentalHealth.savedMessage"));
  };

  const handleSaveDailyCheckin = () => {
    // Validate that at least flow is selected
    if (!selectedFlow) {
      Alert.alert(t("tips.validationTitle"), t("tips.validationFlowRequired"));
      return;
    }

    const entryDate = startOfDay(new Date()).toISOString();
    const nextEntry: SymptomLogEntry = {
      id: `log-${Date.now()}`,
      dateISO: entryDate,
      flowKey: selectedFlow,
      moods: selectedMoods,
    };

    setSymptomLogs((currentLogs) => {
      const withoutToday = currentLogs.filter((entry) => entry.dateISO !== entryDate);
      const updated = [...withoutToday, nextEntry].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      console.log("Saving check-in:", nextEntry);
      console.log("Updated logs:", updated);
      return updated;
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Show success message with option to view history
    const moodCount = selectedMoods.length;
    const message = moodCount > 0
      ? `${t("tips.savedDescription")} ${t("tips.savedWithMoods", { count: moodCount })}`
      : t("tips.savedDescription");

    Alert.alert(
      t("tips.savedTitle"),
      message,
      [
        { text: "OK", style: "cancel" },
        { text: t("tips.viewHistory"), onPress: openCheckInHistory }
      ]
    );
  };

  const handleExportCycleData = async () => {
    if (!hasProAccess) {
      showProUpsell("export");
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        name,
        goals,
        cycleLength,
        periodLength,
        lastPeriodDate: lastPeriodDate.toISOString(),
      },
      symptomLogs,
      mentalHealthLogs,
      aiMessages,
    };

    await Share.share({
      message: JSON.stringify(payload, null, 2),
    });
  };

  const handlePeriodStartsToday = () => {
    const today = startOfDay(new Date());
    setLastPeriodDate(today);
    setSelectedCalendarDate(today);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Show confirmation
    Alert.alert(
      t("home.periodStartsToday"),
      `${t("onboarding.lastPeriodDate", { date: today.toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" }) })}`,
      [{ text: "OK" }]
    );
  };

  const handleSetAsPeriodStart = (date: Date) => {
    const normalizedDate = startOfDay(date);
    setLastPeriodDate(normalizedDate);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Show confirmation
    Alert.alert(
      t("home.setAsPeriodStart"),
      `${t("onboarding.lastPeriodDate", { date: normalizedDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" }) })}`,
      [{ text: "OK" }]
    );
  };

  const sendAiMessage = async (messageText: string) => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isAiTyping) {
      return;
    }

    if (isAiLockedForFree) {
      showProUpsell("ai");
      return;
    }

    const userMessage: AiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedMessage,
    };

    const aiHistoryForPrompt = aiMessages
      .filter((message) => message.id !== "assistant-welcome")
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.text,
      }));

    setAiMessages((currentMessages) => [...currentMessages, userMessage]);
    setAiInput("");
    setIsAiTyping(true);

    const goalLine = goals.length > 0
      ? goals
        .map((goal) => {
          const found = GOAL_OPTIONS.find((option) => option.id === goal);
          return found ? t(found.labelKey) : goal;
        })
        .join(", ")
      : t("ai.generalCycleTracking");

    const assistantSystemPrompt = [
      "You are Lunella AI, a professional menstrual and reproductive health assistant in a mobile app.",
      "Provide clear, evidence-based, and compassionate guidance in a professional tone.",
      "You are educational support only: do not diagnose, do not prescribe medication doses, and do not replace clinical care.",
      "If there are red flags (severe pain, heavy bleeding, fainting, fever, pregnancy complications, or self-harm thoughts), advise urgent in-person medical care.",
      "Keep uncertainty honest and avoid making up facts.",
      "Answer in the user's language, with concise structure: direct answer, practical next steps, when to seek care.",
      "Always end with a short disclaimer in the same language saying this is general information, not medical diagnosis.",
      `User language: ${i18n.language}.`,
      `Cycle length: ${cycleLength}. Period length: ${periodLength}.`,
      `Next period starts in ${cycleContext.daysUntilNextPeriod} days (${cycleContext.nextPeriodStart.toISOString()}).`,
      `Next ovulation in ${cycleContext.daysUntilOvulation} days (${cycleContext.nextOvulationDate.toISOString()}).`,
      `Fertility window: ${cycleContext.fertilityStartDate.toISOString()} - ${cycleContext.fertilityEndDate.toISOString()}.`,
      `User goals: ${goalLine}.`,
      "Keep answers concise (about 4-8 sentences) unless the user asks for more depth.",
    ].join(" ");

    let responseText = "";
    let usedLiveAi = false;

    // Create a placeholder assistant message for streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: AiMessage = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
    };

    setAiMessages((currentMessages) => [...currentMessages, assistantMessage]);

    try {
      responseText = await streamOpenRouterChatReply(
        [
          {
            role: "system",
            content: assistantSystemPrompt,
          },
          ...aiHistoryForPrompt,
          {
            role: "user",
            content: trimmedMessage,
          },
        ],
        (token: string) => {
          // Update the assistant message with each token
          setAiMessages((currentMessages) => {
            const updatedMessages = [...currentMessages];
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (lastMessage?.id === assistantMessageId) {
              lastMessage.text += token;
            }
            return updatedMessages;
          });
        }
      );
      usedLiveAi = true;
    } catch (error) {
      console.warn("Lunella AI request failed", error);
      responseText = t("ai.connectionError");
      // Update the message with error text
      setAiMessages((currentMessages) => {
        const updatedMessages = [...currentMessages];
        const lastMessage = updatedMessages[updatedMessages.length - 1];
        if (lastMessage?.id === assistantMessageId) {
          lastMessage.text = responseText;
        }
        return updatedMessages;
      });
    }

    if (!hasProAccess && usedLiveAi) {
      setAiUsageCount((currentCount) => currentCount + 1);
    }

    setIsAiTyping(false);
  };

  const stopBreathingSession = (nextPhase: BreathPhase = "ready") => {
    if (breathingTimerRef.current) {
      clearInterval(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }

    setBreathingStepIndex(null);
    setBreathingPhase(nextPhase);
    setBreathingSecondsLeft(0);
    setBreathingRound(nextPhase === "done" ? BREATHING_TOTAL_ROUNDS : 0);

    Animated.timing(breathingScale, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const startBreathingSession = () => {
    if (breathingTimerRef.current) {
      clearInterval(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }

    breathingScale.setValue(1);
    breathingRippleAnim.setValue(0);
    setBreathingPhase("inhale");
    setBreathingRound(1);
    setBreathingSecondsLeft(BREATHING_STEPS[0].seconds);
    setBreathingStepIndex(0);
  };

  const renderOnboardingBody = () => {
    if (step === 0) {
      return (
        <View style={styles.welcomeStage}>
          <WelcomeIllustration />
          <View style={styles.welcomeTextBlock}>
            <Text style={styles.welcomeTitle}>{t("onboarding.welcomeTitle")}</Text>
            <Text style={styles.welcomeSubtitle}>{t("onboarding.welcomeSubtitle")}</Text>
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.contentBlock}>
          <Text style={styles.title}>{t("onboarding.nameTitle")}</Text>
          <Text style={styles.descriptionLeft}>{t("onboarding.nameDescription")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("onboarding.namePlaceholder")}
            placeholderTextColor="#9F95A4"
          />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.contentBlock}>
          <Text style={styles.title}>{t("onboarding.goalsTitle")}</Text>
          <Text style={styles.descriptionLeft}>{t("onboarding.goalsDescription")}</Text>
          <Text style={styles.descriptionMuted}>{t("onboarding.goalsSelectAll")}</Text>
          <View style={styles.optionList}>
            {GOAL_OPTIONS.map((goalOption) => {
              const isSelected = goals.includes(goalOption.id);

              return (
                <Pressable
                  key={goalOption.id}
                  style={[styles.optionButton, isSelected && styles.optionButtonActive]}
                  onPress={() => toggleGoal(goalOption.id)}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>{t(goalOption.labelKey)}</Text>
                  <View style={[styles.optionIndicator, isSelected && styles.optionIndicatorActive]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.contentBlock}>
          <Text style={styles.title}>{t("onboarding.periodDateTitle")}</Text>
          <Text style={styles.descriptionLeft}>{t("onboarding.periodDateDescription")}</Text>

          <View style={styles.monthHeader}>
            <TouchableOpacity
              onPress={() => setOnboardingMonth((month) => addMonths(month, -1))}
              style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>{"<"}</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{onboardingMonthTitle}</Text>
            <TouchableOpacity
              onPress={() => setOnboardingMonth((month) => addMonths(month, 1))}
              style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>{">"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekHeader}>
            {WEEK_DAY_KEYS.map((dayKey, index) => (
              <Text key={`${dayKey}-${index}`} style={styles.weekDayText}>
                {t(dayKey)}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {onboardingDays.map((day) => {
              const isSelected = isSameDay(day.date, lastPeriodDate);
              return (
                <Pressable
                  key={day.date.toISOString()}
                  style={[
                    styles.dayCell,
                    !day.isCurrentMonth && styles.dayCellMuted,
                    isSelected && styles.dayCellSelected,
                  ]}
                  onPress={() => setLastPeriodDate(startOfDay(day.date))}>
                  <Text
                    style={[
                      styles.dayCellText,
                      !day.isCurrentMonth && styles.dayCellTextMuted,
                      isSelected && styles.dayCellTextSelected,
                    ]}>
                    {day.dayNumber}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.confirmedDateText}>
            {t("onboarding.lastPeriodDate", { date: lastPeriodDate.toLocaleDateString(dateLocale) })}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.contentBlock}>
        <Text style={styles.title}>{t("onboarding.cycleDetailsTitle")}</Text>
        <Text style={styles.descriptionLeft}>{t("onboarding.cycleDetailsDescription")}</Text>

        <NumberAdjuster
          label={t("common.cycleLengthLabel")}
          hint={t("common.cycleLengthHint")}
          value={cycleLength}
          min={21}
          max={40}
          onChange={setCycleLength}
        />

        <NumberAdjuster
          label={t("common.periodLengthLabel")}
          hint={t("common.periodLengthHint")}
          value={periodLength}
          min={3}
          max={10}
          onChange={setPeriodLength}
        />

        <View style={styles.reminderRow}>
          <View>
            <Text style={styles.adjusterLabel}>{t("common.reminderAlerts")}</Text>
            <Text style={styles.adjusterHint}>{t("common.reminderAlertsHint")}</Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    );
  };

  const renderPregnancyProbabilityCard = () => {
    const selectedDateLabel = selectedCalendarDate.toLocaleDateString(dateLocale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const levelLabel = selectedDatePregnancyDetail.level === "High"
      ? t("pregnancy.high")
      : selectedDatePregnancyDetail.level === "Medium"
        ? t("pregnancy.medium")
        : t("pregnancy.low");

    return (
      <View style={styles.probabilityCard}>
        <View style={styles.probabilityHeaderRow}>
          <View>
            <Text style={styles.probabilityTitle}>{t("pregnancy.title")}</Text>
            <Text style={styles.probabilityDateLabel}>{selectedDateLabel}</Text>
          </View>
          <View style={[styles.probabilityBadge, selectedDateLevelStyle]}>
            <Text style={styles.probabilityBadgeText}>
              {levelLabel} ({selectedDatePregnancyDetail.chanceRangeLabel})
            </Text>
          </View>
        </View>

        <Text style={styles.probabilitySummary}>{selectedDatePregnancyDetail.summary}</Text>

        <View style={styles.probabilityMetaRow}>
          <Text style={styles.probabilityMetaText}>{t("pregnancy.cycleDay", { day: selectedDatePregnancyDetail.cycleDayNumber })}</Text>
          <Text style={styles.probabilityMetaText}>
            {t("pregnancy.ovulationLabel", { date: selectedDatePregnancyDetail.ovulationDate.toLocaleDateString(dateLocale, {
              month: "short",
              day: "numeric",
            }) })}
          </Text>
        </View>

        <Text style={styles.probabilityWindowText}>
          {t("pregnancy.fertilityWindow", {
            start: selectedDatePregnancyDetail.fertilityStartDate.toLocaleDateString(dateLocale, {
              month: "short",
              day: "numeric",
            }),
            end: selectedDatePregnancyDetail.fertilityEndDate.toLocaleDateString(dateLocale, {
              month: "short",
              day: "numeric",
            }),
          })}
        </Text>

        <TouchableOpacity
          style={styles.setAsPeriodButton}
          onPress={() => handleSetAsPeriodStart(selectedCalendarDate)}>
          <MaterialCommunityIcons name="calendar-edit" size={18} color="#8F72C5" />
          <Text style={styles.setAsPeriodButtonText}>{t("home.setAsPeriodStart")}</Text>
        </TouchableOpacity>

        <Text style={styles.probabilityRecommendation}>{selectedDatePregnancyDetail.recommendation}</Text>
      </View>
    );
  };

  const renderHomeTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.homeHeader}>
          <View>
            <Text style={styles.headerTitle}>{t("home.myCycleCalendar")}</Text>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString(dateLocale, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.profileAvatarWrap}>
            <TouchableOpacity style={styles.profileAvatar} onPress={() => setActiveTab("profile")}>
              <Text style={styles.profileAvatarText}>{(name.trim()[0] ?? "U").toUpperCase()}</Text>
            </TouchableOpacity>
            {hasProAccess && (
              <View style={styles.homeProBadgeWrap}>
                <View style={styles.homeProBadge}>
                  <Text style={styles.homeProBadgeText}>{t("pro.activeShort")}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightRow}>
          {insightCards.map((card) => (
            <View key={card.heroLabel} style={[styles.insightCard, { backgroundColor: card.bgColor }]}>
              <View style={styles.insightCardTop}>
                <View style={[styles.insightIconCircle, { backgroundColor: card.iconBgColor }]}>
                  <Ionicons name={card.icon} size={18} color={card.accentColor} />
                </View>
              </View>
              <View style={styles.insightCardBody}>
                <Text style={[styles.insightHeroValue, { color: card.accentColor }]}>{card.heroValue}</Text>
                <Text style={styles.insightHeroLabel}>{card.heroLabel}</Text>
              </View>
              <Text style={styles.insightSubtitle}>{card.subtitle}</Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthChipRow}>
          {monthOptions.map((monthOption, index) => {
            const isSelected = selectedMonthIndex === index;
            return (
              <TouchableOpacity
                key={monthOption.toISOString()}
                style={[styles.monthChip, isSelected && styles.monthChipActive]}
                onPress={() => setSelectedMonthIndex(index)}>
                <Text style={[styles.monthChipText, isSelected && styles.monthChipTextActive]}>
                  {monthOption.toLocaleDateString(dateLocale, { month: "short", year: "2-digit" })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.calendarCard}>
          <Text style={styles.calendarCardTitle}>{monthLabel}</Text>

          <View style={styles.weekHeader}>
            {WEEK_DAY_KEYS.map((dayKey, index) => (
              <Text key={`${dayKey}-home-${index}`} style={styles.weekDayText}>
                {t(dayKey)}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {decoratedHomeDays.map((day) => {
              const isSelectedDate = isSameDay(day.date, selectedCalendarDate);
              const dayCategoryStyle =
                day.category === "period"
                  ? styles.dayPeriod
                  : day.category === "ovulation"
                    ? styles.dayOvulation
                    : day.category === "fertility"
                      ? styles.dayFertility
                      : null;

              return (
                <Pressable
                  key={day.date.toISOString()}
                  onPress={() => setSelectedCalendarDate(startOfDay(day.date))}
                  style={[
                    styles.dayCell,
                    !day.isCurrentMonth && styles.dayCellMuted,
                    dayCategoryStyle,
                    isSelectedDate && styles.selectedCalendarDayOutline,
                    day.isToday && styles.todayOutline,
                  ]}>
                  <Text
                    style={[
                      styles.dayCellText,
                      !day.isCurrentMonth && styles.dayCellTextMuted,
                      dayCategoryStyle && styles.dayCellTextSelected,
                    ]}>
                    {day.dayNumber}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#D8C3F9" }]} />
              <Text style={styles.legendText}>{t("home.legendPeriod")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#BFDDFE" }]} />
              <Text style={styles.legendText}>{t("home.legendOvulation")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#CDEFD9" }]} />
              <Text style={styles.legendText}>{t("home.legendFertility")}</Text>
            </View>
          </View>

          <Text style={styles.calendarHintText}>{t("home.calendarHint")}</Text>

          <TouchableOpacity style={styles.periodStartButton} onPress={handlePeriodStartsToday}>
            <MaterialCommunityIcons name="water-plus" size={20} color="#FFFFFF" />
            <Text style={styles.periodStartButtonText}>{t("home.periodStartsToday")}</Text>
          </TouchableOpacity>

          {renderPregnancyProbabilityCard()}
        </View>
      </ScrollView>
    );
  };

  const renderTipsTab = () => {
    const feelingName = name.trim() || "Gul";
    const todayISO = startOfDay(new Date()).toISOString();
    const todayCheckIn = symptomLogs.find((log) => log.dateISO === todayISO);
    const hasTodayCheckIn = !!todayCheckIn;
    const currentPhaseLabelKey =
      mentalCyclePhase === "period"
        ? "mentalHealth.phasePeriod"
        : mentalCyclePhase === "fertility"
          ? "mentalHealth.phaseFertility"
          : mentalCyclePhase === "luteal"
            ? "mentalHealth.phaseLuteal"
            : "mentalHealth.phaseFollicular";
    const recommendedMentalProgram =
      MENTAL_HEALTH_PROGRAMS.find((program) => program.id === recommendedMentalProgramId) ?? MENTAL_HEALTH_PROGRAMS[0];
    const recommendedPreviewSession = recommendedMentalProgram.sessions[0];
    const selectedSessionFormatLabel =
      selectedMentalSession.format === "breathwork"
        ? t("mentalHealth.formatBreathwork")
        : selectedMentalSession.format === "grounding"
          ? t("mentalHealth.formatGrounding")
          : t("mentalHealth.formatJournal");

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t("tips.sectionTitle")}</Text>

        {hasTodayCheckIn && (
          <View style={styles.todayCheckInBanner}>
            <View style={styles.todayCheckInBannerHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.todayCheckInBannerText}>{t("tips.alreadyCheckedIn")}</Text>
            </View>
            <TouchableOpacity onPress={openCheckInHistory}>
              <Text style={styles.todayCheckInBannerLink}>{t("tips.viewOrEdit")}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.flowCard}>
            <Text style={styles.flowCardTitle}>{t("tips.menstrualFlow")}</Text>

            <View style={styles.flowTabRow}>
              {MENSTRUAL_FLOW_OPTIONS.map((flowOption) => {
                const isSelected = selectedFlow === flowOption.key;

                return (
                  <Pressable
                    key={flowOption.key}
                    style={[styles.flowTab, isSelected && styles.flowTabActive]}
                    onPress={() => setSelectedFlow(flowOption.key)}>
                    <View style={styles.flowDropRow}>
                      {Array.from({ length: flowOption.drops }).map((_, index) => (
                        <MaterialCommunityIcons
                          key={`${flowOption.key}-${index}`}
                          name="water"
                          size={16}
                          color={isSelected ? "#FFFFFF" : "#8F72C5"}
                        />
                      ))}
                    </View>
                    <Text style={[styles.flowLabel, isSelected && styles.flowLabelActive]}>
                      {t(flowOption.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.tipsQuestion}>{t("tips.howDoYouFeel", { name: feelingName })}</Text>
          <Text style={styles.infoFootnote}>{t("tips.pickMoods")}</Text>

          <View style={styles.moodGrid}>
            {MOOD_OPTIONS.map((moodOption) => {
              const isSelected = selectedMoods.includes(moodOption.labelKey);
              return (
                <Pressable
                  key={moodOption.labelKey}
                  style={[styles.moodChip, isSelected && styles.moodChipActive]}
                  onPress={() => toggleMood(moodOption.labelKey)}>
                  <Text style={styles.moodEmoji}>{moodOption.emoji}</Text>
                  <Text style={[styles.moodLabel, isSelected && styles.moodLabelActive]}>
                    {t(moodOption.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.saveCheckinButton}
            onPress={handleSaveDailyCheckin}>
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.saveCheckinButtonText}>{t("tips.saveToday")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewHistoryButton}
            onPress={openCheckInHistory}>
            <Ionicons name="calendar-outline" size={18} color="#8F72C5" />
            <Text style={styles.viewHistoryButtonText}>
              {t("tips.viewHistory")} {symptomLogs.length > 0 && `(${symptomLogs.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipsSectionWrap}>
          <View style={styles.tipsSectionHeader}>
            <Text style={styles.tipsSectionTitle}>{t("tips.helpfulTips")}</Text>
            <View style={styles.tipsSectionBadge}>
              <MaterialCommunityIcons name="lightbulb-on" size={16} color="#F7B84B" />
            </View>
          </View>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipsGridScroll}>
            {GIRL_TIPS.map((tip, index) => {
              const tipIcons: { [key: string]: { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bgColor: string } } = {
                "girlTips.tip1Title": { icon: "tea", color: "#D4587A", bgColor: "#FCEEF4" },
                "girlTips.tip2Title": { icon: "moon-waning-crescent", color: "#7B5EA8", bgColor: "#F0E8FA" },
                "girlTips.tip3Title": { icon: "water", color: "#4A9D6E", bgColor: "#ECF8F1" },
                "girlTips.tip4Title": { icon: "food-apple", color: "#E6A84D", bgColor: "#FFF3EA" },
                "girlTips.tip5Title": { icon: "walk", color: "#8F72C5", bgColor: "#F0E8FA" },
              };
              const tipStyle = tipIcons[tip.titleKey] || { icon: "lightbulb", color: "#8F72C5", bgColor: "#F0E8FA" };
              
              return (
                <View key={tip.titleKey} style={styles.tipCardNew}>
                  <View style={[styles.tipIconCircle, { backgroundColor: tipStyle.bgColor }]}>
                    <MaterialCommunityIcons name={tipStyle.icon} size={28} color={tipStyle.color} />
                  </View>
                  <View style={styles.tipContent}>
                    <Text style={styles.tipTitleNew}>{t(tip.titleKey)}</Text>
                    <Text style={styles.tipDetailNew}>{t(tip.detailKey)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <LinearGradient
          colors={["#F8F4FF", "#FFFFFF"]}
          style={styles.breathingContainer}>
          <View style={styles.breathingHeader}>
            <View>
              <Text style={styles.breathingTitle}>{t("breathing.meditationTitle")}</Text>
              <Text style={styles.breathingSubtitle}>{breathingRoundText}</Text>
            </View>
            <MaterialCommunityIcons name="leaf" size={24} color="#8F72C5" opacity={0.6} />
          </View>

          <View style={styles.breathingVisualArea}>
            <View style={styles.breathingCircleBackground}>
              <Animated.View 
                style={[
                  styles.breathingRipple1, 
                  { 
                    opacity: breathingRippleAnim,
                    transform: [{ scale: breathingRippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2],
                    }) }]
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.breathingRipple2, 
                  { 
                    opacity: breathingRippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.6],
                    }),
                    transform: [{ scale: breathingRippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1.1],
                    }) }]
                  }
                ]} 
              />
            </View>
            
            <Animated.View 
              style={[
                styles.breathingMainCircle, 
                { transform: [{ scale: breathingScale }] }
              ]}>
              <LinearGradient
                colors={["#E9DFFF", "#F5F0FF"]}
                style={styles.breathingCircleGradient}>
                <MaterialCommunityIcons 
                  name={breathingPhase === "done" ? "check-circle" : "flower"} 
                  size={48} 
                  color="#8F72C5" 
                />
              </LinearGradient>
            </Animated.View>

            <View style={styles.breathingPhaseOverlay}>
              <Text style={styles.breathingPhaseText}>
                {isBreathingRunning ? activeBreathingStep?.labelKey ? t(activeBreathingStep.labelKey) : t("breathing.breathe") : 
                 breathingPhase === "done" ? t("breathing.doneGuide") : t("breathing.ready")}
              </Text>
              {isBreathingRunning && (
                <Text style={styles.breathingTimerText}>{breathingSecondsLeft}s</Text>
              )}
            </View>
          </View>

          <Text style={styles.breathingDescription}>
            {breathingGuideText}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.breathingStartButton, isBreathingRunning && styles.breathingStopButton]}
            onPress={isBreathingRunning ? () => stopBreathingSession("ready") : startBreathingSession}>
            <Text style={styles.breathingStartButtonText}>
              {isBreathingRunning
                ? t("breathing.stopExercise")
                : breathingPhase === "done"
                  ? t("breathing.startAgain")
                  : t("breathing.startBreathing")}
            </Text>
            {!isBreathingRunning && <Ionicons name="play" size={18} color="#FFFFFF" style={{marginLeft: 8}} />}
          </TouchableOpacity>
        </LinearGradient>

        <LinearGradient
          colors={["#F7F1FF", "#FFFFFF"]}
          style={styles.mentalHealthContainer}>
          <View style={styles.mentalHealthHeaderRow}>
            <View style={styles.mentalHealthHeaderTextWrap}>
              <Text style={styles.mentalHealthTitle}>{t("mentalHealth.title")}</Text>
              <Text style={styles.mentalHealthSubtitle}>{t("mentalHealth.subtitle")}</Text>
            </View>
            <View style={[styles.mentalHealthPlanBadge, hasProAccess ? styles.mentalHealthPlanBadgePro : styles.mentalHealthPlanBadgeFree]}>
              <Text style={styles.mentalHealthPlanBadgeText}>{hasProAccess ? t("pro.activeShort") : t("pro.freeShort")}</Text>
            </View>
          </View>

          <View style={styles.mentalHealthSafetyRow}>
            <Text style={styles.mentalHealthSafetyText}>{t("mentalHealth.safetyNote")}</Text>
            <TouchableOpacity
              style={styles.mentalHealthSafetyButton}
              onPress={handleOpenMentalSafetySupport}>
              <Text style={styles.mentalHealthSafetyButtonText}>{t("mentalHealth.safetyButton")}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mentalHealthStatsRow}>
            <View style={styles.mentalHealthStatCard}>
              <Text style={styles.mentalHealthStatValue}>{mentalWellnessStreak}</Text>
              <Text style={styles.mentalHealthStatLabel}>{t("mentalHealth.streakLabel")}</Text>
            </View>
            <View style={styles.mentalHealthStatCard}>
              <Text style={styles.mentalHealthStatValue}>{mentalHealthLogs.length}</Text>
              <Text style={styles.mentalHealthStatLabel}>{t("mentalHealth.sessionsLabel")}</Text>
            </View>
            <View style={styles.mentalHealthStatCard}>
              <Text style={styles.mentalHealthStatValue}>
                {mentalAverageMoodShift === null
                  ? t("mentalHealth.noDataShort")
                  : `${mentalAverageMoodShift > 0 ? "+" : ""}${mentalAverageMoodShift}`}
              </Text>
              <Text style={styles.mentalHealthStatLabel}>{t("mentalHealth.moodLiftLabel")}</Text>
            </View>
          </View>

          <View style={styles.mentalHealthPhaseCard}>
            <Text style={styles.mentalHealthPhaseText}>{t("mentalHealth.phaseNow", { phase: t(currentPhaseLabelKey) })}</Text>
            <Text style={styles.mentalHealthRecommendedText}>
              {t("mentalHealth.recommendedProgram", { program: t(recommendedMentalProgram.titleKey) })}
            </Text>
            {hasMentalSessionToday && (
              <Text style={styles.mentalHealthLoggedTodayText}>{t("mentalHealth.loggedToday")}</Text>
            )}
          </View>

          {!hasProAccess ? (
            <View style={styles.mentalHealthLockedCard}>
              <Text style={styles.mentalHealthLockedTitle}>{t("mentalHealth.previewTitle")}</Text>
              <Text style={styles.mentalHealthLockedText}>{t(recommendedMentalProgram.descriptionKey)}</Text>

              <View style={styles.mentalSessionDetailCard}>
                <View style={styles.mentalSessionHeader}>
                  <Text style={styles.mentalSessionTitle}>{t(recommendedPreviewSession.titleKey)}</Text>
                  <Text style={styles.mentalSessionMetaText}>
                    {t("mentalHealth.durationMinutes", { count: recommendedPreviewSession.durationMinutes })}
                  </Text>
                </View>
                <Text style={styles.mentalSessionPromptText}>{t(recommendedPreviewSession.promptKey)}</Text>
                {recommendedPreviewSession.steps.slice(0, 1).map((stepKey) => (
                  <View key={stepKey} style={styles.mentalSessionStepRow}>
                    <View style={styles.mentalSessionStepBullet} />
                    <Text style={styles.mentalSessionStepText}>{t(stepKey)}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.mentalHealthUnlockButton}
                onPress={() => showProUpsell("mental_health")}>
                <Text style={styles.mentalHealthUnlockButtonText}>{t("mentalHealth.unlockButton")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mentalProgramChipRow}>
                {MENTAL_HEALTH_PROGRAMS.map((program) => {
                  const isSelectedProgram = selectedMentalProgram.id === program.id;
                  const programProgress = getProgramRoutineProgressDays(mentalHealthLogs, program.id);
                  return (
                    <TouchableOpacity
                      key={program.id}
                      style={[styles.mentalProgramChip, isSelectedProgram && styles.mentalProgramChipActive]}
                      onPress={() => handleSelectMentalProgram(program.id)}>
                      <MaterialCommunityIcons
                        name={program.icon}
                        size={16}
                        color={isSelectedProgram ? "#FFFFFF" : program.accentColor}
                      />
                      <Text style={[styles.mentalProgramChipText, isSelectedProgram && styles.mentalProgramChipTextActive]}>
                        {t(program.titleKey)}
                      </Text>
                      <Text style={[styles.mentalProgramChipProgressText, isSelectedProgram && styles.mentalProgramChipTextActive]}>
                        {t("mentalHealth.routineProgress", {
                          current: programProgress,
                          total: MENTAL_HEALTH_ROUTINE_DAYS,
                        })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.mentalProgramDetailCard}>
                <Text style={styles.mentalProgramTitle}>{t(selectedMentalProgram.titleKey)}</Text>
                <Text style={styles.mentalProgramSubtitle}>{t(selectedMentalProgram.subtitleKey)}</Text>
                <Text style={styles.mentalProgramDescription}>{t(selectedMentalProgram.descriptionKey)}</Text>
                <Text style={styles.mentalProgramRoutineText}>
                  {t("mentalHealth.routineProgress", {
                    current: selectedProgramRoutineProgressDays,
                    total: MENTAL_HEALTH_ROUTINE_DAYS,
                  })}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mentalSessionChipRow}>
                {selectedMentalProgram.sessions.map((session) => {
                  const isSelectedSession = selectedMentalSession.id === session.id;
                  return (
                    <TouchableOpacity
                      key={session.id}
                      style={[styles.mentalSessionChip, isSelectedSession && styles.mentalSessionChipActive]}
                      onPress={() => handleSelectMentalSession(session.id)}>
                      <Text style={[styles.mentalSessionChipText, isSelectedSession && styles.mentalSessionChipTextActive]}>
                        {t(session.titleKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.mentalSessionDetailCard}>
                <View style={styles.mentalSessionHeader}>
                  <Text style={styles.mentalSessionTitle}>{t(selectedMentalSession.titleKey)}</Text>
                  <Text style={styles.mentalSessionMetaText}>
                    {selectedSessionFormatLabel} · {t("mentalHealth.durationMinutes", { count: selectedMentalSession.durationMinutes })}
                  </Text>
                </View>
                <Text style={styles.mentalSessionPromptText}>{t(selectedMentalSession.promptKey)}</Text>
                {selectedMentalSession.steps.map((stepKey) => (
                  <View key={stepKey} style={styles.mentalSessionStepRow}>
                    <View style={styles.mentalSessionStepBullet} />
                    <Text style={styles.mentalSessionStepText}>{t(stepKey)}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.mentalRatingLabel}>{t("mentalHealth.moodBeforeLabel")}</Text>
              <View style={styles.mentalRatingRow}>
                {MOOD_RATING_OPTIONS.map((option) => {
                  const isSelectedOption = mentalMoodBefore === option.value;
                  return (
                    <Pressable
                      key={`before-${option.value}`}
                      style={[styles.mentalRatingChip, isSelectedOption && styles.mentalRatingChipActive]}
                      onPress={() => setMentalMoodBefore(option.value)}>
                      <Text style={styles.mentalRatingEmoji}>{option.emoji}</Text>
                      <Text style={[styles.mentalRatingValue, isSelectedOption && styles.mentalRatingValueActive]}>{option.value}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.mentalRatingLabel}>{t("mentalHealth.moodAfterLabel")}</Text>
              <View style={styles.mentalRatingRow}>
                {MOOD_RATING_OPTIONS.map((option) => {
                  const isSelectedOption = mentalMoodAfter === option.value;
                  return (
                    <Pressable
                      key={`after-${option.value}`}
                      style={[styles.mentalRatingChip, isSelectedOption && styles.mentalRatingChipActive]}
                      onPress={() => setMentalMoodAfter(option.value)}>
                      <Text style={styles.mentalRatingEmoji}>{option.emoji}</Text>
                      <Text style={[styles.mentalRatingValue, isSelectedOption && styles.mentalRatingValueActive]}>{option.value}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.mentalRatingLabel}>{t("mentalHealth.journalLabel")}</Text>
              <TextInput
                style={styles.mentalJournalInput}
                value={mentalJournalNote}
                onChangeText={setMentalJournalNote}
                placeholder={t(selectedMentalSession.journalPromptKey)}
                placeholderTextColor="#9C8BA5"
                multiline
                maxLength={300}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.mentalSaveButton,
                  (mentalMoodBefore === null || mentalMoodAfter === null) && styles.mentalSaveButtonDisabled,
                ]}
                onPress={handleSaveMentalSession}
                disabled={mentalMoodBefore === null || mentalMoodAfter === null}>
                <Text style={styles.mentalSaveButtonText}>{t("mentalHealth.saveSessionButton")}</Text>
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>
      </ScrollView>
    );
  };

  const renderInsightsTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t("insights.cycleStatistics")}</Text>
        <Text style={styles.infoFootnote}>{t("insights.trackPatterns")}</Text>

        <View style={styles.calendarCard}>
          <Text style={styles.calendarCardTitle}>{insightsMonthLabel}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthChipRow}>
            {monthOptions.map((monthOption, index) => {
              const isSelected = selectedInsightsMonthIndex === index;
              return (
                <TouchableOpacity
                  key={`insights-${monthOption.toISOString()}`}
                  style={[styles.monthChip, isSelected && styles.monthChipActive]}
                  onPress={() => setSelectedInsightsMonthIndex(index)}>
                  <Text style={[styles.monthChipText, isSelected && styles.monthChipTextActive]}>
                    {monthOption.toLocaleDateString(dateLocale, { month: "short", year: "2-digit" })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.weekHeader}>
            {WEEK_DAY_KEYS.map((dayKey, index) => (
              <Text key={`${dayKey}-insights-${index}`} style={styles.weekDayText}>
                {t(dayKey)}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {decoratedInsightsDays.map((day) => {
              const isSelectedDate = isSameDay(day.date, selectedCalendarDate);
              const dayCategoryStyle =
                day.category === "period"
                  ? styles.dayPeriod
                  : day.category === "ovulation"
                    ? styles.dayOvulation
                    : day.category === "fertility"
                      ? styles.dayFertility
                      : null;

              return (
                <Pressable
                  key={`insight-day-${day.date.toISOString()}`}
                  onPress={() => setSelectedCalendarDate(startOfDay(day.date))}
                  style={[
                    styles.dayCell,
                    !day.isCurrentMonth && styles.dayCellMuted,
                    dayCategoryStyle,
                    isSelectedDate && styles.selectedCalendarDayOutline,
                    day.isToday && styles.todayOutline,
                  ]}>
                  <Text
                    style={[
                      styles.dayCellText,
                      !day.isCurrentMonth && styles.dayCellTextMuted,
                      dayCategoryStyle && styles.dayCellTextSelected,
                    ]}>
                    {day.dayNumber}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#D8C3F9" }]} />
              <Text style={styles.legendText}>{t("home.legendPeriod")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#BFDDFE" }]} />
              <Text style={styles.legendText}>{t("home.legendOvulation")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#CDEFD9" }]} />
              <Text style={styles.legendText}>{t("home.legendFertility")}</Text>
            </View>
          </View>

          <Text style={styles.calendarHintText}>{t("home.calendarHint")}</Text>
          {renderPregnancyProbabilityCard()}
        </View>

        <Text style={styles.insightSectionTitle}>
          {currentMonthInsight?.monthLabel ?? t("insights.thisMonth")} {t("insights.cycleStatistics").toLowerCase()}
        </Text>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPink]}>
            <Text style={styles.statTitle}>{t("insights.cycleLength")}</Text>
            <Text style={styles.statValue}>{t("insights.days", { count: cycleLength })}</Text>
            <Text style={styles.statSubtext}>{t("insights.thisMonth")}</Text>
          </View>

          <View style={[styles.statCard, styles.statCardLavender]}>
            <Text style={styles.statTitle}>{t("insights.periodDuration")}</Text>
            <Text style={styles.statValue}>{t("insights.days", { count: periodLength })}</Text>
            <Text style={styles.statSubtext}>{currentMonthInsight?.periodRangeLabel ?? t("insights.noPredictedPeriodDays")}</Text>
          </View>

          <View style={[styles.statCard, styles.statCardPeach]}>
            <Text style={styles.statTitle}>{t("insights.ovulationDay")}</Text>
            <Text style={styles.statValue}>
              {currentMonthInsight?.ovulationDayOfMonth
                ? t("insights.dayLabel", { day: currentMonthInsight.ovulationDayOfMonth })
                : t("insights.notInMonth")}
            </Text>
            <Text style={styles.statSubtext}>{currentMonthInsight?.monthLabel ?? t("insights.thisMonth")}</Text>
          </View>

          <View style={[styles.statCard, styles.statCardMint]}>
            <Text style={styles.statTitle}>{t("insights.avgSymptoms")}</Text>
            <Text style={styles.statValue}>{averageSymptomScore}</Text>
            <Text style={styles.statSubtext}>{t("insights.predictedMonthlyScore")}</Text>
          </View>
        </View>

        <View style={styles.proInsightsCard}>
          <View style={styles.proInsightsHeader}>
            <Text style={styles.proInsightsTitle}>{t("pro.advancedInsightsTitle")}</Text>
            <MaterialCommunityIcons name="star-four-points" size={18} color="#8F72C5" />
          </View>

          {hasProAccess ? (
            <>
              <Text style={styles.proInsightsText}>
                {t("pro.insightsLogs", { count: proInsightsSummary.logsCount })}
              </Text>
              <Text style={styles.proInsightsText}>
                {t("pro.insightsDiscomfort", { count: proInsightsSummary.highDiscomfortDays })}
              </Text>
              <Text style={styles.proInsightsText}>
                {t("pro.insightsTopMood", {
                  mood: proInsightsSummary.topMoodKey ? t(proInsightsSummary.topMoodKey) : t("pro.noData"),
                })}
              </Text>
              <Text style={styles.proInsightsText}>
                {t("pro.insightsTopFlow", {
                  flow: proInsightsSummary.topFlowKey ? t(`flow.${proInsightsSummary.topFlowKey}`) : t("pro.noData"),
                })}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.proInsightsLockedText}>{t("pro.lockedDescription")}</Text>
              <TouchableOpacity
                style={styles.proInsightsUnlockButton}
                onPress={() => showProUpsell("insights")}>
                <Text style={styles.proInsightsUnlockText}>{t("pro.unlockButton")}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>{t("insights.cycleOverview", { year: new Date().getFullYear() })}</Text>
            <View style={styles.overviewBadge}>
              <MaterialCommunityIcons name="chart-line" size={16} color="#8F72C5" />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cycleOverviewScroll}>
            {monthlyInsights
              .slice()
              .reverse()
              .map((insight, index) => {
                const isActive = index === 0;
                const totalActiveDays = insight.periodDays + insight.fertilityDays;
                const maxDays = Math.max(14, totalActiveDays);
                const periodPercent = (insight.periodDays / maxDays) * 100;
                const fertilityPercent = (insight.fertilityDays / maxDays) * 100;
                
                return (
                  <Pressable
                    key={`overview-${insight.monthDate.toISOString()}`}
                    style={[styles.cycleMonthCard, isActive && styles.cycleMonthCardActive]}>
                    <View style={styles.cycleMonthHeader}>
                      <Text style={[styles.cycleMonthLabel, isActive && styles.cycleMonthLabelActive]}>
                        {insight.monthDate.toLocaleDateString(dateLocale, { month: "short" })}
                      </Text>
                      <Text style={[styles.cycleMonthYear, isActive && styles.cycleMonthYearActive]}>
                        {insight.monthDate.getFullYear()}
                      </Text>
                    </View>
                    
                    <View style={styles.cycleStatsRow}>
                      <View style={styles.cycleStatItem}>
                        <View style={[styles.cycleStatIcon, { backgroundColor: "#FCEEF4" }]}>
                          <MaterialCommunityIcons name="water" size={14} color="#D4587A" />
                        </View>
                        <Text style={[styles.cycleStatValue, isActive && styles.cycleStatValueActive]}>
                          {insight.periodDays}
                        </Text>
                        <Text style={styles.cycleStatLabel}>{t("insights.periodDays")}</Text>
                      </View>
                      
                      <View style={styles.cycleStatItem}>
                        <View style={[styles.cycleStatIcon, { backgroundColor: "#FDF1D9" }]}>
                          <MaterialCommunityIcons name="egg" size={14} color="#E6A84D" />
                        </View>
                        <Text style={[styles.cycleStatValue, isActive && styles.cycleStatValueActive]}>
                          {insight.ovulationDays}
                        </Text>
                        <Text style={styles.cycleStatLabel}>{t("insights.ovulationDays")}</Text>
                      </View>
                      
                      <View style={styles.cycleStatItem}>
                        <View style={[styles.cycleStatIcon, { backgroundColor: "#ECF8F1" }]}>
                          <MaterialCommunityIcons name="leaf" size={14} color="#4A9D6E" />
                        </View>
                        <Text style={[styles.cycleStatValue, isActive && styles.cycleStatValueActive]}>
                          {insight.fertilityDays}
                        </Text>
                        <Text style={styles.cycleStatLabel}>{t("insights.fertilityDays")}</Text>
                      </View>
                    </View>

                    <View style={styles.cycleMiniChart}>
                      <View style={styles.cycleMiniBarTrack}>
                        <View style={[styles.cycleMiniBar, { width: `${periodPercent}%`, backgroundColor: "#D4587A" }]} />
                        <View style={[styles.cycleMiniBar, { width: `${fertilityPercent}%`, backgroundColor: "#4A9D6E" }]} />
                      </View>
                      <Text style={styles.cycleMiniChartLabel}>{t("insights.activeDays", { count: totalActiveDays })}</Text>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>

          <View style={styles.cycleSummaryRow}>
            <View style={styles.cycleSummaryItem}>
              <Text style={styles.cycleSummaryValue}>{monthlyInsights.length}</Text>
              <Text style={styles.cycleSummaryLabel}>{t("insights.monthsTracked")}</Text>
            </View>
            <View style={styles.cycleSummaryDivider} />
            <View style={styles.cycleSummaryItem}>
              <Text style={styles.cycleSummaryValue}>
                {Math.round(monthlyInsights.reduce((sum, i) => sum + i.periodDays, 0) / monthlyInsights.length)}
              </Text>
              <Text style={styles.cycleSummaryLabel}>{t("insights.avgPeriod")}</Text>
            </View>
            <View style={styles.cycleSummaryDivider} />
            <View style={styles.cycleSummaryItem}>
              <Text style={styles.cycleSummaryValue}>
                {Math.round(monthlyInsights.reduce((sum, i) => sum + i.fertilityDays, 0) / monthlyInsights.length)}
              </Text>
              <Text style={styles.cycleSummaryLabel}>{t("insights.avgFertility")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderAiTab = () => {
    return (
      <KeyboardAvoidingView
        style={styles.aiPageWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={74}>
        <LinearGradient
          colors={["#F4EDFC", "#FCEEF5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiHeroCard}>
          <View>
            <Text style={styles.aiHeroTitle}>{t("ai.heroTitle")}</Text>
            <Text style={styles.aiHeroSubtitle}>{t("ai.heroSubtitle")}</Text>
          </View>
        </LinearGradient>

        <View style={styles.aiQuotaCard}>
          <Text style={styles.aiQuotaTitle}>
            {hasProAccess
              ? t("pro.activePlan")
              : t("pro.aiDailyRemaining", { count: freeAiRemaining, total: FREE_AI_DAILY_LIMIT })}
          </Text>
          {!hasProAccess && (
            <TouchableOpacity onPress={() => showProUpsell("ai")}>
              <Text style={styles.aiQuotaUpgradeText}>{t("pro.unlockButton")}</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          style={styles.aiPromptScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.aiPromptRow}>
          {aiQuickPrompts.map((prompt) => (
            <TouchableOpacity key={prompt} style={styles.aiPromptChip} onPress={() => sendAiMessage(prompt)}>
              <Text style={styles.aiPromptChipText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          ref={aiMessagesScrollRef}
          style={styles.aiMessagesScroll}
          contentContainerStyle={styles.aiMessagesContent}
          showsVerticalScrollIndicator={false}>
          {aiMessages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.aiBubble,
                message.role === "assistant" ? styles.aiAssistantBubble : styles.aiUserBubble,
              ]}>
              {message.role === "assistant" ? (
                <Markdown
                  style={{
                    body: { ...styles.aiAssistantBubbleText, margin: 0, padding: 0 },
                    paragraph: { ...styles.aiBubbleText, marginTop: 0, marginBottom: 0 },
                    strong: { fontWeight: "700" },
                    em: { fontStyle: "italic" },
                    text: { ...styles.aiAssistantBubbleText },
                  }}>
                  {message.id === "assistant-welcome" ? t("ai.welcomeMessage") : message.text}
                </Markdown>
              ) : (
                <Text
                  style={[
                    styles.aiBubbleText,
                    styles.aiUserBubbleText,
                  ]}>
                  {message.text}
                </Text>
              )}
            </View>
          ))}

          {isAiTyping && (
            <View style={[styles.aiBubble, styles.aiAssistantBubble, styles.aiTypingBubble]}>
              <Text style={styles.aiAssistantBubbleText}>{t("ai.thinking")}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.aiComposerWrap}>
          <TextInput
            value={aiInput}
            onChangeText={setAiInput}
            placeholder={t("ai.placeholder")}
            placeholderTextColor="#9A8BA0"
            style={styles.aiInput}
            returnKeyType="send"
            editable={!isAiLockedForFree}
            onSubmitEditing={() => sendAiMessage(aiInput)}
          />

          <TouchableOpacity
            style={[styles.aiSendButton, (!aiInput.trim() || isAiTyping || isAiLockedForFree) && styles.aiSendButtonDisabled]}
            onPress={() => sendAiMessage(aiInput)}
            disabled={!aiInput.trim() || isAiTyping || isAiLockedForFree}>
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  const renderProfileTab = () => {
    const profileName = name.trim() || "Gul";
    const profileGoals = goals.length > 0
      ? goals.map((g) => {
          const found = GOAL_OPTIONS.find((o) => o.id === g);
          return found ? t(found.labelKey) : g;
        }).join(", ")
      : t("goals.cycleTracking");

    const subscriptionPlans: { id: RevenueCatPlanId; label: string }[] = [
      { id: "monthly", label: t("pro.planMonthly") },
      { id: "yearly", label: t("pro.planYearly") },
      { id: "lifetime", label: t("pro.planLifetime") },
    ];

    if (profileView === "edit_profile") {
      const editNamePreview = draftProfileName.trim() || profileName;

      return (
        <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsHeaderRow}>
            <TouchableOpacity style={styles.settingsBackButton} onPress={closeEditProfile}>
              <Ionicons name="chevron-back" size={20} color="#4B3E53" />
            </TouchableOpacity>
            <Text style={styles.settingsHeaderTitle}>{t("profile.editProfileTitle")}</Text>
            <View style={styles.settingsHeaderSpacer} />
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>{t("profile.editProfileSectionTitle")}</Text>
            <Text style={styles.settingsRowSubtitle}>{t("profile.editProfileHint")}</Text>

            <View style={styles.editProfileAvatarWrap}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileAvatarLargeText}>{editNamePreview[0].toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.editProfileFieldLabel}>{t("profile.nameLabel")}</Text>
            <TextInput
              style={styles.editProfileInput}
              value={draftProfileName}
              onChangeText={setDraftProfileName}
              placeholder={t("profile.namePlaceholder")}
              placeholderTextColor="#9A8BA0"
              maxLength={40}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSaveProfileName}
            />

            <View style={styles.editProfileActionsRow}>
              <TouchableOpacity style={styles.editProfileCancelButton} onPress={closeEditProfile}>
                <Text style={styles.editProfileCancelButtonText}>{t("languagePicker.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editProfileSaveButton,
                  !draftProfileName.trim() && styles.editProfileSaveButtonDisabled,
                ]}
                onPress={handleSaveProfileName}
                disabled={!draftProfileName.trim()}>
                <Text style={styles.editProfileSaveButtonText}>{t("profile.saveChanges")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      );
    }

    if (profileView === "settings") {
      return (
        <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsHeaderRow}>
            <TouchableOpacity style={styles.settingsBackButton} onPress={() => setProfileView("main")}>
              <Ionicons name="chevron-back" size={20} color="#4B3E53" />
            </TouchableOpacity>
            <Text style={styles.settingsHeaderTitle}>{t("settings.title")}</Text>
            <View style={styles.settingsHeaderSpacer} />
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>{t("settings.notifications")}</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>{t("settings.cycleReminders")}</Text>
                <Text style={styles.settingsRowSubtitle}>{t("settings.cycleRemindersDesc")}</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>{t("settings.insightNudges")}</Text>
                <Text style={styles.settingsRowSubtitle}>{t("settings.insightNudgesDesc")}</Text>
              </View>
              <Switch
                value={insightNudgesEnabled}
                onValueChange={setInsightNudgesEnabled}
                trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>{t("settings.privacySecurity")}</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>{t("settings.appPasscodeLock")}</Text>
                <Text style={styles.settingsRowSubtitle}>{t("settings.appPasscodeLockDesc")}</Text>
              </View>
              <Switch
                value={pinLockEnabled}
                onValueChange={(nextValue) => {
                  if (!hasProAccess && nextValue) {
                    showProUpsell("passcode");
                    return;
                  }
                  setPinLockEnabled(nextValue);
                }}
                trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>{t("settings.integrations")}</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>{t("settings.healthSync")}</Text>
                <Text style={styles.settingsRowSubtitle}>{t("settings.healthSyncDesc")}</Text>
              </View>
              <Switch
                value={healthSyncEnabled}
                onValueChange={(nextValue) => {
                  if (!hasProAccess && nextValue) {
                    showProUpsell("health_sync");
                    return;
                  }
                  setHealthSyncEnabled(nextValue);
                }}
                trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {__DEV__ && (
            <View style={styles.settingsCard}>
              <Text style={styles.settingsSectionTitle}>{t("settings.debugSection")}</Text>

              <View style={styles.settingsSwitchRow}>
                <View style={styles.settingsSwitchTextWrap}>
                  <Text style={styles.settingsRowTitle}>{t("settings.debugProAccess")}</Text>
                  <Text style={styles.settingsRowSubtitle}>{t("settings.debugProAccessDesc")}</Text>
                </View>
                <Switch
                  value={isDebugProOverrideEnabled}
                  onValueChange={setIsDebugProOverrideEnabled}
                  trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          )}

          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>{t("settings.general")}</Text>

            <TouchableOpacity style={styles.settingsNavRow} onPress={() => setLanguagePickerVisible(true)}>
              <Text style={styles.settingsRowTitle}>{t("settings.language")}</Text>
              <View style={styles.settingsNavRight}>
                <Text style={styles.settingsNavValue}>{SUPPORTED_LANGUAGES[i18n.language] ?? "English"}</Text>
                <Ionicons name="chevron-forward" size={16} color="#85788A" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsNavRow}
              onPress={openSubscriptionModal}>
              <Text style={styles.settingsRowTitle}>{t("pro.managePlan")}</Text>
              <View style={styles.settingsNavRight}>
                <Text style={styles.settingsNavValue}>{hasProAccess ? t("pro.activeShort") : t("pro.freeShort")}</Text>
                <Ionicons name="chevron-forward" size={16} color="#85788A" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsNavRow} onPress={handleExportCycleData}>
              <Text style={styles.settingsRowTitle}>{t("settings.exportCycleData")}</Text>
              <Ionicons name="chevron-forward" size={16} color="#85788A" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsNavRow}>
              <Text style={styles.settingsRowTitle}>{t("settings.helpSupport")}</Text>
              <Ionicons name="chevron-forward" size={16} color="#85788A" />
            </TouchableOpacity>
          </View>

          <Modal
            visible={languagePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setLanguagePickerVisible(false)}>
            <Pressable style={styles.languageModalOverlay} onPress={() => setLanguagePickerVisible(false)}>
              <View style={styles.languageModalContent}>
                <Text style={styles.languageModalTitle}>{t("languagePicker.title")}</Text>
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => (
                  <TouchableOpacity
                    key={code}
                    style={styles.languageOptionRow}
                    onPress={() => {
                      i18n.changeLanguage(code);
                      persistLanguage(code as SupportedLanguage);
                      setLanguagePickerVisible(false);
                    }}>
                    <Text style={[
                      styles.languageOptionText,
                      i18n.language === code && styles.languageOptionTextActive,
                    ]}>
                      {label}
                    </Text>
                    {i18n.language === code && (
                      <Ionicons name="checkmark" size={18} color="#8F72C5" />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.languageCancelButton}
                  onPress={() => setLanguagePickerVisible(false)}>
                  <Text style={styles.languageCancelText}>{t("languagePicker.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          <Modal
            visible={isSubscriptionModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsSubscriptionModalVisible(false)}>
            <Pressable style={styles.subscriptionModalOverlay} onPress={() => setIsSubscriptionModalVisible(false)}>
              <Pressable style={styles.subscriptionModalCard} onPress={() => null}>
                <Text style={styles.subscriptionModalTitle}>{t("pro.managePlan")}</Text>
                <Text style={styles.subscriptionModalSubtitle}>{hasProAccess ? t("pro.activePlan") : t("pro.freePlan")}</Text>

                {subscriptionPlans.map((plan) => {
                  const revenueCatPackage = revenueCatPackages[plan.id];
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.subscriptionPlanButton, !revenueCatPackage && styles.subscriptionPlanButtonDisabled]}
                      disabled={!revenueCatPackage || isRevenueCatLoading}
                      onPress={() => {
                        void handlePurchasePlan(plan.id);
                      }}>
                      <View>
                        <Text style={styles.subscriptionPlanTitle}>{plan.label}</Text>
                        <Text style={styles.subscriptionPlanPrice}>
                          {revenueCatPackage?.product.priceString ?? t("pro.planUnavailable")}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#85788A" />
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.subscriptionActionButton}
                  disabled={isRevenueCatLoading}
                  onPress={() => {
                    void handlePresentPaywall(false);
                  }}>
                  <Text style={styles.subscriptionActionButtonText}>{t("pro.openPaywall")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.subscriptionActionButton}
                  disabled={isRevenueCatLoading}
                  onPress={() => {
                    void handleRestoreSubscription();
                  }}>
                  <Text style={styles.subscriptionActionButtonText}>{t("pro.restorePurchases")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.subscriptionActionButton}
                  disabled={isRevenueCatLoading}
                  onPress={() => {
                    void handleOpenCustomerCenter();
                  }}>
                  <Text style={styles.subscriptionActionButtonText}>{t("pro.openCustomerCenter")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.subscriptionCloseButton}
                  disabled={isRevenueCatLoading}
                  onPress={() => setIsSubscriptionModalVisible(false)}>
                  <Text style={styles.subscriptionCloseButtonText}>{t("pro.close")}</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.profileIdentityWrap}>
            <View style={styles.profileAvatarLarge}>
              <Text style={styles.profileAvatarLargeText}>{profileName[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{profileName}</Text>
              <Text style={styles.profileMetaText}>{profileGoals}</Text>
              <Text style={styles.profilePlanText}>{hasProAccess ? t("pro.activePlan") : t("pro.freePlan")}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.profileSettingsIconButton} onPress={openEditProfile}>
            <Ionicons name="settings-outline" size={22} color="#5D4F64" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileHeroCard}>
          <Text style={styles.profileHeroTitle}>{t("profile.heroTitle")}</Text>
          <Text style={styles.profileHeroSubtitle}>
            {t("profile.heroSubtitle")}
          </Text>
        </View>

        <View style={styles.profileStatsGrid}>
          <View style={[styles.profileStatCard, styles.profileStatCardLavender]}>
            <Text style={styles.profileStatTitle}>{t("profile.cycleLength")}</Text>
            <Text style={styles.profileStatValue}>{t("profile.days", { count: cycleLength })}</Text>
          </View>

          <View style={[styles.profileStatCard, styles.profileStatCardPink]}>
            <Text style={styles.profileStatTitle}>{t("profile.periodLength")}</Text>
            <Text style={styles.profileStatValue}>{t("profile.days", { count: periodLength })}</Text>
          </View>

          <View style={[styles.profileStatCard, styles.profileStatCardMint]}>
            <Text style={styles.profileStatTitle}>{t("profile.lastLogged")}</Text>
            <Text style={styles.profileStatValueSmall}>{lastPeriodDate.toLocaleDateString(dateLocale)}</Text>
          </View>

          <View style={[styles.profileStatCard, styles.profileStatCardPeach]}>
            <Text style={styles.profileStatTitle}>{t("profile.nextPeriod")}</Text>
            <Text style={styles.profileStatValueSmall}>{cycleContext.nextPeriodStart.toLocaleDateString(dateLocale)}</Text>
          </View>
        </View>

        <View style={styles.profileMenuCard}>
          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setActiveTab("insights")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>{t("profile.cycleInsights")}</Text>
              <Text style={styles.profileMenuSubtitle}>{t("profile.cycleInsightsDesc")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setActiveTab("tips")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>{t("profile.tipsWellbeing")}</Text>
              <Text style={styles.profileMenuSubtitle}>{t("profile.tipsWellbeingDesc")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setActiveTab("ai")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>{t("profile.aiAssistant")}</Text>
              <Text style={styles.profileMenuSubtitle}>{t("profile.aiAssistantDesc")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setProfileView("settings")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>{t("profile.appSettings")}</Text>
              <Text style={styles.profileMenuSubtitle}>{t("profile.appSettingsDesc")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>
        </View>

        <NumberAdjuster
          label={t("profile.cycleLength")}
          hint={t("profile.cycleLengthHint")}
          value={cycleLength}
          min={21}
          max={40}
          onChange={setCycleLength}
        />

        <NumberAdjuster
          label={t("profile.periodLength")}
          hint={t("profile.periodLengthHint")}
          value={periodLength}
          min={3}
          max={10}
          onChange={setPeriodLength}
        />
      </ScrollView>
    );
  };

  const renderTabContent = () => {
    if (activeTab === "home") {
      return renderHomeTab();
    }
    if (activeTab === "insights") {
      return renderInsightsTab();
    }
    if (activeTab === "ai") {
      return renderAiTab();
    }
    if (activeTab === "tips") {
      return renderTipsTab();
    }
    return renderProfileTab();
  };

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <DecorativeBackground />
        <View style={styles.hydrationWrap}>
          <Text style={styles.hydrationText}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isOnboardingDone) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <DecorativeBackground />

        <View style={styles.onboardingWrapper}>
          {step > 0 && <Text style={styles.progressText}>{t("onboarding.stepProgress", { current: step + 1, total: 5 })}</Text>}

          <Animated.View
            style={[
              onboardingAnimatedStyle,
              step === 0 ? styles.onboardingStageWelcome : styles.onboardingStageCard,
            ]}>
            {step === 0 ? renderOnboardingBody() : <View style={styles.card}>{renderOnboardingBody()}</View>}
          </Animated.View>

          <View style={[styles.footerButtons, step === 0 && styles.footerButtonsSingle]}>
            {step > 0 && (
              <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
                <Text style={styles.secondaryButtonText}>{t("onboarding.back")}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                !canContinue && styles.primaryButtonDisabled,
                step === 0 && styles.primaryButtonFull,
              ]}
              onPress={onNext}
              disabled={!canContinue}>
              <Text style={styles.primaryButtonText}>{stepButtonLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <DecorativeBackground />
      <View style={styles.postOnboardingWrapper}>
        <View style={styles.tabContent}>{renderTabContent()}</View>

        <View style={styles.bottomNavBar}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.navItem}
                onPress={() => setActiveTab(item.key)}>
                <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
                  <Ionicons name={item.icon} size={19} color={isActive ? "#FFFFFF" : "#6E6074"} />
                </View>
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{t(item.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Modal
        visible={isProSuccessVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProSuccessVisible(false)}>
        <Pressable style={styles.proSuccessOverlay} onPress={() => setIsProSuccessVisible(false)}>
          <Pressable style={styles.proSuccessCard} onPress={() => null}>
            <View style={styles.proSuccessIconCircle}>
              <Ionicons name="checkmark" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.proSuccessTitle}>{t("pro.purchaseSuccessTitle")}</Text>
            <Text style={styles.proSuccessText}>{t("pro.purchaseSuccessDescription")}</Text>
            <TouchableOpacity style={styles.proSuccessButton} onPress={() => setIsProSuccessVisible(false)}>
              <Text style={styles.proSuccessButtonText}>{t("pro.close")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={checkInHistoryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckInHistoryVisible(false)}>
        <Pressable style={styles.historyModalOverlay} onPress={() => setCheckInHistoryVisible(false)}>
          <Pressable style={styles.historyModalContent} onPress={() => null}>
            <LinearGradient
              colors={["#F8F4FF", "#FFFFFF"]}
              style={styles.historyModalGradient}>
              <View style={styles.historyModalHeader}>
                <View style={styles.historyModalHeaderLeft}>
                  <View style={styles.historyModalIconContainer}>
                    <MaterialCommunityIcons name="calendar-clock" size={22} color="#8F72C5" />
                  </View>
                  <View>
                    <Text style={styles.historyModalTitle}>{t("tips.checkInHistory")}</Text>
                    <Text style={styles.historyModalSubtitle}>
                      {symptomLogs.length > 0
                        ? t("history.totalEntries", { count: symptomLogs.length })
                        : t("history.noEntriesYet")}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.historyModalCloseButton}
                  onPress={() => setCheckInHistoryVisible(false)}>
                  <Ionicons name="close" size={24} color="#6E6074" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.historyList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={symptomLogs.length === 0 ? styles.historyListEmptyCenter : styles.historyListContent}>
                {symptomLogs.length === 0 ? (
                  <View style={styles.emptyHistoryContainer}>
                    <LinearGradient
                      colors={["#F0E8FA", "#E9DFFF"]}
                      style={styles.emptyHistoryIconContainer}>
                      <MaterialCommunityIcons name="calendar-blank-outline" size={72} color="#8F72C5" />
                    </LinearGradient>
                    <Text style={styles.emptyHistoryTitle}>{t("history.emptyTitle")}</Text>
                    <Text style={styles.emptyHistoryText}>{t("history.emptyMessage")}</Text>
                    <TouchableOpacity
                      style={styles.emptyHistoryButton}
                      onPress={() => {
                        setCheckInHistoryVisible(false);
                      }}>
                      <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.emptyHistoryButtonText}>{t("history.startTracking")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.historyEntryListContainer}>
                      {sortedSymptomLogs.map((entry) => {
                        const entryDate = new Date(entry.dateISO);
                        const flowOption = MENSTRUAL_FLOW_OPTIONS.find((opt) => opt.key === entry.flowKey);
                        const isSelected = selectedHistoryEntry?.id === entry.id;
                        const todayEntry = isSameDay(entryDate, new Date());
                        const moodEmojis = entry.moods
                          .map((moodKey) => MOOD_OPTIONS.find((opt) => opt.labelKey === moodKey)?.emoji)
                          .filter((emoji): emoji is string => Boolean(emoji));
                        const visibleMoodEmojis = moodEmojis.slice(0, 3);
                        const hiddenMoodCount = moodEmojis.length - visibleMoodEmojis.length;

                        return (
                          <Pressable
                            key={entry.id}
                            style={[styles.historyEntryItem, isSelected && styles.historyEntryItemActive]}
                            onPress={() => setSelectedHistoryEntryId(entry.id)}>
                            <View style={styles.historyEntryTopRow}>
                              <Text style={[styles.historyEntryDateText, isSelected && styles.historyEntryDateTextActive]}>
                                {entryDate.toLocaleDateString(dateLocale, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </Text>
                              {todayEntry && (
                                <View style={styles.historyEntryTodayBadge}>
                                  <Text style={styles.historyEntryTodayBadgeText}>{t("home.today")}</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.historyEntryMetaRow}>
                              <Text style={styles.historyEntryFlowText}>{flowOption ? t(flowOption.labelKey) : ""}</Text>
                              {visibleMoodEmojis.length > 0 && (
                                <Text style={styles.historyEntryMoodText}>
                                  {visibleMoodEmojis.join(" ")}
                                  {hiddenMoodCount > 0 ? ` +${hiddenMoodCount}` : ""}
                                </Text>
                              )}
                              {isSelected && <Ionicons name="chevron-forward" size={16} color="#8F72C5" />}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>

                    {selectedHistoryEntry && (
                      <View style={styles.historyDetailsWrap}>
                        <Text style={styles.historyDetailsTitle}>{t("tips.viewOrEdit")}</Text>

                        <View style={styles.historyCard}>
                          <View style={styles.historyCardHeader}>
                            <View style={styles.historyDateContainer}>
                              <LinearGradient
                                colors={
                                  isSelectedHistoryEntryToday
                                    ? ["#8F72C5", "#A788D9"]
                                    : isSelectedHistoryEntryYesterday
                                      ? ["#B8A8E0", "#D4C2F0"]
                                      : ["#E9DFFF", "#F5E6FF"]
                                }
                                style={[
                                  styles.historyDateBadge,
                                  isSelectedHistoryEntryToday && styles.historyDateBadgeToday,
                                ]}>
                                <Text style={styles.historyDateDay}>
                                  {selectedHistoryEntryDate?.toLocaleDateString(dateLocale, { day: "numeric" })}
                                </Text>
                                <Text style={styles.historyDateMonth}>
                                  {selectedHistoryEntryDate?.toLocaleDateString(dateLocale, { month: "short" })}
                                </Text>
                              </LinearGradient>
                              {isSelectedHistoryEntryToday && (
                                <View style={styles.todayBadge}>
                                  <Text style={styles.todayBadgeText}>{t("home.today")}</Text>
                                </View>
                              )}
                            </View>
                            <TouchableOpacity
                              style={styles.historyDeleteButton}
                              onPress={() => {
                                Alert.alert(
                                  t("tips.deleteCheckIn"),
                                  t("tips.deleteCheckInConfirm"),
                                  [
                                    { text: t("languagePicker.cancel"), style: "cancel" },
                                    {
                                      text: t("tips.delete"),
                                      style: "destructive",
                                      onPress: () => {
                                        setSymptomLogs((logs) => logs.filter((log) => log.id !== selectedHistoryEntry.id));
                                        setSelectedHistoryEntryId((currentId) =>
                                          currentId === selectedHistoryEntry.id ? null : currentId,
                                        );
                                        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                      },
                                    },
                                  ],
                                );
                              }}>
                              <Ionicons name="trash-outline" size={18} color="#E57373" />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.historyCardBody}>
                            <View style={styles.historyFlowRow}>
                              <View style={styles.historyFlowIconContainer}>
                                <MaterialCommunityIcons name="water" size={16} color="#8F72C5" />
                                <Text style={styles.historyFlowLabel}>{t("tips.menstrualFlow")}</Text>
                              </View>
                              <View style={styles.historyFlowValueContainer}>
                                {Array.from({ length: selectedHistoryFlowOption?.drops || 1 }).map((_, dropIndex) => (
                                  <View key={dropIndex} style={styles.historyFlowDrop}>
                                    <MaterialCommunityIcons name="water" size={12} color="#8F72C5" />
                                  </View>
                                ))}
                                <Text style={styles.historyFlowText}>
                                  {selectedHistoryFlowOption ? t(selectedHistoryFlowOption.labelKey) : ""}
                                </Text>
                              </View>
                            </View>

                            {selectedHistoryEntry.moods.length > 0 && (
                              <View style={styles.historyMoodsContainer}>
                                <View style={styles.historyMoodsHeader}>
                                  <MaterialCommunityIcons name="emoticon-happy-outline" size={16} color="#8F72C5" />
                                  <Text style={styles.historyMoodsLabel}>{t("tips.moods")}</Text>
                                </View>
                                <View style={styles.historyMoodsGrid}>
                                  {selectedHistoryEntry.moods.map((moodKey) => {
                                    const moodOption = MOOD_OPTIONS.find((opt) => opt.labelKey === moodKey);
                                    return moodOption ? (
                                      <View key={moodKey} style={styles.historyMoodChip}>
                                        <Text style={styles.historyMoodEmoji}>{moodOption.emoji}</Text>
                                        <Text style={styles.historyMoodLabel}>{t(moodOption.labelKey)}</Text>
                                      </View>
                                    ) : null;
                                  })}
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.historyCloseButton}
                onPress={() => setCheckInHistoryVisible(false)}>
                <Text style={styles.historyCloseButtonText}>{t("pro.close")}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF9FC",
  },
  hydrationWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationText: {
    color: "#5E5264",
    fontSize: 16,
    fontWeight: "600",
  },
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  decorIcon: {
    position: "absolute",
    opacity: 0.45,
  },
  bubble: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    opacity: 0.64,
  },
  onboardingWrapper: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
  },
  progressText: {
    textAlign: "center",
    color: "#7A707D",
    fontSize: 14,
    marginBottom: 10,
    fontWeight: "600",
  },
  onboardingStageWelcome: {
    flex: 1,
  },
  onboardingStageCard: {
    flex: 1,
  },
  welcomeStage: {
    flex: 1,
    justifyContent: "center",
  },
  welcomeIllustration: {
    alignItems: "center",
    justifyContent: "center",
    height: "55%",
    marginBottom: 10,
  },
  onboardingImage: {
    width: "100%",
    height: "100%",
  },
  welcomeTextBlock: {
    alignItems: "center",
    marginTop: 8,
    gap: 10,
  },
  welcomeTitle: {
    fontSize: 46,
    lineHeight: 56,
    fontWeight: "700",
    color: "#0E0D15",
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#7D707C",
    textAlign: "center",
    fontWeight: "500",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFFF2",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#EEE2EA",
  },
  contentBlock: {
    flex: 1,
  },
  title: {
    fontSize: 31,
    color: "#1A1521",
    lineHeight: 40,
    fontWeight: "700",
  },
  descriptionLeft: {
    marginTop: 10,
    color: "#7D707C",
    fontSize: 16,
    lineHeight: 24,
  },
  descriptionMuted: {
    marginTop: 6,
    color: "#8F8092",
    fontSize: 14,
  },
  input: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: "#DED0DD",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: "#332A37",
    backgroundColor: "#FFFFFF",
  },
  optionList: {
    marginTop: 18,
    gap: 12,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#D8C9D8",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionButtonActive: {
    borderColor: "#9678CA",
    backgroundColor: "#F6EEFC",
  },
  optionText: {
    fontSize: 17,
    color: "#4A4050",
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#674A9D",
    fontWeight: "700",
  },
  optionIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#C9B8D0",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIndicatorActive: {
    borderColor: "#9678CA",
    backgroundColor: "#9678CA",
  },
  monthHeader: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthArrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DFD0DE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  monthArrowText: {
    fontSize: 18,
    color: "#4A4050",
    fontWeight: "700",
  },
  monthTitle: {
    fontSize: 17,
    color: "#4A4050",
    fontWeight: "700",
  },
  weekHeader: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  weekDayText: {
    width: "14.28%",
    textAlign: "center",
    color: "#8B7E8D",
    fontWeight: "600",
    fontSize: 12,
  },
  calendarGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginBottom: 2,
  },
  dayCellMuted: {
    opacity: 0.35,
  },
  dayCellSelected: {
    backgroundColor: "#E7D8F8",
  },
  dayCellText: {
    color: "#54485A",
    fontSize: 15,
    fontWeight: "500",
  },
  dayCellTextMuted: {
    color: "#8E8190",
  },
  dayCellTextSelected: {
    color: "#4C3A70",
    fontWeight: "700",
  },
  dayPeriod: {
    backgroundColor: "#D8C3F9",
  },
  dayOvulation: {
    backgroundColor: "#BFDDFE",
  },
  dayFertility: {
    backgroundColor: "#CDEFD9",
  },
  selectedCalendarDayOutline: {
    borderWidth: 2,
    borderColor: "#6A5A88",
  },
  todayOutline: {
    borderWidth: 1,
    borderColor: "#6E5B79",
  },
  calendarHintText: {
    marginTop: 10,
    color: "#7B6E80",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  periodStartButton: {
    backgroundColor: "#8F72C5",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    shadowColor: "#8F72C5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  periodStartButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  setAsPeriodButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FDF8FD",
    marginTop: 4,
  },
  setAsPeriodButtonText: {
    color: "#8F72C5",
    fontSize: 14,
    fontWeight: "700",
  },
  probabilityCard: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFF2",
    padding: 12,
    gap: 6,
  },
  probabilityHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  probabilityTitle: {
    color: "#2D2433",
    fontSize: 16,
    fontWeight: "800",
  },
  probabilityDateLabel: {
    color: "#8B7D8E",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  probabilityBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  probabilityBadgeHigh: {
    backgroundColor: "#FCDDE6",
  },
  probabilityBadgeMedium: {
    backgroundColor: "#FDF1D9",
  },
  probabilityBadgeLow: {
    backgroundColor: "#E9EFF9",
  },
  probabilityBadgeText: {
    color: "#4A3F53",
    fontSize: 11,
    fontWeight: "800",
  },
  probabilitySummary: {
    color: "#4C3F53",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  probabilityMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  probabilityMetaText: {
    color: "#7B6F7E",
    fontSize: 12,
    fontWeight: "700",
  },
  probabilityWindowText: {
    color: "#6E6172",
    fontSize: 12,
    lineHeight: 17,
  },
  probabilityRecommendation: {
    color: "#5A4E60",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  confirmedDateText: {
    marginTop: 14,
    textAlign: "center",
    color: "#574B5C",
    fontSize: 15,
    fontWeight: "600",
  },
  adjusterWrap: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#E1D4E3",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  adjusterTextWrap: {
    gap: 4,
  },
  adjusterLabel: {
    fontSize: 16,
    color: "#302636",
    fontWeight: "700",
  },
  adjusterHint: {
    fontSize: 13,
    color: "#8A7C8E",
  },
  adjusterControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CDBAD1",
    alignItems: "center",
    justifyContent: "center",
  },
  adjustButtonDisabled: {
    opacity: 0.45,
  },
  adjustButtonText: {
    color: "#594D61",
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "600",
  },
  adjustValue: {
    fontSize: 20,
    color: "#322739",
    fontWeight: "700",
    minWidth: 44,
    textAlign: "center",
  },
  reminderRow: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E1D4E3",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerButtons: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  footerButtonsSingle: {
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#D8C9D8",
    backgroundColor: "#FFFFFFE6",
    minHeight: 56,
  },
  secondaryButtonText: {
    color: "#4A4050",
    fontSize: 16,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    minHeight: 56,
    backgroundColor: "#8F72C5",
  },
  primaryButtonDisabled: {
    backgroundColor: "#C7B4E4",
  },
  primaryButtonFull: {
    flex: 1,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  postOnboardingWrapper: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabContent: {
    flex: 1,
  },
  tabScrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 29,
    color: "#17111E",
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#7F7183",
    marginTop: 4,
    fontSize: 14,
  },
  profileAvatarWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8F72C5",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  homeProBadge: {
    borderRadius: 10,
    backgroundColor: "#F7B84B",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  homeProBadgeWrap: {
    position: "absolute",
    bottom: -4,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  homeProBadgeText: {
    color: "#4F3A09",
    fontSize: 10,
    fontWeight: "800",
  },
  insightRow: {
    paddingHorizontal: 18,
    gap: 12,
    paddingVertical: 4,
  },
  insightCard: {
    width: 200,
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  insightCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  insightIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  insightCardBody: {
    gap: 2,
  },
  insightHeroValue: {
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 40,
  },
  insightHeroLabel: {
    fontSize: 14,
    color: "#4A4050",
    fontWeight: "600",
    lineHeight: 19,
  },
  insightSubtitle: {
    fontSize: 12,
    color: "#8A7C8D",
    lineHeight: 17,
    fontWeight: "500",
  },
  monthChipRow: {
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
  },
  monthChip: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#DFD0DE",
    backgroundColor: "#FFFFFF",
  },
  monthChipActive: {
    borderColor: "#8F72C5",
    backgroundColor: "#EFE4FB",
  },
  monthChipText: {
    color: "#645869",
    fontWeight: "600",
    fontSize: 13,
  },
  monthChipTextActive: {
    color: "#674A9D",
  },
  calendarCard: {
    marginTop: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFF2",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  calendarCardTitle: {
    fontSize: 17,
    color: "#302636",
    fontWeight: "700",
    textAlign: "center",
  },
  legendRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: "#7E7081",
    fontSize: 12,
    fontWeight: "600",
  },
  insightSectionTitle: {
    color: "#2C2232",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48.5%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D8E8",
    padding: 14,
    gap: 6,
  },
  statCardPink: {
    backgroundColor: "#FCEEF4",
  },
  statCardLavender: {
    backgroundColor: "#F7F0FC",
  },
  statCardPeach: {
    backgroundColor: "#FFF3EA",
  },
  statCardMint: {
    backgroundColor: "#ECF8F1",
  },
  statTitle: {
    color: "#6D6171",
    fontSize: 14,
    fontWeight: "600",
  },
  statValue: {
    color: "#2E2435",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
  },
  statSubtext: {
    color: "#8A7C8D",
    fontSize: 13,
    lineHeight: 18,
  },
  overviewCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFEE",
    padding: 16,
    gap: 16,
  },
  overviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overviewTitle: {
    color: "#2F2436",
    fontSize: 22,
    fontWeight: "800",
  },
  overviewBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0E8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  cycleOverviewScroll: {
    paddingHorizontal: 4,
    gap: 12,
  },
  cycleMonthCard: {
    width: 180,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12,
  },
  cycleMonthCardActive: {
    borderColor: "#8F72C5",
    backgroundColor: "#F7F2FF",
  },
  cycleMonthHeader: {
    alignItems: "center",
    gap: 2,
  },
  cycleMonthLabel: {
    color: "#6B5F70",
    fontSize: 15,
    fontWeight: "700",
  },
  cycleMonthLabelActive: {
    color: "#8F72C5",
  },
  cycleMonthYear: {
    color: "#9A8B9C",
    fontSize: 12,
    fontWeight: "600",
  },
  cycleMonthYearActive: {
    color: "#8F72C5",
  },
  cycleStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8,
  },
  cycleStatItem: {
    alignItems: "center",
    gap: 4,
  },
  cycleStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cycleStatValue: {
    color: "#4A4050",
    fontSize: 18,
    fontWeight: "800",
  },
  cycleStatValueActive: {
    color: "#8F72C5",
  },
  cycleStatLabel: {
    color: "#8A7C8D",
    fontSize: 10,
    fontWeight: "600",
  },
  cycleMiniChart: {
    gap: 6,
  },
  cycleMiniBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0E8F2",
    flexDirection: "row",
    overflow: "hidden",
  },
  cycleMiniBar: {
    height: 8,
  },
  cycleMiniChartLabel: {
    color: "#7A6D7F",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  cycleSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#F7F2FF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  cycleSummaryItem: {
    alignItems: "center",
    gap: 4,
  },
  cycleSummaryValue: {
    color: "#8F72C5",
    fontSize: 20,
    fontWeight: "800",
  },
  cycleSummaryLabel: {
    color: "#7A6D7F",
    fontSize: 11,
    fontWeight: "600",
  },
  cycleSummaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E7DCE6",
  },
  proInsightsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6D9EA",
    backgroundColor: "#FFFDFE",
    padding: 14,
    gap: 6,
    marginTop: 2,
  },
  proInsightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  proInsightsTitle: {
    color: "#2F2436",
    fontSize: 16,
    fontWeight: "700",
  },
  proInsightsText: {
    color: "#5C4F64",
    fontSize: 13,
    lineHeight: 18,
  },
  proInsightsLockedText: {
    color: "#7A6D7F",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  proInsightsUnlockButton: {
    alignSelf: "flex-start",
    borderRadius: 16,
    backgroundColor: "#8F72C5",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  proInsightsUnlockText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  aiPageWrap: {
    flex: 1,
    gap: 10,
  },
  aiHeroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E6D9E9",
    padding: 16,
    gap: 12,
  },
  aiHeroTitle: {
    color: "#2F2436",
    fontSize: 24,
    fontWeight: "800",
  },
  aiHeroSubtitle: {
    marginTop: 6,
    color: "#7C6F80",
    fontSize: 14,
    lineHeight: 20,
  },
  aiStatusChip: {
    alignSelf: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9CBE7",
    backgroundColor: "#F4EEFB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiStatusChipText: {
    color: "#5D4193",
    fontSize: 12,
    fontWeight: "700",
  },
  aiQuotaCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1D4E5",
    backgroundColor: "#FFFFFFF0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiQuotaTitle: {
    color: "#55495D",
    fontSize: 12,
    fontWeight: "600",
  },
  aiQuotaUpgradeText: {
    color: "#7F5DBE",
    fontSize: 12,
    fontWeight: "700",
  },
  aiPromptRow: {
    gap: 8,
    paddingRight: 4,
    alignItems: "center",
  },
  aiPromptScroll: {
    flexGrow: 0,
  },
  aiPromptChip: {
    alignSelf: "flex-start",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDCFE3",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  aiPromptChipText: {
    color: "#5E5264",
    fontSize: 13,
    fontWeight: "600",
  },
  aiMessagesScroll: {
    flex: 1,
  },
  aiMessagesContent: {
    gap: 8,
    paddingBottom: 8,
  },
  aiBubble: {
    maxWidth: "86%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aiAssistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFFEC",
    borderWidth: 1,
    borderColor: "#E7DCE6",
  },
  aiUserBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#8F72C5",
  },
  aiBubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: undefined,
  },
  aiAssistantBubbleText: {
    color: "#3A2E40",
    fontSize: 14,
    lineHeight: 20,
  },
  aiUserBubbleText: {
    color: "#FFFFFF",
  },
  aiTypingBubble: {
    opacity: 0.8,
  },
  aiComposerWrap: {
    marginTop: 2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E3D6E7",
    backgroundColor: "#FFFFFFF0",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiInput: {
    flex: 1,
    minHeight: 40,
    color: "#2F2436",
    fontSize: 15,
    paddingHorizontal: 8,
  },
  aiSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#8F72C5",
    alignItems: "center",
    justifyContent: "center",
  },
  aiSendButtonDisabled: {
    backgroundColor: "#C2AFDD",
  },
  settingsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  settingsBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2D6E5",
    backgroundColor: "#FFFFFFEE",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsHeaderTitle: {
    fontSize: 24,
    color: "#2F2436",
    fontWeight: "800",
  },
  settingsHeaderSpacer: {
    width: 36,
  },
  settingsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFEE",
    padding: 14,
    gap: 10,
  },
  settingsSectionTitle: {
    color: "#3A2F40",
    fontSize: 16,
    fontWeight: "800",
  },
  settingsSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  settingsSwitchTextWrap: {
    flex: 1,
    gap: 3,
  },
  settingsRowTitle: {
    color: "#3F3346",
    fontSize: 15,
    fontWeight: "700",
  },
  settingsRowSubtitle: {
    color: "#817486",
    fontSize: 12,
    lineHeight: 17,
  },
  settingsNavRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F0E8F2",
    paddingTop: 10,
  },
  settingsNavRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingsNavValue: {
    color: "#8B7D8F",
    fontSize: 13,
    fontWeight: "600",
  },
  editProfileAvatarWrap: {
    paddingTop: 6,
    alignItems: "center",
  },
  editProfileFieldLabel: {
    color: "#4C3D54",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  editProfileInput: {
    borderWidth: 1,
    borderColor: "#DED0DD",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#332A37",
    backgroundColor: "#FFFFFF",
  },
  editProfileActionsRow: {
    marginTop: 4,
    flexDirection: "row",
    gap: 10,
  },
  editProfileCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8CADE",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  editProfileCancelButtonText: {
    color: "#6C5F73",
    fontSize: 14,
    fontWeight: "700",
  },
  editProfileSaveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8F72C5",
  },
  editProfileSaveButtonDisabled: {
    backgroundColor: "#C5B3DE",
  },
  editProfileSaveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  profileHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileIdentityWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileAvatarLarge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#8F72C5",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarLargeText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  profileName: {
    color: "#2C2232",
    fontSize: 24,
    fontWeight: "800",
  },
  profileMetaText: {
    color: "#7D6F81",
    fontSize: 13,
    marginTop: 2,
  },
  profilePlanText: {
    color: "#7E63B2",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  profileSettingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2D6E5",
    backgroundColor: "#FFFFFFEE",
    alignItems: "center",
    justifyContent: "center",
  },
  profileHeroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8DCEC",
    backgroundColor: "#F7EEF9",
    padding: 14,
    gap: 6,
  },
  profileHeroTitle: {
    color: "#2F2436",
    fontSize: 18,
    fontWeight: "800",
  },
  profileHeroSubtitle: {
    color: "#7C6F80",
    fontSize: 13,
    lineHeight: 19,
  },
  profileStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  profileStatCard: {
    width: "48.5%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    padding: 12,
    gap: 5,
  },
  profileStatCardLavender: {
    backgroundColor: "#F5EEFB",
  },
  profileStatCardPink: {
    backgroundColor: "#FDF0F5",
  },
  profileStatCardMint: {
    backgroundColor: "#EDF8F2",
  },
  profileStatCardPeach: {
    backgroundColor: "#FFF4EB",
  },
  profileStatTitle: {
    color: "#726575",
    fontSize: 13,
    fontWeight: "600",
  },
  profileStatValue: {
    color: "#2F2436",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
  },
  profileStatValueSmall: {
    color: "#2F2436",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },
  profileMenuCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  profileMenuRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F0E7F2",
  },
  profileMenuLabelWrap: {
    flex: 1,
    gap: 2,
    paddingRight: 10,
  },
  profileMenuTitle: {
    color: "#3E3345",
    fontSize: 15,
    fontWeight: "700",
  },
  profileMenuSubtitle: {
    color: "#8A7D8E",
    fontSize: 12,
  },
  tipsQuestion: {
    color: "#2F2436",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
  },
  flowCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E4D5E9",
    backgroundColor: "#F5E6F4",
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  flowCardTitle: {
    color: "#2F2436",
    fontSize: 18,
    fontWeight: "700",
  },
  flowTabRow: {
    flexDirection: "row",
    gap: 8,
  },
  flowTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5D8E8",
    backgroundColor: "#FAF2FB",
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  flowTabActive: {
    borderColor: "#8F72C5",
    backgroundColor: "#8F72C5",
  },
  flowDropRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  flowLabel: {
    color: "#44384D",
    fontSize: 12,
    fontWeight: "600",
  },
  flowLabelActive: {
    color: "#FFFFFF",
  },
  moodGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  saveCheckinButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 18,
    backgroundColor: "#8F72C5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveCheckinButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  todayCheckInBanner: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4CAF50",
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  todayCheckInBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayCheckInBannerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  todayCheckInBannerLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1976D2",
    textDecorationLine: "underline",
  },
  viewHistoryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 18,
    backgroundColor: "#F0E8FA",
    borderWidth: 1,
    borderColor: "#8F72C5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewHistoryButtonText: {
    color: "#8F72C5",
    fontSize: 13,
    fontWeight: "700",
  },
  historyModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  historyModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    maxHeight: "85%",
    minHeight: "55%",
    overflow: "hidden",
  },
  historyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  historyModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2F2436",
  },
  historyList: {
    flex: 1,
    minHeight: 140,
  },
  historyListContent: {
    gap: 14,
    paddingBottom: 8,
    flexGrow: 1,
  },
  historyEntryListContainer: {
    gap: 10,
  },
  historyEntryItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6DDEE",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  historyEntryItemActive: {
    borderColor: "#8F72C5",
    backgroundColor: "#F7F2FF",
  },
  historyEntryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyEntryDateText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4D4157",
  },
  historyEntryDateTextActive: {
    color: "#5D4193",
  },
  historyEntryTodayBadge: {
    backgroundColor: "#E9DFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  historyEntryTodayBadgeText: {
    color: "#6A4CA5",
    fontSize: 10,
    fontWeight: "700",
  },
  historyEntryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyEntryFlowText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#715D86",
  },
  historyEntryMoodText: {
    flex: 1,
    fontSize: 12,
    color: "#6C5E74",
  },
  historyDetailsWrap: {
    marginTop: 6,
    gap: 10,
  },
  historyDetailsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4D4157",
  },
  emptyHistoryContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#5E5265",
    marginTop: 16,
  },
  historyCard: {
    backgroundColor: "#FEFBFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1D4E2",
    padding: 16,
    marginBottom: 12,
  },
  historyCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayBadge: {
    backgroundColor: "#8F72C5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  todayBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  historyFlowRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    justifyContent: "space-between",
  },
  historyFlowText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8F72C5",
    marginLeft: 4,
  },
  historyMoodsContainer: {
    marginTop: 8,
  },
  historyMoodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  historyMoodChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0E8FA",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  historyMoodEmoji: {
    fontSize: 14,
  },
  historyMoodLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5D4193",
  },
  historyCloseButton: {
    backgroundColor: "#8F72C5",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  historyCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  historyModalGradient: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  historyModalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  historyModalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0E8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  historyModalSubtitle: {
    fontSize: 13,
    color: "#7D6F81",
    marginTop: 2,
  },
  historyModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F0FA",
    alignItems: "center",
    justifyContent: "center",
  },
  historyListEmptyCenter: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyHistoryIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyHistoryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2F2436",
    marginBottom: 8,
  },
  emptyHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8F72C5",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    marginTop: 20,
    shadowColor: "#8F72C5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyHistoryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  historyDateBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8F72C5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  historyDateBadgeToday: {
    shadowColor: "#8F72C5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  historyDateDay: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  historyDateMonth: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  historyDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFEBEE",
    alignItems: "center",
    justifyContent: "center",
  },
  historyCardBody: {
    gap: 12,
  },
  historyFlowIconContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyFlowLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5E5265",
  },
  historyFlowValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyFlowDrop: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F0E8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  historyMoodsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyMoodsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5E5265",
  },
  moodChip: {
    minWidth: "31%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1D4E2",
    backgroundColor: "#FEFBFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  moodChipActive: {
    borderColor: "#8F72C5",
    backgroundColor: "#F0E8FA",
  },
  moodEmoji: {
    fontSize: 21,
  },
  moodLabel: {
    color: "#5E5265",
    fontSize: 12,
    fontWeight: "600",
  },
  moodLabelActive: {
    color: "#5D4193",
  },
  tipsSectionWrap: {
    gap: 10,
  },
  tipsSectionTitle: {
    color: "#2F2436",
    fontSize: 19,
    fontWeight: "700",
  },
  tipsCarouselRow: {
    gap: 10,
    paddingRight: 6,
  },
  tipCard: {
    width: 250,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5D8E7",
    backgroundColor: "#FFFFFFEE",
    padding: 14,
    gap: 8,
  },
  tipTitle: {
    color: "#362C3D",
    fontSize: 17,
    fontWeight: "700",
  },
  tipDetail: {
    color: "#76697D",
    fontSize: 14,
    lineHeight: 20,
  },
  tipsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  tipsSectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0E8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  tipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tipsGridScroll: {
    paddingHorizontal: 4,
    gap: 12,
  },
  tipCardNew: {
    width: 155,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 10,
  },
  tipCardLeft: {
    width: "100%",
  },
  tipIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tipContent: {
    flex: 1,
    gap: 4,
  },
  tipTitleNew: {
    color: "#2F2436",
    fontSize: 16,
    fontWeight: "700",
  },
  tipDetailNew: {
    color: "#7A6D7F",
    fontSize: 13,
    lineHeight: 18,
  },
  tipArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F0E8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  tipsMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8F72C5",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 8,
  },
  tipsMoreButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  breathingContainer: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#EBE0FF",
    padding: 24,
    gap: 20,
    shadowColor: "#8F72C5",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
    overflow: "hidden",
  },
  breathingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  breathingTitle: {
    fontSize: 22,
    color: "#2F2436",
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  breathingSubtitle: {
    fontSize: 14,
    color: "#8F72C5",
    fontWeight: "600",
    marginTop: 2,
  },
  breathingVisualArea: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  breathingCircleBackground: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  breathingRipple1: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#E9DFFF",
    opacity: 0.5,
    position: "absolute",
  },
  breathingRipple2: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "#E9DFFF",
    opacity: 0.8,
    position: "absolute",
  },
  breathingMainCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: "#8F72C5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  breathingCircleGradient: {
    flex: 1,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  breathingPhaseOverlay: {
    position: "absolute",
    bottom: -10,
    alignItems: "center",
  },
  breathingPhaseText: {
    fontSize: 18,
    color: "#4A3F53",
    fontWeight: "800",
    textAlign: "center",
  },
  breathingTimerText: {
    fontSize: 14,
    color: "#8F72C5",
    fontWeight: "700",
    marginTop: 4,
  },
  breathingDescription: {
    fontSize: 15,
    color: "#7B6E80",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  breathingStartButton: {
    backgroundColor: "#8F72C5",
    borderRadius: 20,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8F72C5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  breathingStopButton: {
    backgroundColor: "#2F2436",
    shadowColor: "#000000",
  },
  breathingStartButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  mentalHealthContainer: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#EADCF8",
    padding: 18,
    gap: 14,
  },
  mentalHealthHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  mentalHealthHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  mentalHealthTitle: {
    color: "#2F2436",
    fontSize: 21,
    fontWeight: "800",
  },
  mentalHealthSubtitle: {
    color: "#796A82",
    fontSize: 13,
    lineHeight: 18,
  },
  mentalHealthPlanBadge: {
    minWidth: 54,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
  },
  mentalHealthPlanBadgePro: {
    backgroundColor: "#8F72C5",
  },
  mentalHealthPlanBadgeFree: {
    backgroundColor: "#D6C6EC",
  },
  mentalHealthPlanBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  mentalHealthSafetyRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E7DAF6",
    backgroundColor: "#FFFFFFEE",
    padding: 10,
    gap: 8,
  },
  mentalHealthSafetyText: {
    color: "#6D5E76",
    fontSize: 12,
    lineHeight: 18,
  },
  mentalHealthSafetyButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D3BEEB",
    backgroundColor: "#F8F2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mentalHealthSafetyButtonText: {
    color: "#6D4BA4",
    fontSize: 12,
    fontWeight: "700",
  },
  mentalHealthStatsRow: {
    flexDirection: "row",
    gap: 8,
  },
  mentalHealthStatCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E7DDF3",
    backgroundColor: "#FFFFFFEE",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  mentalHealthStatValue: {
    color: "#32253B",
    fontSize: 18,
    fontWeight: "800",
  },
  mentalHealthStatLabel: {
    color: "#7A6C83",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  mentalHealthPhaseCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6DAF6",
    backgroundColor: "#F8F3FF",
    padding: 12,
    gap: 4,
  },
  mentalHealthPhaseText: {
    color: "#6D4BA4",
    fontSize: 12,
    fontWeight: "700",
  },
  mentalHealthRecommendedText: {
    color: "#34293D",
    fontSize: 15,
    fontWeight: "700",
  },
  mentalHealthLoggedTodayText: {
    color: "#3A965F",
    fontSize: 12,
    fontWeight: "700",
  },
  mentalHealthLockedCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D6F6",
    backgroundColor: "#FFFFFFEE",
    padding: 12,
    gap: 10,
  },
  mentalHealthLockedTitle: {
    color: "#34293D",
    fontSize: 16,
    fontWeight: "800",
  },
  mentalHealthLockedText: {
    color: "#786A81",
    fontSize: 13,
    lineHeight: 18,
  },
  mentalHealthUnlockButton: {
    marginTop: 2,
    borderRadius: 14,
    backgroundColor: "#8F72C5",
    paddingVertical: 12,
    alignItems: "center",
  },
  mentalHealthUnlockButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  mentalProgramChipRow: {
    gap: 8,
    paddingRight: 6,
  },
  mentalProgramChip: {
    minWidth: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCCCF0",
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  mentalProgramChipActive: {
    backgroundColor: "#8F72C5",
    borderColor: "#8F72C5",
  },
  mentalProgramChipText: {
    color: "#3D3048",
    fontSize: 13,
    fontWeight: "700",
  },
  mentalProgramChipTextActive: {
    color: "#FFFFFF",
  },
  mentalProgramChipProgressText: {
    color: "#786A81",
    fontSize: 11,
    fontWeight: "600",
  },
  mentalProgramDetailCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D7F3",
    backgroundColor: "#FFFFFFF2",
    padding: 12,
    gap: 4,
  },
  mentalProgramTitle: {
    color: "#2F2436",
    fontSize: 17,
    fontWeight: "800",
  },
  mentalProgramSubtitle: {
    color: "#6D5E76",
    fontSize: 13,
    fontWeight: "600",
  },
  mentalProgramDescription: {
    color: "#786A81",
    fontSize: 13,
    lineHeight: 18,
  },
  mentalProgramRoutineText: {
    color: "#7E63B2",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  mentalSessionChipRow: {
    gap: 8,
    paddingRight: 6,
  },
  mentalSessionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDCFEF",
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mentalSessionChipActive: {
    backgroundColor: "#EBDDFF",
    borderColor: "#A887D9",
  },
  mentalSessionChipText: {
    color: "#6A5B73",
    fontSize: 12,
    fontWeight: "700",
  },
  mentalSessionChipTextActive: {
    color: "#5E3D95",
  },
  mentalSessionDetailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4D8F2",
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 6,
  },
  mentalSessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mentalSessionTitle: {
    flex: 1,
    color: "#352A3D",
    fontSize: 15,
    fontWeight: "700",
  },
  mentalSessionMetaText: {
    color: "#7E63B2",
    fontSize: 12,
    fontWeight: "700",
  },
  mentalSessionPromptText: {
    color: "#6F6278",
    fontSize: 13,
    lineHeight: 18,
  },
  mentalSessionStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  mentalSessionStepBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: "#8F72C5",
  },
  mentalSessionStepText: {
    flex: 1,
    color: "#4D4255",
    fontSize: 13,
    lineHeight: 18,
  },
  mentalRatingLabel: {
    color: "#4C3D54",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  mentalRatingRow: {
    flexDirection: "row",
    gap: 8,
  },
  mentalRatingChip: {
    width: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E1D4EE",
    backgroundColor: "#FFFFFFEE",
    alignItems: "center",
    paddingVertical: 7,
    gap: 2,
  },
  mentalRatingChipActive: {
    borderColor: "#8F72C5",
    backgroundColor: "#F1E7FF",
  },
  mentalRatingEmoji: {
    fontSize: 16,
  },
  mentalRatingValue: {
    color: "#71637A",
    fontSize: 12,
    fontWeight: "700",
  },
  mentalRatingValueActive: {
    color: "#5D4193",
  },
  mentalJournalInput: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E1D4EE",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#32253B",
    fontSize: 13,
    lineHeight: 18,
  },
  mentalSaveButton: {
    marginTop: 2,
    borderRadius: 14,
    backgroundColor: "#8F72C5",
    paddingVertical: 13,
    alignItems: "center",
  },
  mentalSaveButtonDisabled: {
    backgroundColor: "#C8B7E0",
  },
  mentalSaveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 28,
    color: "#17111E",
    fontWeight: "800",
    marginBottom: 4,
  },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFEE",
    padding: 16,
    gap: 6,
  },
  infoLabel: {
    color: "#8A7C8D",
    fontSize: 14,
    fontWeight: "600",
  },
  infoValue: {
    color: "#392E40",
    fontSize: 19,
    fontWeight: "700",
  },
  infoFootnote: {
    color: "#7B6E80",
    fontSize: 13,
  },
  reminderSettingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFEE",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomNavBar: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFFF0",
    borderWidth: 1,
    borderColor: "#E4D8E8",
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  navIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  navIconWrapActive: {
    backgroundColor: "#8F72C5",
  },
  navText: {
    fontSize: 12,
    color: "#6E6074",
    fontWeight: "600",
  },
  navTextActive: {
    color: "#614694",
    fontWeight: "700",
  },
  proSuccessOverlay: {
    flex: 1,
    backgroundColor: "rgba(18, 10, 26, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  proSuccessCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DDEB",
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 10,
  },
  proSuccessIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#8F72C5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  proSuccessTitle: {
    color: "#2F2436",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  proSuccessText: {
    color: "#64576B",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  proSuccessButton: {
    marginTop: 6,
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#8F72C5",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  proSuccessButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  languageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  languageModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    maxWidth: 320,
  },
  languageModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4B3E53",
    marginBottom: 16,
    textAlign: "center",
  },
  languageOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EAF4",
  },
  languageOptionText: {
    fontSize: 16,
    color: "#4B3E53",
  },
  languageOptionTextActive: {
    color: "#8F72C5",
    fontWeight: "700",
  },
  languageCancelButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 10,
  },
  languageCancelText: {
    fontSize: 15,
    color: "#85788A",
    fontWeight: "600",
  },
  subscriptionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  subscriptionModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 10,
  },
  subscriptionModalTitle: {
    color: "#2F2436",
    fontSize: 20,
    fontWeight: "800",
  },
  subscriptionModalSubtitle: {
    color: "#7D6F81",
    fontSize: 13,
    marginBottom: 4,
  },
  subscriptionPlanButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5D9E8",
    backgroundColor: "#FAF7FC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subscriptionPlanButtonDisabled: {
    opacity: 0.5,
  },
  subscriptionPlanTitle: {
    color: "#3F3346",
    fontSize: 14,
    fontWeight: "700",
  },
  subscriptionPlanPrice: {
    color: "#877A8A",
    fontSize: 12,
    marginTop: 2,
  },
  subscriptionActionButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DED1E3",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  subscriptionActionButtonText: {
    color: "#5D4193",
    fontSize: 13,
    fontWeight: "700",
  },
  subscriptionCloseButton: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: "#8F72C5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  subscriptionCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
