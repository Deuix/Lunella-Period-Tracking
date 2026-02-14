import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDateLocale, type SupportedLanguage } from "../i18n";
import { useAiAssistant } from "../features/main-screen/hooks/useAiAssistant";
import { useRevenueCatPro } from "../features/main-screen/hooks/useRevenueCatPro";
import {
  DecorativeBackground,
  NumberAdjuster,
  WelcomeIllustration,
} from "../features/main-screen/shared-components";
import { getMainScreenStyles } from "../features/main-screen/styles";
import { AiTab } from "../features/main-screen/tabs/AiTab";
import { HomeTab as HomeTabContent } from "../features/main-screen/tabs/HomeTab";
import { InsightsTab } from "../features/main-screen/tabs/InsightsTab";
import { ProfileTab } from "../features/main-screen/tabs/ProfileTab";
import { TipsTab } from "../features/main-screen/tabs/TipsTab";
import {
  MainScreenThemeProvider,
  pickThemeValue,
  resolveThemePreference,
} from "../features/main-screen/theme";
import {
  APP_STATE_STORAGE_KEY,
  BREATHING_STEPS,
  BREATHING_TOTAL_ROUNDS,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PROFILE_AVATAR_ICON,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_SELECTED_FLOW,
  GOAL_OPTIONS,
  INITIAL_AI_MESSAGES,
  MENSTRUAL_FLOW_OPTIONS,
  MOOD_OPTIONS,
  NAV_ITEMS,
  PROFILE_AVATAR_OPTIONS,
  WEEK_DAY_KEYS,
} from "../features/main-screen/constants";
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
} from "../features/main-screen/utils";
import type {
  BreathPhase,
  DecoratedCalendarDay,
  GoalOption,
  HomeTab,
  PersistedAppState,
  ProfileAvatarIcon,
  ProfileView,
  ProUpsellSource,
  SymptomLogEntry,
  ThemePreference,
} from "../features/main-screen/types";
import type { RevenueCatPlanId } from "../services/revenuecat";
import {
  clearPushInstallationId,
  ensurePushInstallationId,
  getDefaultDailyReminderHour,
  getDeviceTimeZone,
  registerForPushNotificationsAsync,
  syncPushProfileToSupabase,
} from "../services/pushNotifications";

