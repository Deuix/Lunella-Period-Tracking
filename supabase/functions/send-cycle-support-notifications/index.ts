import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 500;

type NotificationType = "period" | "fertility" | "ovulation";
type SupportedLanguage = "en" | "tr" | "ru";

type RequestPayload = {
  dryRun?: unknown;
  limit?: unknown;
};

type ProfileRow = {
  installation_id: string;
  expo_push_token: string | null;
  reminders_enabled: boolean;
  fertility_reminders_enabled: boolean;
  ovulation_reminders_enabled: boolean;
  cycle_length: number;
  period_length: number;
  last_period_start_date: string;
  language: string;
  timezone: string;
  daily_reminder_hour: number;
  last_support_notification_on: string | null;
  last_fertility_notification_on: string | null;
  last_ovulation_notification_on: string | null;
};

type Candidate = {
  installationId: string;
  token: string;
  localDateISO: string;
  periodDay: number;
  type: NotificationType;
  title: string;
  body: string;
};

type Ticket = {
  status?: string;
  details?: {
    error?: string;
  };
};

const TITLES: Record<SupportedLanguage, Record<NotificationType, string>> = {
  en: {
    period: "You are doing enough today",
    fertility: "A gentle reminder for your body",
    ovulation: "Today is ovulation day",
  },
  tr: {
    period: "Bugun elinden gelen yeterli",
    fertility: "Bedenin icin nazik bir hatirlatma",
    ovulation: "Bugun yumurtlama gunu",
  },
  ru: {
    period: "Segodnya ty uzhe delaesh dostatochno",
    fertility: "Myagkoe napominanie dlya tvogo tela",
    ovulation: "Segodnya den ovulyacii",
  },
};

const PERIOD_MESSAGES: Record<SupportedLanguage, string[]> = {
  en: [
    "Day 1 can feel heavy. Be extra gentle with yourself.",
    "Rest is also progress. Your body is doing important work.",
    "Small care counts: water, warmth, and one deep breath.",
    "Low energy is okay. You still deserve kindness today.",
    "You made it this far day by day. That is real strength.",
    "Move slowly if you need to. You are not behind.",
    "Protect your energy today. A soft day is still a good day.",
  ],
  tr: [
    "1. gun zor gecebilir. Kendine ekstra nazik ol.",
    "Dinlenmek de ilerlemedir. Vucudun onemli bir is yapiyor.",
    "Kucuk bakim bile degerli: su, sicaklik, derin bir nefes.",
    "Dusuk enerji normal. Yine de sefkati hak ediyorsun.",
    "Buraya gun gun geldin. Bu gercek bir guc.",
    "Yavaslamak sorun degil. Geri kalmiyorsun.",
    "Enerjini koru. Sakin bir gun de iyi bir gundur.",
  ],
  ru: [
    "1-y den mozhet byt tyazhelym. Bud k sebe berezhnee.",
    "Otdyh - eto tozhe progress. Tvoe telo delaet vazhnuyu rabotu.",
    "Malenkaya zabota vazhna: voda, teplo i odin glubokiy vdoh.",
    "Nizkaya energiya normalna. Ty vse ravno zasluzhivaesh myagkosti.",
    "Ty prosla etot put den za dnem. Eto nastoyashaya sila.",
    "Mozhno zamedlitsya. Ty ne otstaesh.",
    "Beregi energiyu. Spokoinyi den tozhe horoshii den.",
  ],
};

const FERTILITY_MESSAGES: Record<SupportedLanguage, string[]> = {
  en: [
    "Your body may feel more sensitive now. Stay hydrated and check in with yourself.",
    "This is a fertile window day. Gentle movement and rest can both help.",
    "A calm breath and a glass of water are a good start for today.",
    "Your body is giving signals. Listen with kindness, not pressure.",
    "Take a mindful pause today. You deserve steady support.",
    "You are in your fertile window. Protect your peace and energy.",
    "One small act of care today still matters a lot.",
  ],
  tr: [
    "Bugun bedenin daha hassas olabilir. Su ic ve kendini dinle.",
    "Dogurgan pencere gunundesin. Nazik hareket ya da dinlenme iyi gelir.",
    "Bugune sakin bir nefes ve bir bardak su ile basla.",
    "Bedenin sinyaller veriyor. Baski degil, sefkatle dinle.",
    "Bugun kisa bir mindful mola ver. Dengeli destek hak ediyorsun.",
    "Dogurgan pencere gunundesin. Huzurunu ve enerjini koru.",
    "Bugun atilan kucuk bir bakim adimi bile cok degerli.",
  ],
  ru: [
    "Segodnya telo mozhet byt bolee chuvstvitelnym. Peyi vodu i slushai sebya.",
    "Eto den fertylnogo okna. Legkoe dvizhenie ili otdyh mogut pomoch.",
    "Nachi den so spokoinogo vdokha i stakana vody.",
    "Telo podaet signaly. Slushai ego s myagkostyu, bez davleniya.",
    "Sdelay segodnya korotkuyu osoznannuyu pauzu. Ty zasluzhivaesh podderzhki.",
    "Ty v fertylnom okne. Beregi spokojstvie i energiyu.",
    "Dazhe odin malenkii shag zaboty segodnya ochen vazhen.",
  ],
};

