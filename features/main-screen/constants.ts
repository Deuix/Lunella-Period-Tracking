import { Ionicons } from "@expo/vector-icons";
import type { RevenueCatPackagesMap } from "../../services/revenuecat";
import type {
  AiMessage,
  BreathStep,
  GirlTip,
  GoalOption,
  HomeTab,
  MenstrualFlowOption,
  MoodOption,
} from "./types";

export const GOAL_OPTIONS: { id: GoalOption; labelKey: string }[] = [
  { id: "cycle_tracking", labelKey: "goals.cycleTracking" },
  { id: "trying_to_conceive", labelKey: "goals.tryingToConceive" },
  { id: "pregnancy_tracking", labelKey: "goals.pregnancyTracking" },
];
export const WEEK_DAY_KEYS = [
  "weekDays.sun",
  "weekDays.mon",
  "weekDays.tue",
  "weekDays.wed",
  "weekDays.thu",
  "weekDays.fri",
  "weekDays.sat",
];

export const NAV_ITEMS: { key: HomeTab; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", labelKey: "nav.home", icon: "home" },
  { key: "insights", labelKey: "nav.insights", icon: "bar-chart" },
  { key: "ai", labelKey: "nav.ai", icon: "sparkles" },
  { key: "tips", labelKey: "nav.tips", icon: "bulb" },
  { key: "profile", labelKey: "nav.profile", icon: "person" },
];

export const MOOD_OPTIONS: MoodOption[] = [
  { emoji: "😊", labelKey: "moods.happy" },
  { emoji: "😌", labelKey: "moods.calm" },
  { emoji: "🥰", labelKey: "moods.loved" },
  { emoji: "😴", labelKey: "moods.tired" },
  { emoji: "😣", labelKey: "moods.cramps" },
  { emoji: "😕", labelKey: "moods.low" },
  { emoji: "😤", labelKey: "moods.stressed" },
  { emoji: "🤕", labelKey: "moods.headache" },
];

export const MENSTRUAL_FLOW_OPTIONS: MenstrualFlowOption[] = [
  { key: "light", labelKey: "flow.light", drops: 1 },
  { key: "medium", labelKey: "flow.medium", drops: 1 },
  { key: "heavy", labelKey: "flow.heavy", drops: 2 },
];

export const GIRL_TIPS: GirlTip[] = [
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


export const BREATHING_TOTAL_ROUNDS = 4;
export const APP_STATE_STORAGE_KEY = "lunella_app_state_v1";
export const FREE_AI_DAILY_LIMIT = 3;
export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
export const DEFAULT_SELECTED_FLOW = "medium";
export const EMPTY_REVENUECAT_PACKAGES: RevenueCatPackagesMap = {
  monthly: null,
  yearly: null,
  lifetime: null,
};
export const INITIAL_AI_MESSAGES: AiMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    text: "",
  },
];
export const BREATHING_STEPS: BreathStep[] = [
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