export default function Index() {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language as SupportedLanguage);
  const systemColorScheme = useColorScheme();

  const [isHydrated, setIsHydrated] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [isOnboardingDone, setIsOnboardingDone] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isDebugProOverrideEnabled, setIsDebugProOverrideEnabled] = useState(false);
  const [isSubscriptionModalVisible, setIsSubscriptionModalVisible] = useState(false);
  const [isProSuccessVisible, setIsProSuccessVisible] = useState(false);

  const [name, setName] = useState("");
  const [profileAvatarIcon, setProfileAvatarIcon] = useState<ProfileAvatarIcon>(DEFAULT_PROFILE_AVATAR_ICON);
  const [draftProfileName, setDraftProfileName] = useState("");
  const [draftProfileAvatarIcon, setDraftProfileAvatarIcon] = useState<ProfileAvatarIcon>(DEFAULT_PROFILE_AVATAR_ICON);
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [lastPeriodDate, setLastPeriodDate] = useState(startOfDay(new Date()));
  const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE_LENGTH);
  const [periodLength, setPeriodLength] = useState(DEFAULT_PERIOD_LENGTH);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [fertilityRemindersEnabled, setFertilityRemindersEnabled] = useState(false);
  const [ovulationRemindersEnabled, setOvulationRemindersEnabled] = useState(false);
  const [dailyReminderHour, setDailyReminderHour] = useState(getDefaultDailyReminderHour());
  const [pushInstallationId, setPushInstallationId] = useState<string | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

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
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [checkInHistoryVisible, setCheckInHistoryVisible] = useState(false);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const hasProAccess = isPro || (__DEV__ && isDebugProOverrideEnabled);

  const resolvedTheme = useMemo(
    () => resolveThemePreference(themePreference, systemColorScheme),
    [systemColorScheme, themePreference],
  );
  const styles = useMemo(() => getMainScreenStyles(resolvedTheme), [resolvedTheme]);
  const themedColor = useCallback(
    (lightColor: string, darkColor: string) => pickThemeValue(resolvedTheme, lightColor, darkColor),
    [resolvedTheme],
  );
  const themeContextValue = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
    }),
    [resolvedTheme, themePreference],
  );

  const monthOptions = useMemo(() => {
    const base = startOfMonth(new Date());
    return Array.from({ length: 12 }, (_, index) => addMonths(base, index - 2));
  }, []);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(2);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(startOfDay(new Date()));

  const cycleContext = useMemo(
    () => getCycleContext(new Date(), lastPeriodDate, cycleLength, periodLength),
    [lastPeriodDate, cycleLength, periodLength],
  );

  const onboardingAnimation = useRef(new Animated.Value(1)).current;
  const breathingScale = useRef(new Animated.Value(1)).current;
  const breathingRippleAnim = useRef(new Animated.Value(0)).current;
  const breathingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    isRevenueCatEnabled,
    isRevenueCatLoading,
    revenueCatPackages,
    presentPaywall,
    purchasePlan,
    restoreSubscription,
    openCustomerCenter,
  } = useRevenueCatPro({
    isPro,
    setIsPro,
    t,
    onProUnlocked: () => setIsProSuccessVisible(true),
  });

  const {
    aiInput,
    setAiInput,
    aiMessages,
    setAiMessages,
    aiMessagesScrollRef,
    aiUsageCount,
    setAiUsageCount,
    aiUsageDateISO,
    setAiUsageDateISO,
    freeAiRemaining,
    isAiLockedForFree,
    isAiTyping,
    sendAiMessage,
  } = useAiAssistant({
    activeTab,
    cycleContext,
    cycleLength,
    goals,
    hasProAccess,
    language: i18n.language,
    periodLength,
    t,
  });

  const requestPushToken = useCallback(
    async (showFailureAlert: boolean): Promise<string | null> => {
      const registration = await registerForPushNotificationsAsync();

      if (registration.permissionGranted && registration.token) {
        setExpoPushToken(registration.token);
        return registration.token;
      }

      setExpoPushToken(null);

      if (!showFailureAlert) {
        return null;
      }

      if (registration.reason === "unsupported_platform") {
        Alert.alert(t("settings.pushUnavailableTitle"), t("settings.pushUnavailableMessage"));
        return null;
      }

      if (registration.reason === "simulator") {
        Alert.alert(t("settings.pushSimulatorTitle"), t("settings.pushSimulatorMessage"));
        return null;
      }

      Alert.alert(t("settings.pushPermissionDeniedTitle"), t("settings.pushPermissionDeniedMessage"));
      return null;
    },
    [t],
  );

  const setPushReminderToggle = useCallback(
    (enabled: boolean, setter: (nextValue: boolean) => void) => {
      if (!enabled) {
        setter(false);
        return;
      }

      void (async () => {
        const pushToken = await requestPushToken(true);
        setter(Boolean(pushToken));
      })();
    },
    [requestPushToken],
  );

  const handleSetRemindersEnabled = useCallback(
    (enabled: boolean) => {
      setPushReminderToggle(enabled, setRemindersEnabled);
    },
    [setPushReminderToggle],
  );

  const handleSetFertilityRemindersEnabled = useCallback(
    (enabled: boolean) => {
      setPushReminderToggle(enabled, setFertilityRemindersEnabled);
    },
    [setPushReminderToggle],
  );

  const handleSetOvulationRemindersEnabled = useCallback(
    (enabled: boolean) => {
      setPushReminderToggle(enabled, setOvulationRemindersEnabled);
    },
    [setPushReminderToggle],
  );

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
        if (
          typeof storedState.themePreference === "string"
          && (storedState.themePreference === "system"
            || storedState.themePreference === "light"
            || storedState.themePreference === "dark")
        ) {
          setThemePreference(storedState.themePreference);
        }
        if (typeof storedState.isPro === "boolean") {
          setIsPro(storedState.isPro);
        }
        if (typeof storedState.name === "string") {
          setName(storedState.name);
        }
        if (
          typeof storedState.profileAvatarIcon === "string"
          && PROFILE_AVATAR_OPTIONS.includes(storedState.profileAvatarIcon as ProfileAvatarIcon)
        ) {
          setProfileAvatarIcon(storedState.profileAvatarIcon as ProfileAvatarIcon);
          setDraftProfileAvatarIcon(storedState.profileAvatarIcon as ProfileAvatarIcon);
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
        if (typeof storedState.fertilityRemindersEnabled === "boolean") {
          setFertilityRemindersEnabled(storedState.fertilityRemindersEnabled);
        }
        if (typeof storedState.ovulationRemindersEnabled === "boolean") {
          setOvulationRemindersEnabled(storedState.ovulationRemindersEnabled);
        }
        if (typeof storedState.dailyReminderHour === "number") {
          setDailyReminderHour(Math.max(0, Math.min(23, Math.trunc(storedState.dailyReminderHour))));
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
  }, [setAiMessages, setAiUsageCount, setAiUsageDateISO]);

  useEffect(() => {
    if (!isHydrated || pushInstallationId) {
      return;
    }

    let isMounted = true;

    const ensureInstallationId = async () => {
      const installationId = await ensurePushInstallationId();
      if (isMounted) {
        setPushInstallationId(installationId);
      }
    };

    void ensureInstallationId();

    return () => {
      isMounted = false;
    };
  }, [isHydrated, pushInstallationId]);

  const hasAnyPushReminderEnabled = remindersEnabled || fertilityRemindersEnabled || ovulationRemindersEnabled;

  useEffect(() => {
    if (!isHydrated || !isOnboardingDone || !hasAnyPushReminderEnabled || expoPushToken) {
      return;
    }

    void (async () => {
      const pushToken = await requestPushToken(false);
      if (!pushToken) {
        setRemindersEnabled(false);
        setFertilityRemindersEnabled(false);
        setOvulationRemindersEnabled(false);
      }
    })();
  }, [
    expoPushToken,
    fertilityRemindersEnabled,
    hasAnyPushReminderEnabled,
    isHydrated,
    isOnboardingDone,
    ovulationRemindersEnabled,
    requestPushToken,
  ]);

  useEffect(() => {
    if (!isHydrated || !isOnboardingDone || !pushInstallationId) {
      return;
    }

    const syncPushProfile = async () => {
      try {
        await syncPushProfileToSupabase({
          installationId: pushInstallationId,
          expoPushToken,
          remindersEnabled,
          fertilityRemindersEnabled,
          ovulationRemindersEnabled,
          cycleLength,
          periodLength,
          lastPeriodDateISO: lastPeriodDate.toISOString(),
          language: i18n.language,
          timeZone: getDeviceTimeZone(),
          dailyReminderHour,
        });
      } catch (error) {
        if (__DEV__) {
          console.warn("[Push] Failed to sync reminder profile", error);
        }
      }
    };

    void syncPushProfile();
  }, [
    cycleLength,
    dailyReminderHour,
    expoPushToken,
    fertilityRemindersEnabled,
    i18n.language,
    isHydrated,
    isOnboardingDone,
    lastPeriodDate,
    ovulationRemindersEnabled,
    periodLength,
    pushInstallationId,
    remindersEnabled,
  ]);

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

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persistedState: PersistedAppState = {
      isOnboardingDone,
      themePreference,
      name,
      profileAvatarIcon,
      goals,
      lastPeriodDateISO: lastPeriodDate.toISOString(),
      cycleLength,
      periodLength,
      remindersEnabled,
      fertilityRemindersEnabled,
      ovulationRemindersEnabled,
      dailyReminderHour,
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
    dailyReminderHour,
    fertilityRemindersEnabled,
    goals,
    healthSyncEnabled,
    insightNudgesEnabled,
    isHydrated,
    isOnboardingDone,
    isPro,
    lastPeriodDate,
    name,
    profileAvatarIcon,
    periodLength,
    pinLockEnabled,
    remindersEnabled,
    ovulationRemindersEnabled,
    selectedFlow,
    selectedMoods,
    symptomLogs,
    themePreference,
  ]);

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
    setDraftProfileAvatarIcon(profileAvatarIcon);
    setProfileView("edit_profile");
  }, [name, profileAvatarIcon]);

  const closeEditProfile = useCallback(() => {
    setDraftProfileName(name.trim());
    setDraftProfileAvatarIcon(profileAvatarIcon);
    setProfileView("main");
  }, [name, profileAvatarIcon]);

  const handleSaveProfileName = useCallback(() => {
    const trimmedName = draftProfileName.trim();

    if (!trimmedName) {
      Alert.alert(t("profile.nameRequiredTitle"), t("profile.nameRequiredMessage"));
      return;
    }

    setName(trimmedName);
    setProfileAvatarIcon(draftProfileAvatarIcon);
    setProfileView("main");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draftProfileAvatarIcon, draftProfileName, t]);

  const handleDeleteAllData = useCallback(() => {
    Alert.alert(t("settings.deleteAllDataTitle"), t("settings.deleteAllDataMessage"), [
      {
        text: t("languagePicker.cancel"),
        style: "cancel",
      },
      {
        text: t("settings.deleteAllDataConfirm"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const today = startOfDay(new Date());

              if (pushInstallationId) {
                try {
                  await syncPushProfileToSupabase({
                    installationId: pushInstallationId,
                    expoPushToken: null,
                    remindersEnabled: false,
                    fertilityRemindersEnabled: false,
                    ovulationRemindersEnabled: false,
                    cycleLength,
                    periodLength,
                    lastPeriodDateISO: lastPeriodDate.toISOString(),
                    language: i18n.language,
                    timeZone: getDeviceTimeZone(),
                    dailyReminderHour,
                  });
                } catch {
                  // Best effort only: local reset should still continue.
                }
              }

              await AsyncStorage.removeItem(APP_STATE_STORAGE_KEY);
              await clearPushInstallationId();

              setIsOnboardingDone(false);
              setThemePreference("system");
              setStep(0);
              setName("");
              setProfileAvatarIcon(DEFAULT_PROFILE_AVATAR_ICON);
              setDraftProfileName("");
              setDraftProfileAvatarIcon(DEFAULT_PROFILE_AVATAR_ICON);
              setGoals([]);
              setLastPeriodDate(today);
              setCycleLength(DEFAULT_CYCLE_LENGTH);
              setPeriodLength(DEFAULT_PERIOD_LENGTH);
              setRemindersEnabled(true);
              setFertilityRemindersEnabled(false);
              setOvulationRemindersEnabled(false);
              setDailyReminderHour(getDefaultDailyReminderHour());
              setPushInstallationId(null);
              setExpoPushToken(null);
              setOnboardingMonth(startOfMonth(today));
              setActiveTab("home");
              setProfileView("main");
              setSelectedFlow(DEFAULT_SELECTED_FLOW);
              setSelectedMoods([]);
              setBreathingPhase("ready");
              setBreathingSecondsLeft(0);
              setBreathingRound(0);
              setBreathingStepIndex(null);
              setInsightNudgesEnabled(true);
              setHealthSyncEnabled(false);
              setPinLockEnabled(false);
              setSymptomLogs([]);
              setLanguagePickerVisible(false);
              setCheckInHistoryVisible(false);
              setSelectedHistoryEntryId(null);
              setSelectedMonthIndex(2);
              setSelectedCalendarDate(today);
              setIsPro(false);
              setIsDebugProOverrideEnabled(false);
              setIsSubscriptionModalVisible(false);
              setIsProSuccessVisible(false);
              setAiInput("");
              setAiMessages(INITIAL_AI_MESSAGES);
              setAiUsageDateISO(today.toISOString());
              setAiUsageCount(0);

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(t("settings.deleteAllDataDoneTitle"), t("settings.deleteAllDataDoneMessage"));
            } catch {
              Alert.alert(t("settings.deleteAllDataErrorTitle"), t("settings.deleteAllDataErrorMessage"));
            }
          })();
        },
      },
    ]);
  }, [
    cycleLength,
    dailyReminderHour,
    i18n.language,
    lastPeriodDate,
    periodLength,
    pushInstallationId,
    setAiInput,
    setAiMessages,
    setAiUsageCount,
    setAiUsageDateISO,
    t,
  ]);

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
      bgColor: themedColor("#FFF0F3", "#4D2834"),
      accentColor: themedColor("#D4587A", "#ED7BA0"),
      iconBgColor: themedColor("#FDDDE5", "#684050"),
    },
    {
      heroValue: cycleContext.daysUntilOvulation === 0
        ? t("home.today")
        : `${cycleContext.daysUntilOvulation}`,
      heroLabel: cycleContext.daysUntilOvulation === 0 ? t("home.isOvulationDay") : t("home.daysToOvulation"),
      subtitle: t("home.expectedDate", { date: cycleContext.nextOvulationDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) }),
      icon: "egg",
      bgColor: themedColor("#EEF4FF", "#29384C"),
      accentColor: themedColor("#5B7FC2", "#8CB2F4"),
      iconBgColor: themedColor("#DCE8FD", "#3B4D66"),
    },
    {
      heroValue: cycleContext.isFertilityWindow
        ? `${cycleContext.fertilityDaysLeft}`
        : `${Math.max(0, cycleContext.daysUntilFertilityStart)}`,
      heroLabel: cycleContext.isFertilityWindow ? t("home.fertileDaysLeft") : t("home.daysToFertileWindow"),
      subtitle: `${cycleContext.fertilityStartDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })} - ${cycleContext.fertilityEndDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}`,
      icon: "leaf",
      bgColor: themedColor("#EEFBF3", "#274838"),
      accentColor: themedColor("#4A9D6E", "#73C59B"),
      iconBgColor: themedColor("#D5F2E1", "#345947"),
    },
  ];

  const isBreathingRunning = breathingStepIndex !== null;
  const activeBreathingStep =
    breathingPhase === "inhale" || breathingPhase === "hold" || breathingPhase === "exhale"
      ? BREATHING_STEPS.find((step) => step.phase === breathingPhase) ?? null
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

  const handlePresentPaywall = useCallback(
    async (ifNeeded = true) => {
      const unlocked = await presentPaywall(ifNeeded);
      if (unlocked) {
        setIsSubscriptionModalVisible(false);
      }
    },
    [presentPaywall],
  );

  const handlePurchasePlan = useCallback(
    async (planId: RevenueCatPlanId) => {
      const unlocked = await purchasePlan(planId);
      if (unlocked) {
        setIsSubscriptionModalVisible(false);
      }
    },
    [purchasePlan],
  );

  const handleRestoreSubscription = useCallback(async () => {
    await restoreSubscription();
  }, [restoreSubscription]);

  const handleOpenCustomerCenter = useCallback(async () => {
    await openCustomerCenter();
  }, [openCustomerCenter]);

  const showProUpsell = useCallback(
    (source: ProUpsellSource) => {
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
    },
    [handlePresentPaywall, isRevenueCatEnabled, t],
  );


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

  const handleSendAiMessage = useCallback(
    async (messageText: string) => {
      const result = await sendAiMessage(messageText);
      if (result === "locked") {
        showProUpsell("ai");
      }
    },
    [sendAiMessage, showProUpsell],
  );

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
            placeholderTextColor={themedColor("#9F95A4", "#9F95A4")}
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
            onValueChange={handleSetRemindersEnabled}
            trackColor={{
              false: themedColor("#D2C4DA", "#4D435A"),
              true: themedColor("#AB8FD9", "#7C67B0"),
            }}
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
          <MaterialCommunityIcons
            name="calendar-edit"
            size={18}
            color={themedColor("#8F72C5", "#C8B2F8")}
          />
          <Text style={styles.setAsPeriodButtonText}>{t("home.setAsPeriodStart")}</Text>
        </TouchableOpacity>

        <Text style={styles.probabilityRecommendation}>{selectedDatePregnancyDetail.recommendation}</Text>
      </View>
    );
  };

  const renderTabContent = () => {
    if (activeTab === "home") {
      return (
        <HomeTabContent
          dateLocale={dateLocale}
          decoratedHomeDays={decoratedHomeDays}
          hasProAccess={hasProAccess}
          insightCards={insightCards}
          monthLabel={monthLabel}
          monthOptions={monthOptions}
          profileAvatarIcon={profileAvatarIcon}
          onPeriodStartsToday={handlePeriodStartsToday}
          onProfilePress={() => setActiveTab("profile")}
          onSelectCalendarDate={setSelectedCalendarDate}
          onSelectMonthIndex={setSelectedMonthIndex}
          renderPregnancyProbabilityCard={renderPregnancyProbabilityCard}
          selectedCalendarDate={selectedCalendarDate}
          selectedMonthIndex={selectedMonthIndex}
          t={t}
        />
      );
    }

    if (activeTab === "insights") {
      return (
        <InsightsTab
          averageSymptomScore={averageSymptomScore}
          currentMonthInsight={currentMonthInsight}
          cycleLength={cycleLength}
          dateLocale={dateLocale}
          hasProAccess={hasProAccess}
          monthlyInsights={monthlyInsights}
          periodLength={periodLength}
          proInsightsSummary={proInsightsSummary}
          showProUpsell={() => showProUpsell("insights")}
          t={t}
        />
      );
    }

    if (activeTab === "ai") {
      return (
        <AiTab
          aiInput={aiInput}
          aiMessages={aiMessages}
          aiMessagesScrollRef={aiMessagesScrollRef}
          aiQuickPrompts={aiQuickPrompts}
          freeAiRemaining={freeAiRemaining}
          hasProAccess={hasProAccess}
          isAiLockedForFree={isAiLockedForFree}
          isAiTyping={isAiTyping}
          onSendMessage={handleSendAiMessage}
          onShowProUpsell={() => showProUpsell("ai")}
          setAiInput={setAiInput}
          t={t}
        />
      );
    }

    if (activeTab === "tips") {
      return (
        <TipsTab
          activeBreathingStep={activeBreathingStep}
          breathingGuideText={breathingGuideText}
          breathingPhase={breathingPhase}
          breathingRippleAnim={breathingRippleAnim}
          breathingRoundText={breathingRoundText}
          breathingScale={breathingScale}
          breathingSecondsLeft={breathingSecondsLeft}
          isBreathingRunning={isBreathingRunning}
          name={name}
          onOpenCheckInHistory={openCheckInHistory}
          onSaveDailyCheckin={handleSaveDailyCheckin}
          onSelectFlow={setSelectedFlow}
          onStartBreathingSession={startBreathingSession}
          onStopBreathingSession={stopBreathingSession}
          onToggleMood={toggleMood}
          selectedFlow={selectedFlow}
          selectedMoods={selectedMoods}
          symptomLogs={symptomLogs}
          t={t}
        />
      );
    }

    return (
      <ProfileTab
        cycleContext={cycleContext}
        cycleLength={cycleLength}
        dateLocale={dateLocale}
        dailyReminderHour={dailyReminderHour}
        draftProfileName={draftProfileName}
        draftProfileAvatarIcon={draftProfileAvatarIcon}
        fertilityRemindersEnabled={fertilityRemindersEnabled}
        goals={goals}
        hasProAccess={hasProAccess}
        healthSyncEnabled={healthSyncEnabled}
        i18n={i18n}
        insightNudgesEnabled={insightNudgesEnabled}
        isDebugProOverrideEnabled={isDebugProOverrideEnabled}
        isRevenueCatLoading={isRevenueCatLoading}
        isSubscriptionModalVisible={isSubscriptionModalVisible}
        languagePickerVisible={languagePickerVisible}
        lastPeriodDate={lastPeriodDate}
        name={name}
        profileAvatarIcon={profileAvatarIcon}
        onCloseEditProfile={closeEditProfile}
        onDeleteAllData={handleDeleteAllData}
        onExportCycleData={() => {
          void handleExportCycleData();
        }}
        onOpenCustomerCenter={handleOpenCustomerCenter}
        onOpenEditProfile={openEditProfile}
        onOpenSubscriptionModal={openSubscriptionModal}
        onPresentPaywall={handlePresentPaywall}
        onPurchasePlan={handlePurchasePlan}
        onRestoreSubscription={handleRestoreSubscription}
        onSaveProfileName={handleSaveProfileName}
        onSetActiveTab={setActiveTab}
        onSetCycleLength={setCycleLength}
        onSetDailyReminderHour={setDailyReminderHour}
        onSetDebugProOverrideEnabled={setIsDebugProOverrideEnabled}
        onSetDraftProfileName={setDraftProfileName}
        onSetDraftProfileAvatarIcon={setDraftProfileAvatarIcon}
        onSetFertilityRemindersEnabled={handleSetFertilityRemindersEnabled}
        onSetHealthSyncEnabled={setHealthSyncEnabled}
        onSetInsightNudgesEnabled={setInsightNudgesEnabled}
        onSetLanguagePickerVisible={setLanguagePickerVisible}
        onSetOvulationRemindersEnabled={handleSetOvulationRemindersEnabled}
        onSetPeriodLength={setPeriodLength}
        onSetPinLockEnabled={setPinLockEnabled}
        onSetProfileView={setProfileView}
        onSetRemindersEnabled={handleSetRemindersEnabled}
        onSetSubscriptionModalVisible={setIsSubscriptionModalVisible}
        ovulationRemindersEnabled={ovulationRemindersEnabled}
        periodLength={periodLength}
        pinLockEnabled={pinLockEnabled}
        profileView={profileView}
        remindersEnabled={remindersEnabled}
        revenueCatPackages={revenueCatPackages}
        themePreference={themePreference}
        onSetThemePreference={setThemePreference}
        showProUpsell={showProUpsell}
        t={t}
      />
    );
  };

  if (!isHydrated) {
    return (
      <MainScreenThemeProvider value={themeContextValue}>
        <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
        <SafeAreaView style={styles.safeArea}>
          <DecorativeBackground />
          <View style={styles.hydrationWrap}>
            <Text style={styles.hydrationText}>{t("common.loading")}</Text>
          </View>
        </SafeAreaView>
      </MainScreenThemeProvider>
    );
  }

  if (!isOnboardingDone) {
    return (
      <MainScreenThemeProvider value={themeContextValue}>
        <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
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
      </MainScreenThemeProvider>
    );
  }

  return (
    <MainScreenThemeProvider value={themeContextValue}>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
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
                  <Ionicons
                    name={item.icon}
                    size={19}
                    color={isActive ? "#FFFFFF" : themedColor("#6E6074", "#A79DB2")}
                  />
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
              colors={pickThemeValue(resolvedTheme, ["#F8F4FF", "#FFFFFF"], ["#2A2236", "#1B1827"])}
              style={styles.historyModalGradient}>
              <View style={styles.historyModalHeader}>
                <View style={styles.historyModalHeaderLeft}>
                  <View style={styles.historyModalIconContainer}>
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={22}
                      color={themedColor("#8F72C5", "#C8B2F8")}
                    />
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
                  <Ionicons name="close" size={24} color={themedColor("#6E6074", "#C2B8CD")} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.historyList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={symptomLogs.length === 0 ? styles.historyListEmptyCenter : styles.historyListContent}>
                {symptomLogs.length === 0 ? (
                  <View style={styles.emptyHistoryContainer}>
                    <LinearGradient
                      colors={pickThemeValue(resolvedTheme, ["#F0E8FA", "#E9DFFF"], ["#3D3050", "#322946"])}
                      style={styles.emptyHistoryIconContainer}>
                      <MaterialCommunityIcons
                        name="calendar-blank-outline"
                        size={72}
                        color={themedColor("#8F72C5", "#C8B2F8")}
                      />
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
                              {isSelected && (
                                <Ionicons
                                  name="chevron-forward"
                                  size={16}
                                  color={themedColor("#8F72C5", "#C8B2F8")}
                                />
                              )}
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
                                    ? pickThemeValue(resolvedTheme, ["#8F72C5", "#A788D9"], ["#8F72C5", "#A788D9"])
                                    : isSelectedHistoryEntryYesterday
                                      ? pickThemeValue(resolvedTheme, ["#B8A8E0", "#D4C2F0"], ["#6E5A95", "#5A4A7A"])
                                      : pickThemeValue(resolvedTheme, ["#E9DFFF", "#F5E6FF"], ["#4B3D66", "#3D3254"])
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
                              <Ionicons
                                name="trash-outline"
                                size={18}
                                color={themedColor("#E57373", "#EF9090")}
                              />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.historyCardBody}>
                            <View style={styles.historyFlowRow}>
                              <View style={styles.historyFlowIconContainer}>
                                <MaterialCommunityIcons
                                  name="water"
                                  size={16}
                                  color={themedColor("#8F72C5", "#C8B2F8")}
                                />
                                <Text style={styles.historyFlowLabel}>{t("tips.menstrualFlow")}</Text>
                              </View>
                              <View style={styles.historyFlowValueContainer}>
                                {Array.from({ length: selectedHistoryFlowOption?.drops || 1 }).map((_, dropIndex) => (
                                  <View key={dropIndex} style={styles.historyFlowDrop}>
                                    <MaterialCommunityIcons
                                      name="water"
                                      size={12}
                                      color={themedColor("#8F72C5", "#C8B2F8")}
                                    />
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
                                  <MaterialCommunityIcons
                                    name="emoticon-happy-outline"
                                    size={16}
                                    color={themedColor("#8F72C5", "#C8B2F8")}
                                  />
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
    </MainScreenThemeProvider>
  );
}