const OVULATION_MESSAGES: Record<SupportedLanguage, string[]> = {
  en: [
    "Ovulation day can bring extra sensitivity. Be gentle with your body today.",
    "Today is ovulation day. Listen to your body and move at your pace.",
    "A short check-in: breathe, hydrate, and choose softness where possible.",
  ],
  tr: [
    "Yumurtlama gunu hassasiyet artabilir. Bugun bedenine nazik davran.",
    "Bugun yumurtlama gunu. Bedenini dinle ve kendi temponda ilerle.",
    "Kisa bir kontrol: nefes al, su ic, mumkunse daha yumusak ol.",
  ],
  ru: [
    "V den ovulyacii chuvstvitelnost mozhet vyrasti. Bud berezhna k sebe.",
    "Segodnya den ovulyacii. Slushai telo i dvigaisya v svoem tempe.",
    "Korotkaya proverka: vdoh, voda i bolshe myagkosti dlya sebya.",
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeLanguage(value: string): SupportedLanguage {
  const lowered = value.toLowerCase();
  if (lowered.startsWith("tr")) return "tr";
  if (lowered.startsWith("ru")) return "ru";
  return "en";
}

function parseDateUTC(dateISO: string): number | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!matched) return null;

  return Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
}

function getLocalDateParts(now: Date, timeZone: string): { dateISO: string; hour: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  return {
    dateISO: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hour,
  };
}

function getCycleDay(localDateISO: string, lastPeriodStartDateISO: string, cycleLength: number): number | null {
  const localDateUTC = parseDateUTC(localDateISO);
  const startDateUTC = parseDateUTC(lastPeriodStartDateISO);

  if (localDateUTC === null || startDateUTC === null) {
    return null;
  }

  const daysSinceStart = Math.floor((localDateUTC - startDateUTC) / DAY_MS);
  const cycleOffset = ((daysSinceStart % cycleLength) + cycleLength) % cycleLength;
  return cycleOffset + 1;
}

function pickMessage(language: SupportedLanguage, type: NotificationType, dayIndex: number): string {
  if (type === "period") {
    const messages = PERIOD_MESSAGES[language];
    return messages[clamp(dayIndex, 1, messages.length) - 1];
  }

  if (type === "fertility") {
    const messages = FERTILITY_MESSAGES[language];
    return messages[clamp(dayIndex, 1, messages.length) - 1];
  }

  const messages = OVULATION_MESSAGES[language];
  return messages[(dayIndex - 1) % messages.length];
}

function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function buildCandidate(row: ProfileRow, now: Date): { candidate: Candidate | null; isInvalidToken: boolean } {
  if (!row.expo_push_token) {
    return { candidate: null, isInvalidToken: false };
  }

  const token = row.expo_push_token;
  const validToken = token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
  if (!validToken) {
    return { candidate: null, isInvalidToken: true };
  }

  const local = getLocalDateParts(now, row.timezone || "UTC");
  if (local.hour !== clamp(row.daily_reminder_hour, 0, 23)) {
    return { candidate: null, isInvalidToken: false };
  }

  const cycleLength = clamp(row.cycle_length, 21, 45);
  const periodLength = clamp(row.period_length, 1, 14);
  const cycleDay = getCycleDay(local.dateISO, row.last_period_start_date, cycleLength);

  if (!cycleDay) {
    return { candidate: null, isInvalidToken: false };
  }

  const language = normalizeLanguage(row.language || "en");
  const isTwoDaysBeforeExpectedPeriod = cycleDay === cycleLength - 1;

  if (
    row.reminders_enabled
    && isTwoDaysBeforeExpectedPeriod
    && row.last_support_notification_on !== local.dateISO
  ) {
    return {
      candidate: {
        installationId: row.installation_id,
        token,
        localDateISO: local.dateISO,
        periodDay: cycleDay,
        type: "period",
        title: "Lunella reminder",
        body: "Your next period may start inn 2 days.",
      },
      isInvalidToken: false,
    };
  }

  if (row.reminders_enabled && cycleDay <= periodLength && row.last_support_notification_on !== local.dateISO) {
    return {
      candidate: {
        installationId: row.installation_id,
        token,
        localDateISO: local.dateISO,
        periodDay: cycleDay,
        type: "period",
        title: TITLES[language].period,
        body: pickMessage(language, "period", cycleDay),
      },
      isInvalidToken: false,
    };
  }

  const ovulationDay = clamp(cycleLength - 14, 1, cycleLength);
  const fertilityStart = clamp(ovulationDay - 5, 1, cycleLength);
  const fertilityEnd = clamp(ovulationDay + 1, 1, cycleLength);
  const isOvulationDay = cycleDay === ovulationDay;

  if (
    isOvulationDay
    && row.ovulation_reminders_enabled
    && row.last_ovulation_notification_on !== local.dateISO
  ) {
    return {
      candidate: {
        installationId: row.installation_id,
        token,
        localDateISO: local.dateISO,
        periodDay: cycleDay,
        type: "ovulation",
        title: TITLES[language].ovulation,
        body: pickMessage(language, "ovulation", 1),
      },
      isInvalidToken: false,
    };
  }

  const isFertilityWindowDay = cycleDay >= fertilityStart && cycleDay <= fertilityEnd;
  const canUseFertilityMessage = !isOvulationDay || !row.ovulation_reminders_enabled;

  if (
    row.fertility_reminders_enabled
    && isFertilityWindowDay
    && canUseFertilityMessage
    && row.last_fertility_notification_on !== local.dateISO
  ) {
    const fertilityDayIndex = cycleDay - fertilityStart + 1;

    return {
      candidate: {
        installationId: row.installation_id,
        token,
        localDateISO: local.dateISO,
        periodDay: cycleDay,
        type: "fertility",
        title: TITLES[language].fertility,
        body: pickMessage(language, "fertility", fertilityDayIndex),
      },
      isInvalidToken: false,
    };
  }

  return { candidate: null, isInvalidToken: false };
}

