import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { GIRL_TIPS, MENSTRUAL_FLOW_OPTIONS, MOOD_OPTIONS } from "../constants";
import { styles } from "../styles";
import { startOfDay } from "../utils";
import type { BreathPhase, BreathStep, SymptomLogEntry } from "../types";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

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
          <TouchableOpacity onPress={onOpenCheckInHistory}>
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

        <Text style={styles.tipsQuestion}>{t("tips.howDoYouFeel", { name: feelingName })}</Text>
        <Text style={styles.infoFootnote}>{t("tips.pickMoods")}</Text>

        <View style={styles.moodGrid}>
          {MOOD_OPTIONS.map((moodOption) => {
            const isSelected = selectedMoods.includes(moodOption.labelKey);
            return (
              <Pressable
                key={moodOption.labelKey}
                style={[styles.moodChip, isSelected && styles.moodChipActive]}
                onPress={() => onToggleMood(moodOption.labelKey)}>
                <Text style={styles.moodEmoji}>{moodOption.emoji}</Text>
                <Text style={[styles.moodLabel, isSelected && styles.moodLabelActive]}>
                  {t(moodOption.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TouchableOpacity style={styles.saveCheckinButton} onPress={onSaveDailyCheckin}>
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.saveCheckinButtonText}>{t("tips.saveToday")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.viewHistoryButton} onPress={onOpenCheckInHistory}>
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tipsGridScroll}>
          {GIRL_TIPS.map((tip) => {
            const tipIcons: {
              [key: string]: {
                icon: keyof typeof MaterialCommunityIcons.glyphMap;
                color: string;
                bgColor: string;
              };
            } = {
              "girlTips.tip1Title": { icon: "tea", color: "#D4587A", bgColor: "#FCEEF4" },
              "girlTips.tip2Title": { icon: "moon-waning-crescent", color: "#7B5EA8", bgColor: "#F0E8FA" },
              "girlTips.tip3Title": { icon: "water", color: "#4A9D6E", bgColor: "#ECF8F1" },
              "girlTips.tip4Title": { icon: "food-apple", color: "#E6A84D", bgColor: "#FFF3EA" },
              "girlTips.tip5Title": { icon: "walk", color: "#8F72C5", bgColor: "#F0E8FA" },
            };
            const tipStyle = tipIcons[tip.titleKey] || {
              icon: "lightbulb",
              color: "#8F72C5",
              bgColor: "#F0E8FA",
            };

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

      <LinearGradient colors={["#F8F4FF", "#FFFFFF"]} style={styles.breathingContainer}>
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
            <LinearGradient colors={["#E9DFFF", "#F5F0FF"]} style={styles.breathingCircleGradient}>
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
