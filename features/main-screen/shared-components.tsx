import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMainScreenStyles } from "./styles";
import { pickThemeValue, useMainScreenTheme } from "./theme";
import type { NumberAdjusterProps } from "./types";

export function DecorativeBackground() {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();

  return (
    <View pointerEvents="none" style={styles.decorLayer}>
      <LinearGradient
        colors={pickThemeValue(resolvedTheme, ["#C9C3F2", "#EFCFDA", "#FFF9FC"], ["#2C1E39", "#1E1A2C", "#13111B"])}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MaterialCommunityIcons
        name="flower-tulip-outline"
        size={34}
        color={pickThemeValue(resolvedTheme, "#B09ACF", "#8A74AE")}
        style={[styles.decorIcon, { top: 72, left: 22 }]}
      />
      <MaterialCommunityIcons
        name="flower-poppy"
        size={24}
        color={pickThemeValue(resolvedTheme, "#D8A8C7", "#A26E94")}
        style={[styles.decorIcon, { top: 124, right: 26 }]}
      />
      <MaterialCommunityIcons
        name="flower"
        size={28}
        color={pickThemeValue(resolvedTheme, "#CAA8D9", "#8661A1")}
        style={[styles.decorIcon, { top: "44%", left: 26 }]}
      />
      <MaterialCommunityIcons
        name="flower-outline"
        size={22}
        color={pickThemeValue(resolvedTheme, "#E2BFD4", "#A97F9A")}
        style={[styles.decorIcon, { top: "58%", right: 34 }]}
      />
      <View style={[styles.bubble, { top: "26%", left: "68%" }]} />
      <View style={[styles.bubble, { top: "36%", left: "18%", width: 8, height: 8 }]} />
      <View style={[styles.bubble, { top: "48%", right: "16%", width: 10, height: 10 }]} />
    </View>
  );
}

export function WelcomeIllustration() {
  const styles = useMainScreenStyles();

  return (
    <View style={styles.welcomeIllustration}>
      <Image
        source={require("@/assets/images/onboarding.png")}
        style={styles.onboardingImage}
        contentFit="contain"
      />
    </View>
  );
}

export function NumberAdjuster({ label, hint, value, min, max, onChange }: NumberAdjusterProps) {
  const styles = useMainScreenStyles();

  return (
    <View style={styles.adjusterWrap}>
      <View style={styles.adjusterTextWrap}>
        <Text style={styles.adjusterLabel}>{label}</Text>
        <Text style={styles.adjusterHint}>{hint}</Text>
      </View>
      <View style={styles.adjusterControls}>
        <Pressable
          style={[styles.adjustButton, value <= min && styles.adjustButtonDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={styles.adjustButtonText}>-</Text>
        </Pressable>
        <Text style={styles.adjustValue}>{value}</Text>
        <Pressable
          style={[styles.adjustButton, value >= max && styles.adjustButtonDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={styles.adjustButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