async function sendChunk(chunk: Candidate[]): Promise<Ticket[]> {
  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      chunk.map((item) => ({
        to: item.token,
        title: item.title,
        body: item.body,
        sound: "default",
        data: {
          type: item.type,
          periodDay: item.periodDay,
        },
      })),
    ),
  });

  const payload = (await response.json()) as { data?: Ticket[] };
  if (!response.ok || !Array.isArray(payload.data)) {
    throw new Error("Expo push request failed");
  }

  return payload.data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expectedSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (expectedSecret && req.headers.get("x-cron-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let requestBody: RequestPayload = {};

  try {
    if ((req.headers.get("content-length") ?? "0") !== "0") {
      requestBody = (await req.json()) as RequestPayload;
    }
  } catch {
    requestBody = {};
  }

  const dryRun = Boolean(requestBody.dryRun);
  const limit = clamp(toInt(requestBody.limit, DEFAULT_LIMIT), 1, 1000);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from("cycle_push_profiles")
      .select(
        "installation_id, expo_push_token, reminders_enabled, fertility_reminders_enabled, ovulation_reminders_enabled, cycle_length, period_length, last_period_start_date, language, timezone, daily_reminder_hour, last_support_notification_on, last_fertility_notification_on, last_ovulation_notification_on",
      )
      .or("reminders_enabled.eq.true,fertility_reminders_enabled.eq.true,ovulation_reminders_enabled.eq.true")
      .not("expo_push_token", "is", null)
      .limit(limit);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as ProfileRow[];
    const now = new Date();

    const invalidIds = new Set<string>();
    const candidates: Candidate[] = [];

    for (const row of rows) {
      const result = buildCandidate(row, now);
      if (result.isInvalidToken) {
        invalidIds.add(row.installation_id);
        continue;
      }

      if (result.candidate) {
        candidates.push(result.candidate);
      }
    }

    const dueByType = {
      period: candidates.filter((item) => item.type === "period").length,
      fertility: candidates.filter((item) => item.type === "fertility").length,
      ovulation: candidates.filter((item) => item.type === "ovulation").length,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          dryRun: true,
          scanned: rows.length,
          due: candidates.length,
          dueByType,
          invalidTokens: invalidIds.size,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sent: Candidate[] = [];
    let failed = 0;

    for (const chunk of splitIntoChunks(candidates, 100)) {
      const tickets = await sendChunk(chunk);

      tickets.forEach((ticket, index) => {
        const candidate = chunk[index];
        if (!candidate) {
          return;
        }

        if (ticket.status === "ok") {
          sent.push(candidate);
          return;
        }

        if (ticket.details?.error === "DeviceNotRegistered") {
          invalidIds.add(candidate.installationId);
          return;
        }

        failed += 1;
      });
    }

    for (const item of sent) {
      const updatePayload: Record<string, string | number | null> = {
        push_token_invalid_at: null,
      };

      if (item.type === "period") {
        updatePayload.last_support_notification_on = item.localDateISO;
        updatePayload.last_support_period_day = item.periodDay;
      }

      if (item.type === "fertility") {
        updatePayload.last_fertility_notification_on = item.localDateISO;
      }

      if (item.type === "ovulation") {
        updatePayload.last_ovulation_notification_on = item.localDateISO;
      }

      const { error: updateError } = await supabase
        .from("cycle_push_profiles")
        .update(updatePayload)
        .eq("installation_id", item.installationId);

      if (updateError) {
        throw updateError;
      }
    }

    if (invalidIds.size > 0) {
      const { error: invalidateError } = await supabase
        .from("cycle_push_profiles")
        .update({
          expo_push_token: null,
          push_token_invalid_at: new Date().toISOString(),
        })
        .in("installation_id", Array.from(invalidIds));

      if (invalidateError) {
        throw invalidateError;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: rows.length,
        due: candidates.length,
        dueByType,
        sent: sent.length,
        failed,
        invalidTokens: invalidIds.size,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to dispatch supportive notifications",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
