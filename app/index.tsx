import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
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

import { DecorativeBackground, NumberAdjuster, WelcomeIllustration } from "./index.components";
import {
  APP_STATE_STORAGE_KEY,
  BREATHING_STEPS,
  BREATHING_TOTAL_ROUNDS,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_SELECTED_FLOW,
  EMPTY_REVENUECAT_PACKAGES,
  FREE_AI_DAILY_LIMIT,
  GIRL_TIPS,
  GOAL_OPTIONS,
  INITIAL_AI_MESSAGES,
  MENSTRUAL_FLOW_OPTIONS,
  MOOD_OPTIONS,
  NAV_ITEMS,
  WEEK_DAY_KEYS,
} from "./index.constants";
import { styles } from "./index.styles";
import {
  addDays,
  addMonths,
  buildCalendarDays,
  buildMonthlyInsight,
  buildPregnancyProbabilityDetail,
  diffInDays,
  getCycleContext,
  getDayCategory,
  isSameDay,
  startOfDay,
  startOfMonth,
} from "./index.utils";
import type {
  AiMessage,
  BreathPhase,
  DecoratedCalendarDay,
  GoalOption,
  HomeTab,
  PersistedAppState,
  ProfileView,
  ProUpsellSource,
  SymptomLogEntry,
} from "./index.types";
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
  const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE_LENGTH);
  const [periodLength, setPeriodLength] = useState(DEFAULT_PERIOD_LENGTH);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const [onboardingMonth, setOnboardingMonth] = useState(startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState<HomeTab>("home");
  const [profileView, setProfileView] = useState<ProfileView>("main");
  const [selectedFlow, setSelectedFlow] = useState(DEFAULT_SELECTED_FLOW);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [breathingPhase, setBreathingPhase] = useState<BreathPhase>("ready");
  const [breathingSecondsLeft, setBreathingSecondsLeft] = useState(0);
  const [breathingRound, setBreathingRound] = useState(0);
  const [breathingStepIndex, setBreathingStepIndex] = useState<number | null>(null);
  const [insightNudgesEnabled, setInsightNudgesEnabled] = useState(true);
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(false);
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>([]);
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
                : t("pro.upsellSourceInsights");

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
