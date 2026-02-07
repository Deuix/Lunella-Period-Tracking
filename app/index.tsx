import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
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

type GoalOption = "Cycle Tracking" | "Trying To Conceive" | "Pregnancy Tracking";
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
  label: string;
};

type MenstrualFlowOption = {
  label: "Light" | "Medium" | "Heavy";
  drops: number;
};

type GirlTip = {
  title: string;
  detail: string;
};

type BreathStep = {
  phase: Exclude<BreathPhase, "ready" | "done">;
  label: string;
  seconds: number;
  targetScale: number;
  guidance: string;
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
const GOAL_OPTIONS: GoalOption[] = [
  "Cycle Tracking",
  "Trying To Conceive",
  "Pregnancy Tracking",
];
const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const NAV_ITEMS: { key: HomeTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "insights", label: "Insights", icon: "bar-chart" },
  { key: "ai", label: "AI", icon: "sparkles" },
  { key: "tips", label: "Tips", icon: "bulb" },
  { key: "profile", label: "Profile", icon: "person" },
];

const MOOD_OPTIONS: MoodOption[] = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😌", label: "Calm" },
  { emoji: "🥰", label: "Loved" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😣", label: "Cramps" },
  { emoji: "😕", label: "Low" },
  { emoji: "😤", label: "Stressed" },
  { emoji: "🤕", label: "Headache" },
];

const MENSTRUAL_FLOW_OPTIONS: MenstrualFlowOption[] = [
  { label: "Light", drops: 1 },
  { label: "Medium", drops: 1 },
  { label: "Heavy", drops: 2 },
];

const GIRL_TIPS: GirlTip[] = [
  {
    title: "Warm ginger tea",
    detail: "Drink ginger tea for cramps and bloating support.",
  },
  {
    title: "Chamomile at night",
    detail: "A calming tea can improve sleep before your period.",
  },
  {
    title: "Hydration check",
    detail: "Add one extra glass of water to reduce fatigue.",
  },
  {
    title: "Iron-rich snack",
    detail: "Try dates, pumpkin seeds, or spinach with lemon.",
  },
  {
    title: "Gentle movement",
    detail: "A 15-minute walk can ease mood swings and tension.",
  },
];

