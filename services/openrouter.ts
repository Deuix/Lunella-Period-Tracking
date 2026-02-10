export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterContentPart = {
  text?: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenRouterContentPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_PROXY_FUNCTION_NAME = "openrouter-proxy-public";

function resolveProxyUrl(): string | null {
  const explicitProxyUrl = process.env.EXPO_PUBLIC_OPENROUTER_PROXY_URL?.trim();
  if (explicitProxyUrl) {
    return explicitProxyUrl;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    return null;
  }

  const functionName =
    process.env.EXPO_PUBLIC_OPENROUTER_PROXY_FUNCTION_NAME?.trim() ?? DEFAULT_PROXY_FUNCTION_NAME;

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`;
}

function extractAssistantText(content: string | OpenRouterContentPart[] | undefined): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function getOpenRouterChatReply(
  messages: OpenRouterChatMessage[],
): Promise<string> {
  const endpoint = resolveProxyUrl();
  if (!endpoint) {
    throw new Error("OPENROUTER_PROXY_URL_MISSING");
  }

  const model = process.env.EXPO_PUBLIC_OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const proxyKey = process.env.EXPO_PUBLIC_OPENROUTER_PROXY_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (anonKey) {
    headers.apikey = anonKey;
    headers.Authorization = `Bearer ${anonKey}`;
  }

  if (proxyKey) {
    headers["x-lunella-proxy-key"] = proxyKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
    }),
  });

  const rawResponse = await response.text();

  let data: OpenRouterResponse | null = null;
  try {
    data = JSON.parse(rawResponse) as OpenRouterResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage = data?.error?.message ?? (rawResponse || "OpenRouter request failed");
    throw new Error(errorMessage);
  }

  const content = extractAssistantText(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("OPENROUTER_EMPTY_RESPONSE");
  }

  return content;
}

export async function streamOpenRouterChatReply(
  messages: OpenRouterChatMessage[],
  onToken: (token: string) => void,
): Promise<string> {
  const endpoint = resolveProxyUrl();
  if (!endpoint) {
    throw new Error("OPENROUTER_PROXY_URL_MISSING");
  }

  const model = process.env.EXPO_PUBLIC_OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const proxyKey = process.env.EXPO_PUBLIC_OPENROUTER_PROXY_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (anonKey) {
    headers.apikey = anonKey;
    headers.Authorization = `Bearer ${anonKey}`;
  }

  if (proxyKey) {
    headers["x-lunella-proxy-key"] = proxyKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      stream: true,
    }),
  });

  if (!response.ok) {
    const rawResponse = await response.text();
    let data: OpenRouterResponse | null = null;
    try {
      data = JSON.parse(rawResponse) as OpenRouterResponse;
    } catch {
      data = null;
    }
    const errorMessage = data?.error?.message ?? (rawResponse || "OpenRouter request failed");
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("STREAM_NOT_SUPPORTED");
  }

  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.trim() || line.trim() === "data: [DONE]") continue;
        if (!line.startsWith("data: ")) continue;

        try {
          const jsonStr = line.slice(6); // Remove "data: " prefix
          const parsed = JSON.parse(jsonStr);
          const delta = parsed?.choices?.[0]?.delta?.content;

          if (delta) {
            fullText += delta;
            onToken(delta);
          }
        } catch (e) {
          // Skip malformed JSON chunks
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText) {
    throw new Error("OPENROUTER_EMPTY_RESPONSE");
  }

  return fullText;
}
