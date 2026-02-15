export type GoalOption = "cycle_tracking" | "trying_to_conceive" | "pregnancy_tracking";
export type HomeTab = "home" | "insights" | "ai" | "tips" | "profile";
export type DayCategory = "period" | "ovulation" | "fertility" | "late" | "normal";
export type BreathPhase = "ready" | "inhale" | "hold" | "exhale" | "done";
export type ProfileView = "main" | "settings" | "edit_profile";
export type ThemePreference = "system" | "light" | "dark";
export type ProfileAvatarIcon = "flower" | "flower-outline" | "rose" | "rose-outline" | "leaf" | "leaf-outline";

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type SymptomLogEntry = {
  id: string;
  dateISO: string;
  flowKey: string;
  moods: string[];
};

export type ProUpsellSource = "ai" | "insights" | "export" | "health_sync" | "passcode";

export type PersistedAppState = {
  isOnboardingDone: boolean;
  themePreference: ThemePreference;
  name: string;
  profileAvatarIcon: ProfileAvatarIcon;
  goals: GoalOption[];
  lastPeriodDateISO: string;
  cycleLength: number;
  periodLength: number;
  remindersEnabled: boolean;
  fertilityRemindersEnabled: boolean;
  ovulationRemindersEnabled: boolean;
  celebrationEffectsEnabled: boolean;
  periodStartCelebrationEnabled: boolean;
  periodEndCelebrationEnabled: boolean;
  lastPeriodStartCelebrationDateISO: string | null;
  lastPeriodEndCelebrationDateISO: string | null;
  dailyReminderHour: number;
  selectedFlow: string;
  selectedMoods: string[];
  insightNudgesEnabled: boolean;
  healthSyncEnabled: boolean;
  pinLockEnabled: boolean;
  aiMessages: AiMessage[];
  symptomLogs: SymptomLogEntry[];
  aiUsageDateISO: string;
  aiUsageCount: number;
  isPro: boolean;
};

export type MoodOption = {
  emoji: string;
  labelKey: string;
};

export type MenstrualFlowOption = {
  key: string;
  labelKey: string;
  drops: number;
};

export type GirlTip = {
  titleKey: string;
  detailKey: string;
};

export type BreathStep = {
  phase: Exclude<BreathPhase, "ready" | "done">;
  labelKey: string;
  seconds: number;
  targetScale: number;
  guidanceKey: string;
};

export type MonthlyInsight = {
  monthDate: Date;
  monthLabel: string;
  periodDays: number;
  ovulationDays: number;
  fertilityDays: number;
  ovulationDayOfMonth: number | null;
  periodRangeLabel: string;
  predictedSymptomScore: number;
};

export type PregnancyProbabilityDetail = {
  level: "High" | "Medium" | "Low";
  chanceRangeLabel: string;
  summary: string;
  recommendation: string;
  ovulationDate: Date;
  fertilityStartDate: Date;
  fertilityEndDate: Date;
  cycleDayNumber: number;
};

export type CalendarDay = {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
};

export type DecoratedCalendarDay = CalendarDay & {
  category: DayCategory;
  isToday: boolean;
};

export type CycleContext = {
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

export type NumberAdjusterProps = {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};