const BREATHING_TOTAL_ROUNDS = 4;
const BREATHING_STEPS: BreathStep[] = [
  {
    phase: "inhale",
    label: "Inhale",
    seconds: 4,
    targetScale: 1.2,
    guidance: "Breathe in slowly through your nose.",
  },
  {
    phase: "hold",
    label: "Hold",
    seconds: 3,
    targetScale: 1.2,
    guidance: "Hold gently and relax your shoulders.",
  },
  {
    phase: "exhale",
    label: "Exhale",
    seconds: 6,
    targetScale: 1,
    guidance: "Breathe out softly through your mouth.",
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

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }

  const mod10 = value % 10;
  if (mod10 === 1) {
    return `${value}st`;
  }
  if (mod10 === 2) {
    return `${value}nd`;
  }
  if (mod10 === 3) {
    return `${value}rd`;
  }
  return `${value}th`;
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
): PregnancyProbabilityDetail {
  const timing = getCycleTimingForDate(targetDate, lastPeriodStart, cycleLength);
  const category = getDayCategory(targetDate, lastPeriodStart, cycleLength, periodLength);
  const isTryingToConceive = goals.includes("Trying To Conceive");

  let level: PregnancyProbabilityDetail["level"] = "Low";
  let chanceRangeLabel = "5-10%";
  let summary = "Outside your fertile window, conception probability is usually lower.";
  let recommendation = "Use this day for hydration, symptom logging, and cycle planning.";

  if (category === "period") {
    level = "Low";
    chanceRangeLabel = "1-5%";
    summary = "During period days, pregnancy probability is generally very low.";
    recommendation = "Focus on comfort care and track flow to improve prediction accuracy.";
  } else if (Math.abs(timing.daysFromOvulation) <= 1) {
    level = "High";
    chanceRangeLabel = "30-40%";
    summary = "This day is very close to ovulation, so probability is highest.";
    recommendation = isTryingToConceive
      ? "If trying to conceive, this is one of your best timing days."
      : "Use protection if you want to avoid pregnancy today.";
  } else if (timing.daysFromOvulation >= -5 && timing.daysFromOvulation <= 2) {
    level = "Medium";
    chanceRangeLabel = "12-25%";
    summary = "You are within the fertile window, with moderate pregnancy probability.";
    recommendation = isTryingToConceive
      ? "Plan intercourse around this window and keep lifestyle habits consistent."
      : "Consider backup protection during fertile-window days.";
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

  const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long" });
  const periodRangeLabel =
    firstPeriodDay !== null && lastPeriodDay !== null
      ? `${monthLabel} ${firstPeriodDay}-${lastPeriodDay}`
      : "No predicted period days";

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
): string {
  const prompt = question.toLowerCase();
  const nextPeriodDate = context.nextPeriodStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const ovulationDate = context.nextOvulationDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const fertilityWindow = `${context.fertilityStartDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${context.fertilityEndDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;

  if (prompt.includes("ovulation")) {
    return `Your next predicted ovulation is on ${ovulationDate}. The fertile window is ${fertilityWindow}. Try symptom logging each morning for better timing.`;
  }

  if (prompt.includes("fertility") || prompt.includes("conceive")) {
    return `Your predicted fertility window is ${fertilityWindow}. For trying to conceive, focus on sleep, hydration, and symptom notes during this phase.`;
  }

  if (prompt.includes("period") || prompt.includes("late")) {
    return `Based on your ${cycleLength}-day cycle, your next period is expected around ${nextPeriodDate} (${context.daysUntilNextPeriod} days left). If your pattern changes for 2-3 cycles, update your cycle length in profile.`;
  }

  if (prompt.includes("cramp") || prompt.includes("pain") || prompt.includes("tea")) {
    return "For cramp days: warm ginger tea, gentle stretching, magnesium-rich foods, and hydration can help. If pain is severe or disruptive, reach out to a clinician.";
  }

  if (prompt.includes("mood") || prompt.includes("stress") || prompt.includes("anxious")) {
    return "Try the breathing exercise in Tips for 4 rounds, then do a 10-minute walk. Mood shifts are common around cycle changes; sleep and hydration make a big difference.";
  }

  if (prompt.includes("summary") || prompt.includes("plan")) {
    const goalLine = goals.length > 0 ? goals.join(", ") : "general cycle tracking";
    return `Quick plan: cycle length ${cycleLength} days, period length ${periodLength} days, next period ${nextPeriodDate}, ovulation ${ovulationDate}, fertility window ${fertilityWindow}. Your selected goals: ${goalLine}.`;
  }

  return `Here is your current cycle snapshot: next period ${nextPeriodDate}, ovulation ${ovulationDate}, fertility window ${fertilityWindow}. Ask me about period timing, symptoms, food tips, or fertility guidance.`;
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
      <View style={styles.phoneMockup}>
        <View style={styles.phoneNotch} />
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={30} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.personWrap}>
        <MaterialCommunityIcons name="human-female" size={122} color="#30345A" />
      </View>
      <View style={styles.illustrationGround} />
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
  const [selectedFlow, setSelectedFlow] = useState<MenstrualFlowOption["label"]>("Medium");
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
      text: "Hi! I am your cycle AI assistant. Ask me about your next period, ovulation, fertility window, or symptom care.",
    },
  ]);

  const monthOptions = useMemo(() => {
    const base = startOfMonth(new Date());
    return Array.from({ length: 12 }, (_, index) => addMonths(base, index - 2));
  }, []);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(2);
  const [selectedInsightsMonthIndex, setSelectedInsightsMonthIndex] = useState(2);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(startOfDay(new Date()));

  const onboardingAnimation = useRef(new Animated.Value(1)).current;
  const breathingScale = useRef(new Animated.Value(1)).current;
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

      Animated.timing(breathingScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      return;
    }

    const step = BREATHING_STEPS[breathingStepIndex % BREATHING_STEPS.length];
    const currentRound = Math.floor(breathingStepIndex / BREATHING_STEPS.length) + 1;

    setBreathingRound(currentRound);
    setBreathingPhase(step.phase);
    setBreathingSecondsLeft(step.seconds);

    Animated.timing(breathingScale, {
      toValue: step.targetScale,
      duration: step.seconds * 1000,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    }).start();

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
      onboardingMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [onboardingMonth],
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
      activeMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [activeMonth],
  );

  const activeInsightsMonth = monthOptions[selectedInsightsMonthIndex] ?? monthOptions[2];
  const insightsMonthLabel = useMemo(
    () =>
      activeInsightsMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [activeInsightsMonth],
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
      buildMonthlyInsight(monthDate, lastPeriodDate, cycleLength, periodLength),
    );
  }, [recentInsightMonths, lastPeriodDate, cycleLength, periodLength]);

  const currentMonthInsight = monthlyInsights[monthlyInsights.length - 1];

  const cycleOverviewRows = useMemo(() => {
    return monthlyInsights.map((insight) => {
      const trendValue = Math.max(20, Math.min(95, insight.periodDays * 6 + insight.fertilityDays * 4));
      return {
        label: insight.monthDate.toLocaleDateString("en-US", { month: "short" }),
        value: trendValue,
        display: `${insight.periodDays + insight.fertilityDays} active days`,
      };
    });
  }, [monthlyInsights]);

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
      ),
    [selectedCalendarDate, lastPeriodDate, cycleLength, periodLength, goals],
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
    step === 0 ? "get started" : step === 4 ? "Finish onboarding" : "Continue";

  const welcomeMetric = cycleContext.isPeriodDay
    ? `${ordinal(cycleContext.periodDayNumber)} day of period`
    : `${cycleContext.daysUntilNextPeriod} days until next period`;

  const ovulationMetric =
    cycleContext.daysUntilOvulation === 0
      ? "Ovulation day is today"
      : `${cycleContext.daysUntilOvulation} days until next ovulation`;

  const fertilityMetric = cycleContext.isFertilityWindow
    ? `${cycleContext.fertilityDaysLeft} days left in fertility window`
    : `${Math.max(0, cycleContext.daysUntilFertilityStart)} days until fertility window`;

  const insightCards = [
    {
      title: welcomeMetric,
      subtitle: cycleContext.isPeriodDay ? "Keep logging symptoms and flow." : "Prediction based on your cycle settings.",
    },
    {
      title: ovulationMetric,
      subtitle: `Expected on ${cycleContext.nextOvulationDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`,
    },
    {
      title: fertilityMetric,
      subtitle: `${cycleContext.fertilityStartDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${cycleContext.fertilityEndDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`,
    },
  ];

  const isBreathingRunning = breathingStepIndex !== null;
  const activeBreathingStep =
    breathingPhase === "inhale" || breathingPhase === "hold" || breathingPhase === "exhale"
      ? BREATHING_STEPS.find((step) => step.phase === breathingPhase)
      : null;

  const breathingGuideText =
    breathingPhase === "done"
      ? "Great job. You finished the breathing exercise."
      : activeBreathingStep?.guidance ?? "Tap start to begin a guided breathing exercise.";

  const breathingStatusText =
    breathingPhase === "done"
      ? `Completed ${BREATHING_TOTAL_ROUNDS} rounds`
      : isBreathingRunning
        ? `${activeBreathingStep?.label ?? "Breathe"} · ${breathingSecondsLeft}s left`
        : "Ready";

  const breathingRoundText =
    breathingRound > 0
      ? `Round ${breathingRound}/${BREATHING_TOTAL_ROUNDS}`
      : `Round 0/${BREATHING_TOTAL_ROUNDS}`;

  const aiQuickPrompts = [
    "Give me my cycle summary",
    "When is my next ovulation?",
    "How can I reduce period cramps?",
    "Best habits before fertility window",
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

  const toggleGoal = (goal: GoalOption) => {
    setGoals((currentGoals) => {
      if (currentGoals.includes(goal)) {
        return currentGoals.filter((currentGoal) => currentGoal !== goal);
      }
      return [...currentGoals, goal];
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
            <Text style={styles.welcomeTitle}>Welcome to My cycle calendar</Text>
            <Text style={styles.welcomeSubtitle}>You&apos;re ready to track your journey.</Text>
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.contentBlock}>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.descriptionLeft}>Your name helps us make the experience personal.</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#9F95A4"
          />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.contentBlock}>
          <Text style={styles.title}>What is your goal?</Text>
          <Text style={styles.descriptionLeft}>Choose what fits your journey best.</Text>
          <Text style={styles.descriptionMuted}>Select all that apply.</Text>
          <View style={styles.optionList}>
            {GOAL_OPTIONS.map((goalOption) => {
              const isSelected = goals.includes(goalOption);

              return (
                <Pressable
                  key={goalOption}
                  style={[styles.optionButton, isSelected && styles.optionButtonActive]}
                  onPress={() => toggleGoal(goalOption)}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>{goalOption}</Text>
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
          <Text style={styles.title}>Confirm your last period date</Text>
          <Text style={styles.descriptionLeft}>Tap a date in the calendar below.</Text>

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
            {WEEK_DAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekDayText}>
                {day}
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
            Last period date: {lastPeriodDate.toLocaleDateString("en-US")}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.contentBlock}>
        <Text style={styles.title}>Lets create perfect experience for you.</Text>
        <Text style={styles.descriptionLeft}>Add your cycle details for accurate predictions and reminders.</Text>

        <NumberAdjuster
          label="Cycle length"
          hint="Average number of days between periods"
          value={cycleLength}
          min={21}
          max={40}
          onChange={setCycleLength}
        />

        <NumberAdjuster
          label="Period length"
          hint="How many days your period usually lasts"
          value={periodLength}
          min={3}
          max={10}
          onChange={setPeriodLength}
        />

        <View style={styles.reminderRow}>
          <View>
            <Text style={styles.adjusterLabel}>Reminder alerts</Text>
            <Text style={styles.adjusterHint}>Period, fertility, and ovulation reminders</Text>
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
    const selectedDateLabel = selectedCalendarDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return (
      <View style={styles.probabilityCard}>
        <View style={styles.probabilityHeaderRow}>
          <View>
            <Text style={styles.probabilityTitle}>Pregnancy Probability</Text>
            <Text style={styles.probabilityDateLabel}>{selectedDateLabel}</Text>
          </View>
          <View style={[styles.probabilityBadge, selectedDateLevelStyle]}>
            <Text style={styles.probabilityBadgeText}>
              {selectedDatePregnancyDetail.level} ({selectedDatePregnancyDetail.chanceRangeLabel})
            </Text>
          </View>
        </View>

        <Text style={styles.probabilitySummary}>{selectedDatePregnancyDetail.summary}</Text>

        <View style={styles.probabilityMetaRow}>
          <Text style={styles.probabilityMetaText}>Cycle day {selectedDatePregnancyDetail.cycleDayNumber}</Text>
          <Text style={styles.probabilityMetaText}>
            Ovulation {selectedDatePregnancyDetail.ovulationDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>

        <Text style={styles.probabilityWindowText}>
          Fertility window: {selectedDatePregnancyDetail.fertilityStartDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })} - {selectedDatePregnancyDetail.fertilityEndDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </Text>

        <Text style={styles.probabilityRecommendation}>{selectedDatePregnancyDetail.recommendation}</Text>
      </View>
    );
  };

  const renderHomeTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.homeHeader}>
          <View>
            <Text style={styles.headerTitle}>My cycle calendar</Text>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString("en-US", {
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

        <View style={styles.highlightCapsule}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightRow}>
            {insightCards.map((card) => (
              <View key={card.title} style={styles.insightCard}>
                <Text style={styles.insightTitle}>{card.title}</Text>
                <Text style={styles.insightSubtitle}>{card.subtitle}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

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
                  {monthOption.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.calendarCard}>
          <Text style={styles.calendarCardTitle}>{monthLabel}</Text>

          <View style={styles.weekHeader}>
            {WEEK_DAYS.map((day, index) => (
              <Text key={`${day}-home-${index}`} style={styles.weekDayText}>
                {day}
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
              <Text style={styles.legendText}>Period</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#BFDDFE" }]} />
              <Text style={styles.legendText}>Ovulation</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#CDEFD9" }]} />
              <Text style={styles.legendText}>Fertility</Text>
            </View>
          </View>

          <Text style={styles.calendarHintText}>Tap any day to view pregnancy chance details.</Text>
          {renderPregnancyProbabilityCard()}
        </View>
      </ScrollView>
    );
  };

  const renderTipsTab = () => {
    const feelingName = name.trim() || "Gul";

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Tips</Text>

        <View style={styles.infoCard}>
          <View style={styles.flowCard}>
            <Text style={styles.flowCardTitle}>Menstrual Flow</Text>

            <View style={styles.flowTabRow}>
              {MENSTRUAL_FLOW_OPTIONS.map((flowOption) => {
                const isSelected = selectedFlow === flowOption.label;

                return (
                  <Pressable
                    key={flowOption.label}
                    style={[styles.flowTab, isSelected && styles.flowTabActive]}
                    onPress={() => setSelectedFlow(flowOption.label)}>
                    <View style={styles.flowDropRow}>
                      {Array.from({ length: flowOption.drops }).map((_, index) => (
                        <MaterialCommunityIcons
                          key={`${flowOption.label}-${index}`}
                          name="water"
                          size={16}
                          color={isSelected ? "#FFFFFF" : "#8F72C5"}
                        />
                      ))}
                    </View>
                    <Text style={[styles.flowLabel, isSelected && styles.flowLabelActive]}>
                      {flowOption.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.tipsQuestion}>{`${feelingName} how do you feel today`}</Text>
          <Text style={styles.infoFootnote}>Pick as many moods as match your day.</Text>

          <View style={styles.moodGrid}>
            {MOOD_OPTIONS.map((moodOption) => {
              const isSelected = selectedMoods.includes(moodOption.label);
              return (
                <Pressable
                  key={moodOption.label}
                  style={[styles.moodChip, isSelected && styles.moodChipActive]}
                  onPress={() => toggleMood(moodOption.label)}>
                  <Text style={styles.moodEmoji}>{moodOption.emoji}</Text>
                  <Text style={[styles.moodLabel, isSelected && styles.moodLabelActive]}>
                    {moodOption.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.tipsSectionWrap}>
          <Text style={styles.tipsSectionTitle}>Helpful tips for girls</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipsCarouselRow}>
            {GIRL_TIPS.map((tip) => (
              <View key={tip.title} style={styles.tipCard}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDetail}>{tip.detail}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.breathingCard}>
          <Text style={styles.tipsSectionTitle}>Breathing meditation</Text>
          <Text style={styles.breathingGuideText}>{breathingGuideText}</Text>

          <View style={styles.breathingStatusRow}>
            <Text style={styles.breathingStatusText}>{breathingRoundText}</Text>
            <Text style={styles.breathingStatusText}>{breathingStatusText}</Text>
          </View>

          <View style={styles.breathingSignWrap}>
            <Animated.View style={[styles.breathingSign, { transform: [{ scale: breathingScale }] }]}>
              <MaterialCommunityIcons name="flower" size={42} color="#8F72C5" />
            </Animated.View>
          </View>

          <TouchableOpacity
            style={[styles.breathingActionButton, isBreathingRunning && styles.breathingActionButtonStop]}
            onPress={isBreathingRunning ? () => stopBreathingSession("ready") : startBreathingSession}>
            <Text style={styles.breathingActionButtonText}>
              {isBreathingRunning
                ? "Stop exercise"
                : breathingPhase === "done"
                  ? "Start again"
                  : "Start breathing"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderInsightsTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Cycle Statistics</Text>
        <Text style={styles.infoFootnote}>Track your patterns and insights.</Text>

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
                    {monthOption.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.weekHeader}>
            {WEEK_DAYS.map((day, index) => (
              <Text key={`${day}-insights-${index}`} style={styles.weekDayText}>
                {day}
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
              <Text style={styles.legendText}>Period</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#BFDDFE" }]} />
              <Text style={styles.legendText}>Ovulation</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#CDEFD9" }]} />
              <Text style={styles.legendText}>Fertility</Text>
            </View>
          </View>

          <Text style={styles.calendarHintText}>Tap any day to view pregnancy chance details.</Text>
          {renderPregnancyProbabilityCard()}
        </View>

        <Text style={styles.insightSectionTitle}>
          {currentMonthInsight?.monthLabel ?? "This month"} statistics
        </Text>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPink]}>
            <Text style={styles.statTitle}>Cycle Length</Text>
            <Text style={styles.statValue}>{cycleLength} days</Text>
            <Text style={styles.statSubtext}>This month</Text>
          </View>

          <View style={[styles.statCard, styles.statCardLavender]}>
            <Text style={styles.statTitle}>Period Duration</Text>
            <Text style={styles.statValue}>{periodLength} days</Text>
            <Text style={styles.statSubtext}>{currentMonthInsight?.periodRangeLabel ?? "No range"}</Text>
          </View>

          <View style={[styles.statCard, styles.statCardPeach]}>
            <Text style={styles.statTitle}>Ovulation Day</Text>
            <Text style={styles.statValue}>
              {currentMonthInsight?.ovulationDayOfMonth
                ? `Day ${currentMonthInsight.ovulationDayOfMonth}`
                : "Not in month"}
            </Text>
            <Text style={styles.statSubtext}>{currentMonthInsight?.monthLabel ?? "Current month"}</Text>
          </View>

          <View style={[styles.statCard, styles.statCardMint]}>
            <Text style={styles.statTitle}>Avg Symptoms</Text>
            <Text style={styles.statValue}>{averageSymptomScore}</Text>
            <Text style={styles.statSubtext}>Predicted monthly score</Text>
          </View>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>{new Date().getFullYear()} Cycle Overview</Text>
          <Text style={styles.infoFootnote}>History of period, ovulation, and fertility-window days.</Text>

          <View style={styles.historyList}>
            {monthlyInsights
              .slice()
              .reverse()
              .map((insight) => (
                <View key={`history-${insight.monthDate.toISOString()}`} style={styles.historyRow}>
                  <Text style={styles.historyMonthLabel}>
                    {insight.monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
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
            <Text style={styles.aiHeroTitle}>AI Cycle Assistant</Text>
            <Text style={styles.aiHeroSubtitle}>Personalized support for timing, symptoms, and daily guidance.</Text>
          </View>
          <View style={styles.aiStatusChip}>
            <MaterialCommunityIcons name="brain" size={15} color="#5D4193" />
            <Text style={styles.aiStatusChipText}>OpenRouter-ready</Text>
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
                {message.text}
              </Text>
            </View>
          ))}

          {isAiTyping && (
            <View style={[styles.aiBubble, styles.aiAssistantBubble, styles.aiTypingBubble]}>
              <Text style={styles.aiAssistantBubbleText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.aiComposerWrap}>
          <TextInput
            value={aiInput}
            onChangeText={setAiInput}
            placeholder="Ask anything about your cycle"
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
    const profileGoals = goals.length > 0 ? goals.join(", ") : "Cycle Tracking";

    if (profileView === "settings") {
      return (
        <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsHeaderRow}>
            <TouchableOpacity style={styles.settingsBackButton} onPress={() => setProfileView("main")}>
              <Ionicons name="chevron-back" size={20} color="#4B3E53" />
            </TouchableOpacity>
            <Text style={styles.settingsHeaderTitle}>Settings</Text>
            <View style={styles.settingsHeaderSpacer} />
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>Notifications</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>Cycle reminders</Text>
                <Text style={styles.settingsRowSubtitle}>Period, ovulation, fertility notifications</Text>
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
                <Text style={styles.settingsRowTitle}>Insight nudges</Text>
                <Text style={styles.settingsRowSubtitle}>Daily tips and mood check-in prompts</Text>
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
            <Text style={styles.settingsSectionTitle}>Privacy & Security</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>App passcode lock</Text>
                <Text style={styles.settingsRowSubtitle}>Protect private cycle information</Text>
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
            <Text style={styles.settingsSectionTitle}>Integrations</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>Health sync</Text>
                <Text style={styles.settingsRowSubtitle}>Sync cycle data with health apps</Text>
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
            <Text style={styles.settingsSectionTitle}>General</Text>

            <TouchableOpacity style={styles.settingsNavRow}>
              <Text style={styles.settingsRowTitle}>Language</Text>
              <View style={styles.settingsNavRight}>
                <Text style={styles.settingsNavValue}>English</Text>
                <Ionicons name="chevron-forward" size={16} color="#85788A" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsNavRow}>
              <Text style={styles.settingsRowTitle}>Export cycle data</Text>
              <Ionicons name="chevron-forward" size={16} color="#85788A" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsNavRow}>
              <Text style={styles.settingsRowTitle}>Help & support</Text>
              <Ionicons name="chevron-forward" size={16} color="#85788A" />
            </TouchableOpacity>
          </View>
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
          <Text style={styles.profileHeroTitle}>Your cycle profile is up to date</Text>
          <Text style={styles.profileHeroSubtitle}>
            Keep your settings accurate to improve predictions and insights.
          </Text>
        </View>

        <View style={styles.profileStatsGrid}>
          <View style={[styles.profileStatCard, styles.profileStatCardLavender]}>
            <Text style={styles.profileStatTitle}>Cycle length</Text>
            <Text style={styles.profileStatValue}>{cycleLength} days</Text>
          </View>

          <View style={[styles.profileStatCard, styles.profileStatCardPink]}>
            <Text style={styles.profileStatTitle}>Period length</Text>
            <Text style={styles.profileStatValue}>{periodLength} days</Text>
          </View>

          <View style={[styles.profileStatCard, styles.profileStatCardMint]}>
            <Text style={styles.profileStatTitle}>Last logged</Text>
            <Text style={styles.profileStatValueSmall}>{lastPeriodDate.toLocaleDateString("en-US")}</Text>
          </View>

          <View style={[styles.profileStatCard, styles.profileStatCardPeach]}>
            <Text style={styles.profileStatTitle}>Next period</Text>
            <Text style={styles.profileStatValueSmall}>{cycleContext.nextPeriodStart.toLocaleDateString("en-US")}</Text>
          </View>
        </View>

        <View style={styles.profileMenuCard}>
          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setActiveTab("insights")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>Cycle insights</Text>
              <Text style={styles.profileMenuSubtitle}>See monthly trends and history</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setActiveTab("tips")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>Tips and wellbeing</Text>
              <Text style={styles.profileMenuSubtitle}>Mood tracker, breathing, self-care</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setActiveTab("ai")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>AI assistant</Text>
              <Text style={styles.profileMenuSubtitle}>Get personalized cycle guidance</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setProfileView("settings")}>
            <View style={styles.profileMenuLabelWrap}>
              <Text style={styles.profileMenuTitle}>App settings</Text>
              <Text style={styles.profileMenuSubtitle}>Notifications, privacy, integrations</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#877A8A" />
          </TouchableOpacity>
        </View>

        <NumberAdjuster
          label="Cycle length"
          hint="Update if your cycle pattern changes"
          value={cycleLength}
          min={21}
          max={40}
          onChange={setCycleLength}
        />

        <NumberAdjuster
          label="Period length"
          hint="Used for period day and prediction accuracy"
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
          {step > 0 && <Text style={styles.progressText}>Step {step + 1} of 5</Text>}

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
                <Text style={styles.secondaryButtonText}>Back</Text>
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
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
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
    justifyContent: "flex-end",
    height: "58%",
    marginBottom: 8,
  },
  phoneMockup: {
    width: 132,
    height: 238,
    borderRadius: 24,
    borderWidth: 6,
    borderColor: "#4A4A69",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: "10%",
    bottom: 12,
  },
  phoneNotch: {
    position: "absolute",
    width: 50,
    height: 14,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: "#4A4A69",
    top: 0,
  },
  checkBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#8D72C8",
    alignItems: "center",
    justifyContent: "center",
  },
  personWrap: {
    position: "absolute",
    right: "8%",
    bottom: -2,
  },
  illustrationGround: {
    width: "86%",
    height: 2,
    backgroundColor: "#D8C7D2",
    opacity: 0.8,
    borderRadius: 2,
    marginTop: 18,
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
  highlightCapsule: {
    marginTop: 10,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "#E8DBEA",
    backgroundColor: "#FFFDFE",
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  insightRow: {
    paddingHorizontal: 12,
    gap: 10,
  },
  insightCard: {
    width: 270,
    minHeight: 142,
    borderRadius: 36,
    backgroundColor: "#F7EEF7",
    borderWidth: 1,
    borderColor: "#E5D7E8",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 6,
  },
  insightTitle: {
    fontSize: 17,
    color: "#251C2B",
    fontWeight: "700",
    lineHeight: 23,
  },
  insightSubtitle: {
    fontSize: 13,
    color: "#7E7081",
    lineHeight: 18,
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
  breathingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    backgroundColor: "#FFFFFFEE",
    padding: 16,
    gap: 10,
  },
  breathingGuideText: {
    color: "#7B6E80",
    fontSize: 14,
    lineHeight: 20,
  },
  breathingStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  breathingStatusText: {
    color: "#5C4F62",
    fontSize: 13,
    fontWeight: "700",
  },
  breathingSignWrap: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  breathingSign: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "#D8C8E7",
    backgroundColor: "#F5ECFD",
    alignItems: "center",
    justifyContent: "center",
  },
  breathingActionButton: {
    borderRadius: 18,
    minHeight: 48,
    backgroundColor: "#8F72C5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  breathingActionButtonStop: {
    backgroundColor: "#7C659E",
  },
  breathingActionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
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
});
