import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ScrollView } from "react-native";
import { streamOpenRouterChatReply } from "../../../services/openrouter";
import { FREE_AI_DAILY_LIMIT, GOAL_OPTIONS, INITIAL_AI_MESSAGES } from "../constants";
import { startOfDay } from "../utils";
import type { AiMessage, CycleContext, GoalOption, HomeTab } from "../types";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type SendMessageResult = "sent" | "locked" | "ignored";

type UseAiAssistantParams = {
  activeTab: HomeTab;
  cycleContext: CycleContext;
  cycleLength: number;
  goals: GoalOption[];
  hasProAccess: boolean;
  language: string;
  periodLength: number;
  t: TranslationFn;
};

type UseAiAssistantResult = {
  aiInput: string;
  setAiInput: (value: string) => void;
  aiMessages: AiMessage[];
  setAiMessages: (messages: AiMessage[]) => void;
  aiMessagesScrollRef: MutableRefObject<ScrollView | null>;
  aiUsageCount: number;
  setAiUsageCount: (value: number) => void;
  aiUsageDateISO: string;
  setAiUsageDateISO: (value: string) => void;
  freeAiRemaining: number;
  isAiLockedForFree: boolean;
  isAiTyping: boolean;
  sendAiMessage: (messageText: string) => Promise<SendMessageResult>;
};

export function useAiAssistant({
  activeTab,
  cycleContext,
  cycleLength,
  goals,
  hasProAccess,
  language,
  periodLength,
  t,
}: UseAiAssistantParams): UseAiAssistantResult {
  const todayISO = startOfDay(new Date()).toISOString();
  const [aiInput, setAiInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiUsageDateISO, setAiUsageDateISOState] = useState(todayISO);
  const [aiUsageCount, setAiUsageCountState] = useState(0);
  const [aiMessages, setAiMessagesState] = useState<AiMessage[]>(INITIAL_AI_MESSAGES);
  const aiMessagesScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const currentDayISO = startOfDay(new Date()).toISOString();
    if (aiUsageDateISO !== currentDayISO) {
      setAiUsageDateISOState(currentDayISO);
      setAiUsageCountState(0);
    }
  }, [aiUsageDateISO]);

  useEffect(() => {
    if (activeTab !== "ai") {
      return;
    }

    const timeout = setTimeout(() => {
      aiMessagesScrollRef.current?.scrollToEnd({ animated: true });
    }, 40);

    return () => {
      clearTimeout(timeout);
    };
  }, [activeTab, aiMessages, isAiTyping]);

  useEffect(() => {
    if (activeTab !== "ai" && isAiTyping) {
      setIsAiTyping(false);
    }
  }, [activeTab, isAiTyping]);

  const freeAiRemaining = Math.max(0, FREE_AI_DAILY_LIMIT - aiUsageCount);
  const isAiLockedForFree = !hasProAccess && freeAiRemaining <= 0;

  const sendAiMessage = useCallback(
    async (messageText: string): Promise<SendMessageResult> => {
      const trimmedMessage = messageText.trim();
      if (!trimmedMessage || isAiTyping) {
        return "ignored";
      }

      if (isAiLockedForFree) {
        return "locked";
      }

      const userMessage: AiMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmedMessage,
      };

      const aiHistoryForPrompt = aiMessages
        .filter((message) => message.id !== "assistant-welcome")
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.text,
        }));

      setAiMessagesState((currentMessages) => [...currentMessages, userMessage]);
      setAiInput("");
      setIsAiTyping(true);

      const goalLine =
        goals.length > 0
          ? goals
              .map((goal) => {
                const found = GOAL_OPTIONS.find((option) => option.id === goal);
                return found ? t(found.labelKey) : goal;
              })
              .join(", ")
          : t("ai.generalCycleTracking");

      const assistantSystemPrompt = [
        "You are Lunella AI, a professional menstrual and reproductive health assistant in a mobile app.",
        "Provide clear, evidence-based, and compassionate guidance in a professional tone.",
        "You are educational support only: do not diagnose, do not prescribe medication doses, and do not replace clinical care.",
        "If there are red flags (severe pain, heavy bleeding, fainting, fever, pregnancy complications, or self-harm thoughts), advise urgent in-person medical care.",
        "Keep uncertainty honest and avoid making up facts.",
        "Answer in the user's language, with concise structure: direct answer, practical next steps, when to seek care.",
        "Always end with a short disclaimer in the same language saying this is general information, not medical diagnosis.",
        `User language: ${language}.`,
        `Cycle length: ${cycleLength}. Period length: ${periodLength}.`,
        `Next period starts in ${cycleContext.daysUntilNextPeriod} days (${cycleContext.nextPeriodStart.toISOString()}).`,
        `Next ovulation in ${cycleContext.daysUntilOvulation} days (${cycleContext.nextOvulationDate.toISOString()}).`,
        `Fertility window: ${cycleContext.fertilityStartDate.toISOString()} - ${cycleContext.fertilityEndDate.toISOString()}.`,
        `User goals: ${goalLine}.`,
        "Keep answers concise (about 4-8 sentences) unless the user asks for more depth.",
      ].join(" ");

      let responseText = "";
      let usedLiveAi = false;

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: AiMessage = {
        id: assistantMessageId,
        role: "assistant",
        text: "",
      };

      setAiMessagesState((currentMessages) => [...currentMessages, assistantMessage]);

      try {
        responseText = await streamOpenRouterChatReply(
          [
            {
              role: "system",
              content: assistantSystemPrompt,
            },
            ...aiHistoryForPrompt,
            {
              role: "user",
              content: trimmedMessage,
            },
          ],
          (token: string) => {
            setAiMessagesState((currentMessages) => {
              const updatedMessages = [...currentMessages];
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              if (lastMessage?.id === assistantMessageId) {
                lastMessage.text += token;
              }
              return updatedMessages;
            });
          },
        );
        usedLiveAi = true;
      } catch (error) {
        console.warn("Lunella AI request failed", error);
        responseText = t("ai.connectionError");

        setAiMessagesState((currentMessages) => {
          const updatedMessages = [...currentMessages];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage?.id === assistantMessageId) {
            lastMessage.text = responseText;
          }
          return updatedMessages;
        });
      }

      if (!hasProAccess && usedLiveAi) {
        setAiUsageCountState((currentCount) => currentCount + 1);
      }

      setIsAiTyping(false);
      return "sent";
    },
    [
      aiMessages,
      cycleContext.daysUntilNextPeriod,
      cycleContext.daysUntilOvulation,
      cycleContext.fertilityEndDate,
      cycleContext.fertilityStartDate,
      cycleContext.nextOvulationDate,
      cycleContext.nextPeriodStart,
      cycleLength,
      goals,
      hasProAccess,
      isAiLockedForFree,
      isAiTyping,
      language,
      periodLength,
      t,
    ],
  );

  return {
    aiInput,
    setAiInput,
    aiMessages,
    setAiMessages: setAiMessagesState,
    aiMessagesScrollRef,
    aiUsageCount,
    setAiUsageCount: setAiUsageCountState,
    aiUsageDateISO,
    setAiUsageDateISO: setAiUsageDateISOState,
    freeAiRemaining,
    isAiLockedForFree,
    isAiTyping,
    sendAiMessage,
  };
}
