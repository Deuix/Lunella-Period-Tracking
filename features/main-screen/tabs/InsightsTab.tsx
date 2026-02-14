import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useMainScreenStyles } from "../styles";
import { pickThemeValue, useMainScreenTheme } from "../theme";
import type { MonthlyInsight } from "../types";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type ProInsightsSummary = {
  logsCount: number;
  highDiscomfortDays: number;
  topMoodKey: string | null;
  topFlowKey: string | null;
};

type InsightsTabProps = {
  averageSymptomScore: number;
  currentMonthInsight: MonthlyInsight | undefined;
  dateLocale: string;
  hasProAccess: boolean;
  monthlyInsights: MonthlyInsight[];
  proInsightsSummary: ProInsightsSummary;
  showProUpsell: () => void;
  cycleLength: number;
  periodLength: number;
  t: TranslationFn;
};

function formatProCardHeaderLabel(label: string) {
  const sanitizedLabel = label.trim();
  const firstSpaceIndex = sanitizedLabel.indexOf(" ");
  if (firstSpaceIndex === -1) {
    return sanitizedLabel;
  }

  return `${sanitizedLabel.slice(0, firstSpaceIndex)}\n${sanitizedLabel.slice(firstSpaceIndex + 1)}`;
}

export function InsightsTab({
  averageSymptomScore,
  currentMonthInsight,
  cycleLength,
  dateLocale,
  hasProAccess,
  monthlyInsights,
  periodLength,
  proInsightsSummary,
  showProUpsell,
  t,
}: InsightsTabProps) {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();

  const topMoodLabel = formatProCardHeaderLabel(t("pro.insightsTopMood", { mood: "" }));
  const topFlowLabel = formatProCardHeaderLabel(t("pro.insightsTopFlow", { flow: "" }));

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.insightSectionTitle}>
        {currentMonthInsight?.monthLabel ?? t("insights.thisMonth")}{" "}
        {t("insights.cycleStatistics").toLowerCase()}
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
          <Text style={styles.statSubtext}>
            {currentMonthInsight?.periodRangeLabel ?? t("insights.noPredictedPeriodDays")}
          </Text>
        </View>

        <View style={[styles.statCard, styles.statCardPeach]}>
          <Text style={styles.statTitle}>{t("insights.ovulationDay")}</Text>
          <Text style={styles.statValue}>
            {currentMonthInsight?.ovulationDayOfMonth
              ? t("insights.dayLabel", { day: currentMonthInsight.ovulationDayOfMonth })
              : t("insights.notInMonth")}
          </Text>
          <Text style={styles.statSubtext}>
            {currentMonthInsight?.monthLabel ?? t("insights.thisMonth")}
          </Text>
        </View>

        <View style={[styles.statCard, styles.statCardMint]}>
          <Text style={styles.statTitle}>{t("insights.avgSymptoms")}</Text>
          <Text style={styles.statValue}>{averageSymptomScore}</Text>
          <Text style={styles.statSubtext}>{t("insights.predictedMonthlyScore")}</Text>
        </View>
      </View>

      {/* Advanced Cycle Insights - Pro Section */}
      <View style={styles.proSectionCard}>
        <View style={styles.proSectionHeader}>
          <View style={styles.proSectionTitleRow}>
            <Text style={styles.proSectionTitle}>{t("pro.advancedInsightsTitle")}</Text>
          </View>
          {hasProAccess && (
            <View style={styles.proSectionBadge}>
              <MaterialCommunityIcons
                name="crown"
                size={12}
                color={pickThemeValue(resolvedTheme, "#F7B84B", "#F1C66C")}
              />
              <Text style={styles.proSectionBadgeText}>PRO</Text>
            </View>
          )}
        </View>

        {hasProAccess ? (
          <View style={styles.proContentGrid}>
            {/* Cycle Health Score */}
            <View style={[styles.proInsightCard, styles.proInsightCardGradient]}>
              <View style={styles.proInsightCardHeader}>
                <View style={styles.proInsightIconSmall}>
                  <MaterialCommunityIcons name="heart-pulse" size={16} color="#E91E63" />
                </View>
                <Text style={styles.proInsightCardLabel}>{t("pro.cycleHealthScore")}</Text>
              </View>
              <Text style={styles.proInsightCardValue}>
                {proInsightsSummary.logsCount > 0 ? Math.max(70, 100 - proInsightsSummary.highDiscomfortDays * 5) : "--"}
              </Text>
              <Text style={styles.proInsightCardSubtext}>
                {proInsightsSummary.logsCount > 0 ? t("pro.basedOnLogs", { count: proInsightsSummary.logsCount }) : t("pro.noData")}
              </Text>
              <View style={styles.proInsightProgressBar}>
                <View
                  style={[
                    styles.proInsightProgressFill,
                    { width: `${proInsightsSummary.logsCount > 0 ? Math.max(70, 100 - proInsightsSummary.highDiscomfortDays * 5) : 0}%` }
                  ]}
                />
              </View>
            </View>

            {/* Regularity Indicator */}
            <View style={[styles.proInsightCard, styles.proInsightCardLavender]}>
              <View style={styles.proInsightCardHeader}>
                <View style={styles.proInsightIconSmall}>
                  <MaterialCommunityIcons name="calendar-check" size={16} color="#8F72C5" />
                </View>
                <Text style={styles.proInsightCardLabel}>{t("pro.cycleRegularity")}</Text>
              </View>
              <Text style={styles.proInsightCardValue}>
                {monthlyInsights.length >= 3 ? t("pro.regular") : t("pro.learning")}
              </Text>
              <Text style={styles.proInsightCardSubtext}>
                {monthlyInsights.length >= 3
                  ? t("pro.regularDesc", { count: monthlyInsights.length })
                  : t("pro.learningDesc", { count: 3 - monthlyInsights.length })
                }
              </Text>
            </View>

            {/* Top Mood */}
            <View style={[styles.proInsightCard, styles.proInsightCardMint]}>
              <View style={styles.proInsightCardHeader}>
                <View style={styles.proInsightIconSmall}>
                  <MaterialCommunityIcons name="emoticon-happy" size={16} color="#4CAF50" />
                </View>
                <Text style={styles.proInsightCardLabel}>{topMoodLabel}</Text>
              </View>
              <Text style={styles.proInsightCardValue}>
                {proInsightsSummary.topMoodKey ? t(proInsightsSummary.topMoodKey) : t("pro.noData")}
              </Text>
              <Text style={styles.proInsightCardSubtext}>
                {t("pro.mostFrequent")}
              </Text>
            </View>

            {/* Top Flow */}
            <View style={[styles.proInsightCard, styles.proInsightCardPeach]}>
              <View style={styles.proInsightCardHeader}>
                <View style={styles.proInsightIconSmall}>
                  <MaterialCommunityIcons name="water" size={16} color="#FF9800" />
                </View>
                <Text style={styles.proInsightCardLabel}>{topFlowLabel}</Text>
              </View>
              <Text style={styles.proInsightCardValue}>
                {proInsightsSummary.topFlowKey ? t(`flow.${proInsightsSummary.topFlowKey}`) : t("pro.noData")}
              </Text>
              <Text style={styles.proInsightCardSubtext}>
                {t("pro.mostFrequent")}
              </Text>
            </View>

            {/* Discomfort Days */}
            <View style={[styles.proInsightCard, styles.proInsightCardRose]}>
              <View style={styles.proInsightCardHeader}>
                <View style={styles.proInsightIconSmall}>
                  <MaterialCommunityIcons name="thermometer" size={16} color="#E91E63" />
                </View>
                <Text style={styles.proInsightCardLabel}>{t("pro.discomfortDays")}</Text>
              </View>
              <Text style={styles.proInsightCardValue}>
                {proInsightsSummary.highDiscomfortDays}
              </Text>
              <Text style={styles.proInsightCardSubtext}>
                {t("pro.highDiscomfortDesc")}
              </Text>
            </View>

            {/* Prediction Accuracy */}
            <View style={[styles.proInsightCard, styles.proInsightCardBlue]}>
              <View style={styles.proInsightCardHeader}>
                <View style={styles.proInsightIconSmall}>
                  <MaterialCommunityIcons name="target" size={16} color="#2196F3" />
                </View>
                <Text style={styles.proInsightCardLabel}>{t("pro.predictionAccuracy")}</Text>
              </View>
              <Text style={styles.proInsightCardValue}>
                {monthlyInsights.length >= 2 ? "85%" : "--"}
              </Text>
              <Text style={styles.proInsightCardSubtext}>
                {monthlyInsights.length >= 2 ? t("pro.improving") : t("pro.moreDataNeeded")}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.proLockedContent}>
            {/* Preview Cards */}
            <View style={styles.proPreviewRow}>
              <View style={[styles.proPreviewCard, styles.proPreviewCardGradient]}>
                <MaterialCommunityIcons name="heart-pulse" size={24} color="#E91E63" />
                <Text style={styles.proPreviewLabel}>{t("pro.cycleHealthScore")}</Text>
                <View style={styles.proPreviewBlur} />
              </View>
              <View style={[styles.proPreviewCard, styles.proPreviewCardLavender]}>
                <MaterialCommunityIcons name="calendar-check" size={24} color="#8F72C5" />
                <Text style={styles.proPreviewLabel}>{t("pro.cycleRegularity")}</Text>
                <View style={styles.proPreviewBlur} />
              </View>
            </View>

            <View style={styles.proPreviewRow}>
              <View style={[styles.proPreviewCard, styles.proPreviewCardMint]}>
                <MaterialCommunityIcons name="emoticon-happy" size={24} color="#4CAF50" />
                <Text style={styles.proPreviewLabel}>{t("pro.moodPatterns")}</Text>
                <View style={styles.proPreviewBlur} />
              </View>
              <View style={[styles.proPreviewCard, styles.proPreviewCardPeach]}>
                <MaterialCommunityIcons name="chart-line" size={24} color="#FF9800" />
                <Text style={styles.proPreviewLabel}>{t("pro.detailedTrends")}</Text>
                <View style={styles.proPreviewBlur} />
              </View>
            </View>

            {/* Features List */}
            <View style={styles.proFeaturesList}>
              <View style={styles.proFeatureItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#8F72C5" />
                <Text style={styles.proFeatureText}>{t("pro.featureHealthScore")}</Text>
              </View>
              <View style={styles.proFeatureItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#8F72C5" />
                <Text style={styles.proFeatureText}>{t("pro.featureRegularity")}</Text>
              </View>
              <View style={styles.proFeatureItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#8F72C5" />
                <Text style={styles.proFeatureText}>{t("pro.featurePatterns")}</Text>
              </View>
              <View style={styles.proFeatureItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#8F72C5" />
                <Text style={styles.proFeatureText}>{t("pro.featurePredictions")}</Text>
              </View>
            </View>

            {/* CTA Button */}
            <TouchableOpacity style={styles.proUnlockButton} onPress={showProUpsell}>
              <View style={styles.proUnlockButtonContent}>
                <MaterialCommunityIcons name="crown" size={18} color="#FFFFFF" />
                <Text style={styles.proUnlockButtonText}>{t("pro.unlockProFeatures")}</Text>
              </View>
              <Text style={styles.proUnlockButtonSubtext}>{t("pro.unlockSubtext")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>
            {t("insights.cycleOverview", { year: new Date().getFullYear() })}
          </Text>
          <View style={styles.overviewBadge}>
            <MaterialCommunityIcons name="chart-line" size={16} color="#8F72C5" />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cycleOverviewScroll}>
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
                      <View
                        style={[
                          styles.cycleStatIcon,
                          { backgroundColor: pickThemeValue(resolvedTheme, "#FCEEF4", "#5C2C3A") },
                        ]}>
                        <MaterialCommunityIcons name="water" size={14} color="#D4587A" />
                      </View>
                      <Text style={[styles.cycleStatValue, isActive && styles.cycleStatValueActive]}>
                        {insight.periodDays}
                      </Text>
                      <Text style={styles.cycleStatLabel}>{t("insights.periodDays")}</Text>
                    </View>

                    <View style={styles.cycleStatItem}>
                      <View
                        style={[
                          styles.cycleStatIcon,
                          { backgroundColor: pickThemeValue(resolvedTheme, "#FDF1D9", "#5E4B2A") },
                        ]}>
                        <MaterialCommunityIcons name="egg" size={14} color="#E6A84D" />
                      </View>
                      <Text style={[styles.cycleStatValue, isActive && styles.cycleStatValueActive]}>
                        {insight.ovulationDays}
                      </Text>
                      <Text style={styles.cycleStatLabel}>{t("insights.ovulationDays")}</Text>
                    </View>

                    <View style={styles.cycleStatItem}>
                      <View
                        style={[
                          styles.cycleStatIcon,
                          { backgroundColor: pickThemeValue(resolvedTheme, "#ECF8F1", "#2F5742") },
                        ]}>
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
                      <View
                        style={[
                          styles.cycleMiniBar,
                          {
                            width: `${periodPercent}%`,
                            backgroundColor: pickThemeValue(resolvedTheme, "#D4587A", "#EA7397"),
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.cycleMiniBar,
                          {
                            width: `${fertilityPercent}%`,
                            backgroundColor: pickThemeValue(resolvedTheme, "#4A9D6E", "#66BB8A"),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.cycleMiniChartLabel}>
                      {t("insights.activeDays", { count: totalActiveDays })}
                    </Text>
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
              {Math.round(
                monthlyInsights.reduce((sum, i) => sum + i.fertilityDays, 0) / monthlyInsights.length,
              )}
            </Text>
            <Text style={styles.cycleSummaryLabel}>{t("insights.avgFertility")}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
