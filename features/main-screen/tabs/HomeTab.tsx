import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { WEEK_DAY_KEYS } from "../constants";
import { useMainScreenStyles } from "../styles";
import { pickThemeValue, useMainScreenTheme } from "../theme";
import type { DecoratedCalendarDay, ProfileAvatarIcon } from "../types";
import { isSameDay, startOfDay } from "../utils";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type InsightCard = {
  heroValue: string;
  heroLabel: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  accentColor: string;
  iconBgColor: string;
};

type HomeTabProps = {
  dateLocale: string;
  decoratedHomeDays: DecoratedCalendarDay[];
  hasProAccess: boolean;
  insightCards: InsightCard[];
  monthLabel: string;
  monthOptions: Date[];
  profileAvatarIcon: ProfileAvatarIcon;
  onPeriodStartsToday: () => void;
  onProfilePress: () => void;
  onSelectCalendarDate: (date: Date) => void;
  onSelectMonthIndex: (index: number) => void;
  renderPregnancyProbabilityCard: () => ReactNode;
  selectedCalendarDate: Date;
  selectedMonthIndex: number;
  t: TranslationFn;
};

export function HomeTab({
  dateLocale,
  decoratedHomeDays,
  hasProAccess,
  insightCards,
  monthLabel,
  monthOptions,
  profileAvatarIcon,
  onPeriodStartsToday,
  onProfilePress,
  onSelectCalendarDate,
  onSelectMonthIndex,
  renderPregnancyProbabilityCard,
  selectedCalendarDate,
  selectedMonthIndex,
  t,
}: HomeTabProps) {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();

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
          <TouchableOpacity style={styles.profileAvatar} onPress={onProfilePress}>
            <Ionicons name={profileAvatarIcon} size={22} color="#FFFFFF" />
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthChipRow}>
        {monthOptions.map((monthOption, index) => {
          const isSelected = selectedMonthIndex === index;
          return (
            <TouchableOpacity
              key={monthOption.toISOString()}
              style={[styles.monthChip, isSelected && styles.monthChipActive]}
              onPress={() => onSelectMonthIndex(index)}>
              <Text style={[styles.monthChipText, isSelected && styles.monthChipTextActive]}>
                {monthOption.toLocaleDateString(dateLocale, { month: "short" })}
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
          {(() => {
            const isDark = resolvedTheme === "dark";
            return decoratedHomeDays.map((day) => {
              const isSelectedDate = isSameDay(day.date, selectedCalendarDate);
              const isOutsideCurrentMonth = !day.isCurrentMonth;
              const dayCategoryStyle =
              day.category === "period"
                ? isDark
                  ? { backgroundColor: "#D8C3F9" }
                  : styles.dayPeriod
                : day.category === "ovulation"
                  ? isDark
                    ? { backgroundColor: "#BFDDFE" }
                    : styles.dayOvulation
                  : day.category === "fertility"
                    ? isDark
                      ? { backgroundColor: "#CDEFD9" }
                      : styles.dayFertility
                    : null;

            const dayCategoryTextStyle = dayCategoryStyle
              ? {
                  color: "#4C3A70",
                  fontWeight: "700",
                }
              : null;
            const outsideMonthCellStyle =
              isOutsideCurrentMonth && resolvedTheme === "dark" ? { opacity: 0.56 } : null;
            const outsideMonthTextStyle =
              isOutsideCurrentMonth && resolvedTheme === "dark" ? { color: "#7C768C" } : null;

            return (
              <Pressable
                key={day.date.toISOString()}
                onPress={() => onSelectCalendarDate(startOfDay(day.date))}
                style={[
                  styles.dayCell,
                  isOutsideCurrentMonth && styles.dayCellMuted,
                  outsideMonthCellStyle,
                  dayCategoryStyle,
                  isSelectedDate && styles.selectedCalendarDayOutline,
                  day.isToday && styles.todayOutline,
                ]}>
                <Text
                  style={[
                    styles.dayCellText,
                    isOutsideCurrentMonth && styles.dayCellTextMuted,
                    outsideMonthTextStyle,
                    dayCategoryStyle && styles.dayCellTextSelected,
                    dayCategoryTextStyle,
                  ]}>
                  {day.dayNumber}
                  </Text>
                </Pressable>
              );
            });
          })()}
        </View>

        {(() => {
          const isDark = resolvedTheme === "dark";
          return (
            <>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor: isDark
                          ? "#D8C3F9"
                          : pickThemeValue(resolvedTheme, "#D8C3F9", "#9A77C8"),
                      },
                    ]}
                  />
                  <Text style={styles.legendText}>{t("home.legendPeriod")}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor: isDark
                          ? "#BFDDFE"
                          : pickThemeValue(resolvedTheme, "#BFDDFE", "#6A8FC2"),
                      },
                    ]}
                  />
                  <Text style={styles.legendText}>{t("home.legendOvulation")}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor: isDark
                          ? "#CDEFD9"
                          : pickThemeValue(resolvedTheme, "#CDEFD9", "#6CA184"),
                      },
                    ]}
                  />
                  <Text style={styles.legendText}>{t("home.legendFertility")}</Text>
                </View>
              </View>

            </>
          );
        })()}

        <Text style={styles.calendarHintText}>{t("home.calendarHint")}</Text>

        <TouchableOpacity style={styles.periodStartButton} onPress={onPeriodStartsToday}>
          <MaterialCommunityIcons name="water-plus" size={20} color="#FFFFFF" />
          <Text style={styles.periodStartButtonText}>{t("home.periodStartsToday")}</Text>
        </TouchableOpacity>

        {renderPregnancyProbabilityCard()}
      </View>
    </ScrollView>
  );
}
