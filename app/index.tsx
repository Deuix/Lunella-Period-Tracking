import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { getDateLocale, persistLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";

type GoalOption = "cycle_tracking" | "trying_to_conceive" | "pregnancy_tracking";
type HomeTab = "home" | "insights" | "ai" | "tips" | "profile";
type DayCategory = "period" | "ovulation" | "fertility" | "normal";
type BreathPhase = "ready" | "inhale" | "hold" | "exhale" | "done";
type ProfileView = "main" | "settings";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
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

const BREATHING_TOTAL_ROUNDS = 4;
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

function buildAiAssistantReply(
  question: string,
  context: CycleContext,
  cycleLength: number,
  periodLength: number,
  goals: GoalOption[],
  t: (key: string, opts?: Record<string, unknown>) => string,
  dateLocale: string,
): string {
  const prompt = question.toLowerCase();
  const nextPeriodDate = context.nextPeriodStart.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  });
  const ovulationDate = context.nextOvulationDate.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  });
  const fertilityWindow = `${context.fertilityStartDate.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  })} - ${context.fertilityEndDate.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  })}`;

  if (prompt.includes("ovulation")) {
    return t("ai.replyOvulation", { ovulationDate, fertilityWindow });
  }

  if (prompt.includes("fertility") || prompt.includes("conceive")) {
    return t("ai.replyFertility", { fertilityWindow });
  }

  if (prompt.includes("period") || prompt.includes("late")) {
    return t("ai.replyPeriod", { cycleLength, nextPeriodDate, daysLeft: context.daysUntilNextPeriod });
  }

  if (prompt.includes("cramp") || prompt.includes("pain") || prompt.includes("tea")) {
    return t("ai.replyCramp");
  }

  if (prompt.includes("mood") || prompt.includes("stress") || prompt.includes("anxious")) {
    return t("ai.replyMood");
  }

  if (prompt.includes("summary") || prompt.includes("plan")) {
    const goalLine = goals.length > 0
      ? goals.map((g) => {
          const found = GOAL_OPTIONS.find((o) => o.id === g);
          return found ? t(found.labelKey) : g;
        }).join(", ")
      : t("ai.generalCycleTracking");
    return t("ai.replySummary", { cycleLength, periodLength, nextPeriodDate, ovulationDate, fertilityWindow, goals: goalLine });
  }

  return t("ai.replyDefault", { nextPeriodDate, ovulationDate, fertilityWindow });
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

  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [isOnboardingDone, setIsOnboardingDone] = useState(false);

  const [name, setName] = useState("");
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
  const [aiInput, setAiInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "",
    },
  ]);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

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
  const aiTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiMessagesScrollRef = useRef<ScrollView | null>(null);

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

      if (aiTypingTimeoutRef.current) {
        clearTimeout(aiTypingTimeoutRef.current);
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
  }, [breathingScale, breathingStepIndex]);

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
    if (activeTab === "ai") {
      return;
    }

    if (aiTypingTimeoutRef.current) {
      clearTimeout(aiTypingTimeoutRef.current);
      aiTypingTimeoutRef.current = null;
      setIsAiTyping(false);
    }
  }, [activeTab]);

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

  const breathingStatusText =
    breathingPhase === "done"
      ? t("breathing.completedRounds", { count: BREATHING_TOTAL_ROUNDS })
      : isBreathingRunning
        ? t("breathing.statusRunning", { label: activeBreathingStep?.labelKey ? t(activeBreathingStep.labelKey) : t("breathing.breathe"), seconds: breathingSecondsLeft })
        : t("breathing.ready");

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

  const handlePeriodStartsToday = () => {
    const today = startOfDay(new Date());
    setLastPeriodDate(today);
    setSelectedCalendarDate(today);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSetAsPeriodStart = (date: Date) => {
    setLastPeriodDate(startOfDay(date));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const sendAiMessage = (messageText: string) => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isAiTyping) {
      return;
    }

    const userMessage: AiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedMessage,
    };

    setAiMessages((currentMessages) => [...currentMessages, userMessage]);
    setAiInput("");
    setIsAiTyping(true);

    if (aiTypingTimeoutRef.current) {
      clearTimeout(aiTypingTimeoutRef.current);
    }

    aiTypingTimeoutRef.current = setTimeout(() => {
      const responseText = buildAiAssistantReply(
        trimmedMessage,
        cycleContext,
        cycleLength,
        periodLength,
        goals,
        t,
        dateLocale,
      );

      const assistantMessage: AiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: responseText,
      };

      setAiMessages((currentMessages) => [...currentMessages, assistantMessage]);
      setIsAiTyping(false);
      aiTypingTimeoutRef.current = null;
    }, 850);
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
          <TouchableOpacity style={styles.profileAvatar} onPress={() => setActiveTab("profile")}>
            <Text style={styles.profileAvatarText}>{(name.trim()[0] ?? "U").toUpperCase()}</Text>
          </TouchableOpacity>
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

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t("tips.sectionTitle")}</Text>

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
        </View>

        <View style={styles.tipsSectionWrap}>
          <Text style={styles.tipsSectionTitle}>{t("tips.helpfulTips")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipsCarouselRow}>
            {GIRL_TIPS.map((tip) => (
              <View key={tip.titleKey} style={styles.tipCard}>
                <Text style={styles.tipTitle}>{t(tip.titleKey)}</Text>
                <Text style={styles.tipDetail}>{t(tip.detailKey)}</Text>
              </View>
            ))}
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

        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>{t("insights.cycleOverview", { year: new Date().getFullYear() })}</Text>
          <Text style={styles.infoFootnote}>{t("insights.overviewFootnote")}</Text>

          <View style={styles.historyList}>
            {monthlyInsights
              .slice()
              .reverse()
              .map((insight) => (
                <View key={`history-${insight.monthDate.toISOString()}`} style={styles.historyRow}>
                  <Text style={styles.historyMonthLabel}>
                    {insight.monthDate.toLocaleDateString(dateLocale, { month: "short", year: "numeric" })}
                  </Text>
                  <Text style={styles.historyRowText}>P: {insight.periodDays}</Text>
                  <Text style={styles.historyRowText}>O: {insight.ovulationDays}</Text>
                  <Text style={styles.historyRowText}>F: {insight.fertilityDays}</Text>
                </View>
              ))}
          </View>

          <View style={styles.trendChartWrap}>
            {cycleOverviewRows.map((row) => (
              <View key={`trend-${row.label}`} style={styles.trendRow}>
                <Text style={styles.trendMonthLabel}>{row.label}</Text>
                <View style={styles.trendTrack}>
                  <View style={[styles.trendFill, { width: `${row.value}%` }]} />
                </View>
                <Text style={styles.trendValueLabel}>{row.display}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderAiTab = () => {
    return (
      <View style={styles.aiPageWrap}>
        <LinearGradient
          colors={["#F4EDFC", "#FCEEF5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiHeroCard}>
          <View>
            <Text style={styles.aiHeroTitle}>{t("ai.heroTitle")}</Text>
            <Text style={styles.aiHeroSubtitle}>{t("ai.heroSubtitle")}</Text>
          </View>
          <View style={styles.aiStatusChip}>
            <MaterialCommunityIcons name="brain" size={15} color="#5D4193" />
            <Text style={styles.aiStatusChipText}>{t("ai.statusChip")}</Text>
          </View>
        </LinearGradient>

        <ScrollView
          horizontal
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
              <Text
                style={[
                  styles.aiBubbleText,
                  message.role === "assistant" ? styles.aiAssistantBubbleText : styles.aiUserBubbleText,
                ]}>
                {message.id === "assistant-welcome" ? t("ai.welcomeMessage") : message.text}
              </Text>
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
            onSubmitEditing={() => sendAiMessage(aiInput)}
          />

          <TouchableOpacity
            style={[styles.aiSendButton, (!aiInput.trim() || isAiTyping) && styles.aiSendButtonDisabled]}
            onPress={() => sendAiMessage(aiInput)}
            disabled={!aiInput.trim() || isAiTyping}>
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
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
                onValueChange={setPinLockEnabled}
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
                onValueChange={setHealthSyncEnabled}
                trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>{t("settings.general")}</Text>

            <TouchableOpacity style={styles.settingsNavRow} onPress={() => setLanguagePickerVisible(true)}>
              <Text style={styles.settingsRowTitle}>{t("settings.language")}</Text>
              <View style={styles.settingsNavRight}>
                <Text style={styles.settingsNavValue}>{SUPPORTED_LANGUAGES[i18n.language] ?? "English"}</Text>
                <Ionicons name="chevron-forward" size={16} color="#85788A" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsNavRow}>
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
            </View>
          </View>

          <TouchableOpacity style={styles.profileSettingsIconButton} onPress={() => setProfileView("settings")}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF9FC",
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFEE",
    padding: 16,
    gap: 12,
  },
  overviewTitle: {
    color: "#2F2436",
    fontSize: 24,
    fontWeight: "800",
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE4EF",
    backgroundColor: "#FDF8FD",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyMonthLabel: {
    color: "#3D3243",
    fontSize: 13,
    fontWeight: "700",
  },
  historyRowText: {
    color: "#6B5F70",
    fontSize: 12,
    fontWeight: "600",
  },
  trendChartWrap: {
    gap: 8,
    marginTop: 2,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendMonthLabel: {
    width: 34,
    color: "#6E6074",
    fontSize: 12,
    fontWeight: "700",
  },
  trendTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EFE5F0",
  },
  trendFill: {
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E69BBB",
  },
  trendValueLabel: {
    width: 84,
    color: "#7A6D7F",
    fontSize: 11,
    textAlign: "right",
    fontWeight: "600",
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
  aiPromptRow: {
    gap: 8,
    paddingRight: 4,
  },
  aiPromptChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDCFE3",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  },
  aiAssistantBubbleText: {
    color: "#3A2E40",
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
});
