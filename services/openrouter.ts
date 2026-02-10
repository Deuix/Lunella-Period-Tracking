export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function getOpenRouterChatReply(
  messages: OpenRouterChatMessage[],
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  const model = process.env.EXPO_PUBLIC_OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY_MISSING");
  }

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.EXPO_PUBLIC_OPENROUTER_SITE_URL ?? "https://localhost",
      "X-Title": process.env.EXPO_PUBLIC_OPENROUTER_APP_NAME ?? "Lunella",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
    }),
  });

  const data = (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    const errorMessage = data.error?.message ?? "OpenRouter request failed";
    throw new Error(errorMessage);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OPENROUTER_EMPTY_RESPONSE");
  }

  return content;
}
