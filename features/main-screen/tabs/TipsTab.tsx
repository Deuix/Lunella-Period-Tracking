import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { GIRL_TIPS, MENSTRUAL_FLOW_OPTIONS, MOOD_OPTIONS } from "../constants";
import { useMainScreenStyles } from "../styles";
import { pickThemeValue, useMainScreenTheme } from "../theme";
import { startOfDay } from "../utils";
import type { BreathPhase, BreathStep, SymptomLogEntry } from "../types";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type TipVisual = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  bgColor: string;
};

type TipsTabProps = {
  activeBreathingStep: BreathStep | null;
  breathingGuideText: string;
  breathingPhase: BreathPhase;
  breathingRippleAnim: Animated.Value;
  breathingRoundText: string;
  breathingScale: Animated.Value;
  breathingSecondsLeft: number;
  isBreathingRunning: boolean;
  name: string;
  onOpenCheckInHistory: () => void;
  onSaveDailyCheckin: () => void;
  onSelectFlow: (flow: string) => void;
  onStartBreathingSession: () => void;
  onStopBreathingSession: (nextPhase: BreathPhase) => void;
  onToggleMood: (moodKey: string) => void;
  selectedFlow: string;
  selectedMoods: string[];
  symptomLogs: SymptomLogEntry[];
  t: TranslationFn;
};

const TIP_VISUALS: Record<string, TipVisual> = {
  "girlTips.tip1Title": { icon: "tea", color: "#D4587A", bgColor: "#FCEEF4" },
  "girlTips.tip2Title": { icon: "moon-waning-crescent", color: "#7B5EA8", bgColor: "#F0E8FA" },
  "girlTips.tip3Title": { icon: "water", color: "#4A9D6E", bgColor: "#ECF8F1" },
  "girlTips.tip4Title": { icon: "food-apple", color: "#E6A84D", bgColor: "#FFF3EA" },
  "girlTips.tip5Title": { icon: "walk", color: "#8F72C5", bgColor: "#F0E8FA" },
};

const DEFAULT_TIP_VISUAL: TipVisual = {
  icon: "lightbulb",
  color: "#8F72C5",
  bgColor: "#F0E8FA",
};

