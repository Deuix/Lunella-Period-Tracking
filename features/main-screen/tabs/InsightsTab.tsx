import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { WEEK_DAY_KEYS } from "../constants";
import { styles } from "../styles";
import { isSameDay, startOfDay } from "../utils";
import type { DecoratedCalendarDay, MonthlyInsight } from "../types";

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
  decoratedInsightsDays: DecoratedCalendarDay[];
  hasProAccess: boolean;
  insightsMonthLabel: string;
  monthOptions: Date[];
  monthlyInsights: MonthlyInsight[];
  onSelectCalendarDate: (date: Date) => void;
  onSelectInsightsMonthIndex: (index: number) => void;
  proInsightsSummary: ProInsightsSummary;
  renderPregnancyProbabilityCard: () => ReactNode;
  selectedCalendarDate: Date;
  selectedInsightsMonthIndex: number;
  showProUpsell: () => void;
  cycleLength: number;
  periodLength: number;
  t: TranslationFn;
};

export function InsightsTab({
  averageSymptomScore,
  currentMonthInsight,
  cycleLength,
  dateLocale,
  decoratedInsightsDays,
  hasProAccess,
  insightsMonthLabel,
  monthOptions,
  monthlyInsights,
  onSelectCalendarDate,
  onSelectInsightsMonthIndex,
  periodLength,
  proInsightsSummary,
  renderPregnancyProbabilityCard,
  selectedCalendarDate,
  selectedInsightsMonthIndex,
  showProUpsell,
  t,
}: InsightsTabProps) {
  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>{t("insights.cycleStatistics")}</Text>
      <Text style={styles.infoFootnote}>{t("insights.trackPatterns")}</Text>

      <View style={styles.calendarCard}>
        <Text style={styles.calendarCardTitle}>{insightsMonthLabel}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthChipRow}>
          {monthOptions.map((monthOption, index) => {
            const isSelected = selectedInsightsMonthIndex === index;
            return (
              <TouchableOpacity
                key={`insights-${monthOption.toISOString()}`}
                style={[styles.monthChip, isSelected && styles.monthChipActive]}
                onPress={() => onSelectInsightsMonthIndex(index)}>
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
                onPress={() => onSelectCalendarDate(startOfDay(day.date))}
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
                flow: proInsightsSummary.topFlowKey
                  ? t(`flow.${proInsightsSummary.topFlowKey}`)
                  : t("pro.noData"),
              })}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.proInsightsLockedText}>{t("pro.lockedDescription")}</Text>
            <TouchableOpacity style={styles.proInsightsUnlockButton} onPress={showProUpsell}>
              <Text style={styles.proInsightsUnlockText}>{t("pro.unlockButton")}</Text>
            </TouchableOpacity>
          </>
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
                      <View
                        style={[
                          styles.cycleMiniBar,
                          { width: `${periodPercent}%`, backgroundColor: "#D4587A" },
                        ]}
                      />
                      <View
                        style={[
                          styles.cycleMiniBar,
                          { width: `${fertilityPercent}%`, backgroundColor: "#4A9D6E" },
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
