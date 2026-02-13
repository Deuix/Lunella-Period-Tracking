import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { WEEK_DAY_KEYS } from "../constants";
import { styles } from "../styles";
import { isSameDay, startOfDay } from "../utils";
import type { DecoratedCalendarDay } from "../types";

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
  name: string;
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
  name,
  onPeriodStartsToday,
  onProfilePress,
  onSelectCalendarDate,
  onSelectMonthIndex,
  renderPregnancyProbabilityCard,
  selectedCalendarDate,
  selectedMonthIndex,
  t,
}: HomeTabProps) {
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthChipRow}>
        {monthOptions.map((monthOption, index) => {
          const isSelected = selectedMonthIndex === index;
          return (
            <TouchableOpacity
              key={monthOption.toISOString()}
              style={[styles.monthChip, isSelected && styles.monthChipActive]}
              onPress={() => onSelectMonthIndex(index)}>
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

        <TouchableOpacity style={styles.periodStartButton} onPress={onPeriodStartsToday}>
          <MaterialCommunityIcons name="water-plus" size={20} color="#FFFFFF" />
          <Text style={styles.periodStartButtonText}>{t("home.periodStartsToday")}</Text>
        </TouchableOpacity>

        {renderPregnancyProbabilityCard()}
      </View>
    </ScrollView>
  );
}
