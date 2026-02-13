import type { MutableRefObject } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Markdown from "react-native-markdown-display";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FREE_AI_DAILY_LIMIT } from "../constants";
import { styles } from "../styles";
import type { AiMessage } from "../types";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type AiTabProps = {
  aiInput: string;
  aiMessages: AiMessage[];
  aiMessagesScrollRef: MutableRefObject<ScrollView | null>;
  aiQuickPrompts: string[];
  freeAiRemaining: number;
  hasProAccess: boolean;
  isAiLockedForFree: boolean;
  isAiTyping: boolean;
  onSendMessage: (message: string) => Promise<void>;
  onShowProUpsell: () => void;
  setAiInput: (value: string) => void;
  t: TranslationFn;
};

export function AiTab({
  aiInput,
  aiMessages,
  aiMessagesScrollRef,
  aiQuickPrompts,
  freeAiRemaining,
  hasProAccess,
  isAiLockedForFree,
  isAiTyping,
  onSendMessage,
  onShowProUpsell,
  setAiInput,
  t,
}: AiTabProps) {
  return (
    <KeyboardAvoidingView
      style={styles.aiPageWrap}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={74}>
      <LinearGradient
        colors={["#F4EDFC", "#FCEEF5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.aiHeroCard}>
        <View>
          <Text style={styles.aiHeroTitle}>{t("ai.heroTitle")}</Text>
          <Text style={styles.aiHeroSubtitle}>{t("ai.heroSubtitle")}</Text>
        </View>
      </LinearGradient>

      <View style={styles.aiQuotaCard}>
        <Text style={styles.aiQuotaTitle}>
          {hasProAccess
            ? t("pro.activePlan")
            : t("pro.aiDailyRemaining", { count: freeAiRemaining, total: FREE_AI_DAILY_LIMIT })}
        </Text>
        {!hasProAccess && (
          <TouchableOpacity onPress={onShowProUpsell}>
            <Text style={styles.aiQuotaUpgradeText}>{t("pro.unlockButton")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        style={styles.aiPromptScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.aiPromptRow}>
        {aiQuickPrompts.map((prompt) => (
          <TouchableOpacity
            key={prompt}
            style={styles.aiPromptChip}
            onPress={() => {
              void onSendMessage(prompt);
            }}>
            <Text style={styles.aiPromptChipText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        ref={aiMessagesScrollRef}
        style={styles.aiMessagesScroll}
        contentContainerStyle={styles.aiMessagesContent}
        showsVerticalScrollIndicator={false}>
        {aiMessages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.aiBubble,
              message.role === "assistant" ? styles.aiAssistantBubble : styles.aiUserBubble,
            ]}>
            {message.role === "assistant" ? (
              <Markdown
                style={{
                  body: { ...styles.aiAssistantBubbleText, margin: 0, padding: 0 },
                  paragraph: { ...styles.aiBubbleText, marginTop: 0, marginBottom: 0 },
                  strong: { fontWeight: "700" },
                  em: { fontStyle: "italic" },
                  text: { ...styles.aiAssistantBubbleText },
                }}>
                {message.id === "assistant-welcome" ? t("ai.welcomeMessage") : message.text}
              </Markdown>
            ) : (
              <Text style={[styles.aiBubbleText, styles.aiUserBubbleText]}>{message.text}</Text>
            )}
          </View>
        ))}

        {isAiTyping && (
          <View style={[styles.aiBubble, styles.aiAssistantBubble, styles.aiTypingBubble]}>
            <Text style={styles.aiAssistantBubbleText}>{t("ai.thinking")}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.aiComposerWrap}>
        <TextInput
          value={aiInput}
          onChangeText={setAiInput}
          placeholder={t("ai.placeholder")}
          placeholderTextColor="#9A8BA0"
          style={styles.aiInput}
          returnKeyType="send"
          editable={!isAiLockedForFree}
          onSubmitEditing={() => {
            void onSendMessage(aiInput);
          }}
        />

        <TouchableOpacity
          style={[
            styles.aiSendButton,
            (!aiInput.trim() || isAiTyping || isAiLockedForFree) && styles.aiSendButtonDisabled,
          ]}
          onPress={() => {
            void onSendMessage(aiInput);
          }}
          disabled={!aiInput.trim() || isAiTyping || isAiLockedForFree}>
          <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