export function TipsTab({
  activeBreathingStep,
  breathingGuideText,
  breathingPhase,
  breathingRippleAnim,
  breathingRoundText,
  breathingScale,
  breathingSecondsLeft,
  isBreathingRunning,
  name,
  onOpenCheckInHistory,
  onSaveDailyCheckin,
  onSelectFlow,
  onStartBreathingSession,
  onStopBreathingSession,
  onToggleMood,
  selectedFlow,
  selectedMoods,
  symptomLogs,
  t,
}: TipsTabProps) {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();
  const feelingName = name.trim() || "Gul";
  const todayISO = startOfDay(new Date()).toISOString();
  const todayCheckIn = symptomLogs.find((log) => log.dateISO === todayISO);
  const hasTodayCheckIn = !!todayCheckIn;
  const selectedMoodCount = selectedMoods.length;
  const flowLabel = t(`flow.${selectedFlow}`);
  const selectedMoodSet = new Set(selectedMoods);
  const recommendedTip =
    selectedMoodSet.has("moods.cramps") || selectedMoodSet.has("moods.headache")
      ? GIRL_TIPS[0]
      : selectedMoodSet.has("moods.tired") || selectedMoodSet.has("moods.low")
        ? GIRL_TIPS[1]
        : selectedMoodSet.has("moods.stressed")
          ? GIRL_TIPS[4]
          : selectedFlow === "heavy"
            ? GIRL_TIPS[3]
            : GIRL_TIPS[2];
  const recommendedTipVisual = TIP_VISUALS[recommendedTip.titleKey] ?? DEFAULT_TIP_VISUAL;

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>{t("tips.sectionTitle")}</Text>

      {hasTodayCheckIn && (
        <TouchableOpacity style={styles.todayCheckInBanner} onPress={onOpenCheckInHistory}>
          <View style={styles.todayCheckInBannerHeader}>
            <View style={styles.todayCheckInBannerIcon}>
              <Ionicons name="checkmark-circle" size={18} color="#8F72C5" />
            </View>
            <View style={styles.todayCheckInBannerCopy}>
              <Text style={styles.todayCheckInBannerText}>{t("tips.alreadyCheckedIn")}</Text>
              <Text style={styles.todayCheckInBannerSubtext}>{t("tips.viewOrEdit")}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#8F72C5" />
        </TouchableOpacity>
      )}

      <View style={styles.infoCard}>
        <LinearGradient
          colors={pickThemeValue(resolvedTheme, ["#F8F1FF", "#FFFFFF"], ["#2B2238", "#1D1A2A"])}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.checkInHero}>
          <View style={styles.checkInHeroHeader}>
            <View style={styles.checkInHeroCopy}>
              <Text style={styles.checkInHeroTitle}>{t("tips.howDoYouFeel", { name: feelingName })}</Text>
              <Text style={styles.checkInHeroSubtitle}>{t("tips.pickMoods")}</Text>
            </View>

            <View style={styles.checkInMoodCounter}>
              <Ionicons name="sparkles-outline" size={16} color="#8F72C5" />
              <Text style={styles.checkInMoodCounterValue}>{selectedMoodCount}</Text>
            </View>
          </View>

          <View style={styles.checkInSummaryRow}>
            <View style={styles.checkInSummaryChip}>
              <MaterialCommunityIcons name="water" size={15} color="#8F72C5" />
              <Text style={styles.checkInSummaryText}>{flowLabel}</Text>
            </View>
            <View style={styles.checkInSummaryChip}>
              <Ionicons name="happy-outline" size={15} color="#8F72C5" />
              <Text style={styles.checkInSummaryText}>
                {t("tips.moods")} {selectedMoodCount}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.flowCard}>
          <View style={styles.checkInSectionHeader}>
            <Text style={styles.flowCardTitle}>{t("tips.menstrualFlow")}</Text>
            <Text style={styles.checkInSectionBadge}>{flowLabel}</Text>
          </View>

          <View style={styles.flowTabRow}>
            {MENSTRUAL_FLOW_OPTIONS.map((flowOption) => {
              const isSelected = selectedFlow === flowOption.key;

              return (
                <Pressable
                  key={flowOption.key}
                  style={[styles.flowTab, isSelected && styles.flowTabActive]}
                  onPress={() => onSelectFlow(flowOption.key)}>
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

        <View style={styles.checkInSection}>
          <View style={styles.checkInSectionHeader}>
            <Text style={styles.checkInSectionTitle}>{t("tips.moods")}</Text>
            <Text style={styles.checkInSectionBadge}>
              {selectedMoodCount}/{MOOD_OPTIONS.length}
            </Text>
          </View>

          <View style={styles.moodGrid}>
            {MOOD_OPTIONS.map((moodOption) => {
              const isSelected = selectedMoods.includes(moodOption.labelKey);
              return (
                <Pressable
                  key={moodOption.labelKey}
                  style={[styles.moodChip, isSelected && styles.moodChipActive]}
                  onPress={() => onToggleMood(moodOption.labelKey)}>
                  {isSelected && <Ionicons name="checkmark-circle" size={16} color="#8F72C5" style={styles.moodChipCheck} />}
                  <Text style={styles.moodEmoji}>{moodOption.emoji}</Text>
                  <Text style={[styles.moodLabel, isSelected && styles.moodLabelActive]}>
                    {t(moodOption.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.recommendedTipCard}>
          <View style={[styles.recommendedTipIcon, { backgroundColor: recommendedTipVisual.bgColor }]}>
            <MaterialCommunityIcons name={recommendedTipVisual.icon} size={22} color={recommendedTipVisual.color} />
          </View>
          <View style={styles.recommendedTipCopy}>
            <Text style={styles.recommendedTipLabel}>{t("tips.quickTips")}</Text>
            <Text style={styles.recommendedTipTitle}>{t(recommendedTip.titleKey)}</Text>
            <Text style={styles.recommendedTipText}>{t(recommendedTip.detailKey)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveCheckinButton} onPress={onSaveDailyCheckin}>
          <View style={styles.saveCheckinButtonLeading}>
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.saveCheckinButtonText}>{t("tips.saveToday")}</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.viewHistoryButton} onPress={onOpenCheckInHistory}>
          <View style={styles.viewHistoryButtonLeading}>
            <Ionicons name="calendar-outline" size={18} color="#8F72C5" />
          </View>
          <Text style={styles.viewHistoryButtonText}>
            {t("tips.viewHistory")} {symptomLogs.length > 0 && `(${symptomLogs.length})`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#8F72C5" />
        </TouchableOpacity>
      </View>

      <View style={styles.tipsSectionWrap}>
        <View style={styles.tipsSectionHeader}>
          <Text style={styles.tipsSectionTitle}>{t("tips.helpfulTips")}</Text>
          <View style={styles.tipsSectionBadge}>
            <MaterialCommunityIcons name="lightbulb-on" size={16} color="#F7B84B" />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tipsGridScroll}>
          {GIRL_TIPS.map((tip) => {
            const tipStyle = TIP_VISUALS[tip.titleKey] ?? DEFAULT_TIP_VISUAL;

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
        colors={pickThemeValue(resolvedTheme, ["#F8F4FF", "#FFFFFF"], ["#2A2236", "#1B1827"])}
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
                  transform: [
                    {
                      scale: breathingRippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
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
                  transform: [
                    {
                      scale: breathingRippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1.1],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          <Animated.View style={[styles.breathingMainCircle, { transform: [{ scale: breathingScale }] }]}>
            <LinearGradient
              colors={pickThemeValue(resolvedTheme, ["#E9DFFF", "#F5F0FF"], ["#4A3D63", "#352C4B"])}
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
              {isBreathingRunning
                ? activeBreathingStep?.labelKey
                  ? t(activeBreathingStep.labelKey)
                  : t("breathing.breathe")
                : breathingPhase === "done"
                  ? t("breathing.doneGuide")
                  : t("breathing.ready")}
            </Text>
            {isBreathingRunning && <Text style={styles.breathingTimerText}>{breathingSecondsLeft}s</Text>}
          </View>
        </View>

        <Text style={styles.breathingDescription}>{breathingGuideText}</Text>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.breathingStartButton, isBreathingRunning && styles.breathingStopButton]}
          onPress={isBreathingRunning ? () => onStopBreathingSession("ready") : onStartBreathingSession}>
          <Text style={styles.breathingStartButtonText}>
            {isBreathingRunning
              ? t("breathing.stopExercise")
              : breathingPhase === "done"
                ? t("breathing.startAgain")
                : t("breathing.startBreathing")}
          </Text>
          {!isBreathingRunning && (
            <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>
      </LinearGradient>
    </ScrollView>
  );
}
