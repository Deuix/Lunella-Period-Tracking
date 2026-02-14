import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMainScreenStyles } from "./styles";
import { pickThemeValue, useMainScreenTheme } from "./theme";
import type { NumberAdjusterProps } from "./types";

type CelebrationConfettiProps = {
  runId: number;
};

type ConfettiPiece = {
  id: string;
  color: string;
  delayRatio: number;
  driftX: number;
  rotateStart: number;
  rotateEnd: number;
  size: number;
  startX: number;
  topOffset: number;
  type: 'rect' | 'circle';
  wobbleFreq: number;
  wobbleShift: number;
};

const CONFETTI_COLORS = [
  "#FF85A2", // Pink
  "#A29BFE", // Lavender
  "#74B9FF", // Sky Blue
  "#55EFC4", // Mint
  "#FAB1A0", // Peach
  "#FFEAA7", // Soft Yellow
  "#FD79A8", // Bright Pink
  "#81ECEC", // Robin's Egg
];

function createConfettiPieces(width: number, count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `piece-${index}`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? "#8F72C5",
    delayRatio: Math.random() * 0.45,
    driftX: (Math.random() - 0.5) * 160,
    rotateStart: Math.random() * 360,
    rotateEnd: 720 + Math.random() * 720,
    size: 6 + Math.random() * 10,
    startX: Math.random() * width,
    topOffset: Math.random() * 120,
    type: Math.random() > 0.3 ? 'rect' : 'circle',
    wobbleFreq: 3 + Math.random() * 4,
    wobbleShift: Math.random() * Math.PI * 2,
  }));
}

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

export function CelebrationConfetti({ runId }: CelebrationConfettiProps) {
  const { width, height } = useWindowDimensions();
  const [isVisible, setIsVisible] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(() => createConfettiPieces(width, 55), [runId, width]);

  useEffect(() => {
    if (runId <= 0) {
      return;
    }

    setIsVisible(true);
    animation.setValue(0);

    const anim = Animated.timing(animation, {
      toValue: 1,
      duration: 2400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    });

    anim.start(({ finished }) => {
      if (finished) {
        setIsVisible(false);
      }
    });

    return () => {
      anim.stop();
    };
  }, [animation, runId]);

  if (!isVisible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={localStyles.confettiOverlay}>
      {pieces.map((piece) => {
        const pieceProgress = animation.interpolate({
          inputRange: [piece.delayRatio, 1],
          outputRange: [0, 1],
          extrapolate: "clamp",
        });

        const translateY = pieceProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-32 - piece.topOffset, height + 64],
        });

        // Add a wobble effect to the horizontal movement
        const translateX = pieceProgress.interpolate({
          inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
          outputRange: [
            piece.startX,
            piece.startX + piece.driftX * 0.2 + Math.sin(piece.wobbleShift + 1) * 10,
            piece.startX + piece.driftX * 0.4 + Math.sin(piece.wobbleShift + 2) * 15,
            piece.startX + piece.driftX * 0.6 + Math.sin(piece.wobbleShift + 3) * 10,
            piece.startX + piece.driftX * 0.8 + Math.sin(piece.wobbleShift + 4) * 15,
            piece.startX + piece.driftX + Math.sin(piece.wobbleShift + 5) * 10,
          ],
        });

        const rotate = pieceProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${piece.rotateStart}deg`, `${piece.rotateEnd}deg`],
        });

        // Scale up then slightly down for a more organic feel
        const scale = pieceProgress.interpolate({
          inputRange: [0, 0.1, 0.9, 1],
          outputRange: [0.4, 1, 1, 0.7],
        });

        const opacity = pieceProgress.interpolate({
          inputRange: [0, 0.1, 0.8, 1],
          outputRange: [0, 1, 1, 0],
        });

        return (
          <Animated.View
            key={`${runId}-${piece.id}`}
            style={[
              localStyles.confettiPiece,
              {
                backgroundColor: piece.color,
                height: piece.type === 'circle' ? piece.size : piece.size * 0.6,
                opacity,
                width: piece.size,
                borderRadius: piece.type === 'circle' ? piece.size / 2 : 2,
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                  { rotateX: rotate },
                  { scale }
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const localStyles = StyleSheet.create({
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 60,
  },
  confettiPiece: {
    borderRadius: 2,
    left: 0,
    position: "absolute",
    top: 0,
  },
});
