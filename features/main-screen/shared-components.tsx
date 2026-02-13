import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "./styles";
import type { NumberAdjusterProps } from "./types";

export function DecorativeBackground() {
  return (
    <View pointerEvents="none" style={styles.decorLayer}>
      <LinearGradient
        colors={["#C9C3F2", "#EFCFDA", "#FFF9FC"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MaterialCommunityIcons
        name="flower-tulip-outline"
        size={34}
        color="#B09ACF"
        style={[styles.decorIcon, { top: 72, left: 22 }]}
      />
      <MaterialCommunityIcons
        name="flower-poppy"
        size={24}
        color="#D8A8C7"
        style={[styles.decorIcon, { top: 124, right: 26 }]}
      />
      <MaterialCommunityIcons
        name="flower"
        size={28}
        color="#CAA8D9"
        style={[styles.decorIcon, { top: "44%", left: 26 }]}
      />
      <MaterialCommunityIcons
        name="flower-outline"
        size={22}
        color="#E2BFD4"
        style={[styles.decorIcon, { top: "58%", right: 34 }]}
      />
      <View style={[styles.bubble, { top: "26%", left: "68%" }]} />
      <View style={[styles.bubble, { top: "36%", left: "18%", width: 8, height: 8 }]} />
      <View style={[styles.bubble, { top: "48%", right: "16%", width: 10, height: 10 }]} />
    </View>
  );
}

export function WelcomeIllustration() {
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
