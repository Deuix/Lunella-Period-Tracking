import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Animated,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;

interface TipCardProps {
  title: string;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  bgColor: string;
  index: number;
  onPress: () => void;
}

function TipCard({ title, detail, icon, color, bgColor, index, onPress }: TipCardProps) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          tipStyles.card,
          { backgroundColor: bgColor },
          pressed && tipStyles.cardPressed,
        ]}>
        <View style={tipStyles.cardHeader}>
          <View style={[tipStyles.iconContainer, { backgroundColor: color }]}>
            <MaterialCommunityIcons name={icon} size={28} color="#FFFFFF" />
          </View>
          <View style={tipStyles.expandIcon}>
            <MaterialCommunityIcons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={color}
            />
          </View>
        </View>
        
        <Text style={[tipStyles.title, { color }]}>{title}</Text>
        
        <View style={tipStyles.divider} />
        
        <Text 
          style={tipStyles.detail}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {detail}
        </Text>

        {isExpanded && (
          <Animated.View style={tipStyles.actionRow}>
            <MaterialCommunityIcons name="heart-outline" size={16} color={color} />
            <Text style={[tipStyles.actionText, { color }]}>Save for later</Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface TipsSectionProps {
  tips: Array<{ titleKey: string; detailKey: string }>;
}

export function TipsSection({ tips }: TipsSectionProps) {
  const { t } = useTranslation();
  const [activeTipIndex, setActiveTipIndex] = useState<number | null>(null);
  const [scrollX] = useState(new Animated.Value(0));

  const tipConfig = [
    { icon: "tea", color: "#D4587A", bgColor: "#FFF0F5", gradient: ["#FFE5EC", "#FFF0F5"] },
    { icon: "moon-waning-crescent", color: "#7B5EA8", bgColor: "#F5EEFA", gradient: ["#EBE3F7", "#F5EEFA"] },
    { icon: "water", color: "#4A9D6E", bgColor: "#EDF7F2", gradient: ["#E0F5EA", "#EDF7F2"] },
    { icon: "food-apple", color: "#E6A84D", bgColor: "#FFF7ED", gradient: ["#FFF0E0", "#FFF7ED"] },
    { icon: "walk", color: "#8F72C5", bgColor: "#F5EEFA", gradient: ["#EBE3F7", "#F5EEFA"] },
  ];

  const handleTipPress = (index: number) => {
    setActiveTipIndex(activeTipIndex === index ? null : index);
  };

  return (
    <View style={tipStyles.container}>
      {/* Header Section */}
      <LinearGradient
        colors={["#F8F4FF", "#FFFFFF"]}
        style={tipStyles.headerGradient}>
        <View style={tipStyles.headerContent}>
          <View style={tipStyles.headerLeft}>
            <View style={tipStyles.headerIconContainer}>
              <MaterialCommunityIcons name="lightbulb-on" size={28} color="#F7B84B" />
            </View>
            <View style={tipStyles.headerTextContainer}>
              <Text style={tipStyles.headerTitle}>{t("tips.helpfulTips")}</Text>
              <Text style={tipStyles.headerSubtitle}>
                {t("tips.dailyWellness", { count: tips.length })}
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              tipStyles.refreshButton,
              pressed && tipStyles.refreshButtonPressed,
            ]}
            onPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
            <MaterialCommunityIcons name="refresh" size={20} color="#8F72C5" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Tips Carousel */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={tipStyles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}>
        {tips.map((tip, index) => {
          const config = tipConfig[index % tipConfig.length];
          return (
            <TipCard
              key={tip.titleKey}
              title={t(tip.titleKey)}
              detail={t(tip.detailKey)}
              icon={config.icon as any}
              color={config.color}
              bgColor={config.bgColor}
              index={index}
              onPress={() => handleTipPress(index)}
            />
          );
        })}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={tipStyles.paginationContainer}>
        {tips.map((_, index) => {
          const isActive = activeTipIndex === index;
          return (
            <Animated.View
              key={index}
              style={[
                tipStyles.paginationDot,
                isActive && tipStyles.paginationDotActive,
              ]}
            />
          );
        })}
      </View>

      {/* Quick Tips Grid */}
      <View style={tipStyles.quickTipsContainer}>
        <Text style={tipStyles.quickTipsTitle}>{t("tips.quickTips")}</Text>
        <View style={tipStyles.quickTipsGrid}>
          <Pressable style={tipStyles.quickTipItem}>
            <View style={[tipStyles.quickTipIcon, { backgroundColor: "#FCEEF4" }]}>
              <MaterialCommunityIcons name="water" size={20} color="#D4587A" />
            </View>
            <Text style={tipStyles.quickTipText}>{t("tips.hydration")}</Text>
          </Pressable>
          
          <Pressable style={tipStyles.quickTipItem}>
            <View style={[tipStyles.quickTipIcon, { backgroundColor: "#F0E8FA" }]}>
              <MaterialCommunityIcons name="bed" size={20} color="#7B5EA8" />
            </View>
            <Text style={tipStyles.quickTipText}>{t("tips.sleep")}</Text>
          </Pressable>
          
          <Pressable style={tipStyles.quickTipItem}>
            <View style={[tipStyles.quickTipIcon, { backgroundColor: "#ECF8F1" }]}>
              <MaterialCommunityIcons name="food-apple" size={20} color="#4A9D6E" />
            </View>
            <Text style={tipStyles.quickTipText}>{t("tips.nutrition")}</Text>
          </Pressable>
          
          <Pressable style={tipStyles.quickTipItem}>
            <View style={[tipStyles.quickTipIcon, { backgroundColor: "#FFF3EA" }]}>
              <MaterialCommunityIcons name="run" size={20} color="#E6A84D" />
            </View>
            <Text style={tipStyles.quickTipText}>{t("tips.exercise")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const tipStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  headerGradient: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF9E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2F2436",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A7C8D",
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7DCE6",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: {
    backgroundColor: "#F0E8FA",
    transform: [{ scale: 0.95 }],
  },
  scrollContent: {
    paddingHorizontal: 6,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  expandIcon: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  detail: {
    fontSize: 14,
    lineHeight: 22,
    color: "#5E5265",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E7DCE6",
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: "#8F72C5",
  },
  quickTipsContainer: {
    marginTop: 20,
  },
  quickTipsTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2F2436",
    marginBottom: 12,
  },
  quickTipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickTipItem: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E7DCE6",
    alignItems: "center",
    gap: 8,
  },
  quickTipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4A4050",
    textAlign: "center",
  },
});
