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

type OpenRouterStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | OpenRouterContentPart[];
    };
  }>;
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

function extractStreamDeltaText(content: string | OpenRouterContentPart[] | undefined): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => part.text ?? "")
    .join("");
}

function collectTextFromSseLines(lines: string[]): string {
  let fullText = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "data: [DONE]") {
      continue;
    }

    if (!line.startsWith("data: ")) {
      continue;
    }

    try {
      const parsed = JSON.parse(line.slice(6)) as OpenRouterStreamChunk;
      const delta = extractStreamDeltaText(parsed?.choices?.[0]?.delta?.content);
      if (delta) {
        fullText += delta;
      }
    } catch {
      // Skip malformed JSON chunks.
    }
  }

  return fullText;
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
    // React Native fetch can lack ReadableStream support. Fall back to parsing
    // the buffered response payload (or one non-stream request if needed).
    const rawResponse = await response.text();

    let jsonPayload: OpenRouterResponse | null = null;
    try {
      jsonPayload = JSON.parse(rawResponse) as OpenRouterResponse;
    } catch {
      jsonPayload = null;
    }

    const nonStreamText = extractAssistantText(jsonPayload?.choices?.[0]?.message?.content);
    if (nonStreamText) {
      onToken(nonStreamText);
      return nonStreamText;
    }

    const sseText = collectTextFromSseLines(rawResponse.split(/\r?\n/));
    if (sseText) {
      onToken(sseText);
      return sseText;
    }

    const fallbackText = await getOpenRouterChatReply(messages);
    onToken(fallbackText);
    return fallbackText;
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let pending = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";

      const nextText = collectTextFromSseLines(lines);
      if (nextText) {
        fullText += nextText;
        onToken(nextText);
      }
    }

    const tail = `${pending}${decoder.decode()}`;
    if (tail.trim()) {
      const tailText = collectTextFromSseLines(tail.split(/\r?\n/));
      if (tailText) {
        fullText += tailText;
        onToken(tailText);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText) {
    const fallbackText = await getOpenRouterChatReply(messages);
    onToken(fallbackText);
    return fallbackText;
  }

  return fullText;
}
