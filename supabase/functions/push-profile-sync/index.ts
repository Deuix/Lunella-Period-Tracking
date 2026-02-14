import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SyncPayload = {
  installationId?: unknown;
  expoPushToken?: unknown;
  remindersEnabled?: unknown;
  fertilityRemindersEnabled?: unknown;
  ovulationRemindersEnabled?: unknown;
  cycleLength?: unknown;
  periodLength?: unknown;
  lastPeriodDateISO?: unknown;
  language?: unknown;
  timeZone?: unknown;
  dailyReminderHour?: unknown;
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

function normalizeLanguage(value: unknown): "en" | "tr" | "ru" {
  if (typeof value !== "string") {
    return "en";
  }

  const lowered = value.trim().toLowerCase();
  if (lowered.startsWith("tr")) {
    return "tr";
  }

  if (lowered.startsWith("ru")) {
    return "ru";
  }

  return "en";
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(value: unknown): string {
  if (typeof value !== "string") {
    return "UTC";
  }

  const nextValue = value.trim();
  if (!nextValue) {
    return "UTC";
  }

  return isValidTimeZone(nextValue) ? nextValue : "UTC";
}

function normalizeLastPeriodDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function normalizePushToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

  try {
    const payload = (await req.json()) as SyncPayload;

    if (typeof payload.installationId !== "string" || !payload.installationId.trim()) {
      return new Response(JSON.stringify({ error: "installationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const installationId = payload.installationId.trim().slice(0, 160);
    const lastPeriodStartDate = normalizeLastPeriodDate(payload.lastPeriodDateISO);

    if (!lastPeriodStartDate) {
      return new Response(JSON.stringify({ error: "lastPeriodDateISO is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server secrets are not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const cycleLength = clamp(toInt(payload.cycleLength, 28), 21, 45);
    const periodLength = clamp(toInt(payload.periodLength, 5), 1, 14);
    const dailyReminderHour = clamp(toInt(payload.dailyReminderHour, 9), 0, 23);
    const expoPushToken = normalizePushToken(payload.expoPushToken);

    const { error } = await supabase.from("cycle_push_profiles").upsert(
      {
        installation_id: installationId,
        expo_push_token: expoPushToken,
        reminders_enabled: Boolean(payload.remindersEnabled),
        fertility_reminders_enabled: Boolean(payload.fertilityRemindersEnabled),
        ovulation_reminders_enabled: Boolean(payload.ovulationRemindersEnabled),
        cycle_length: cycleLength,
        period_length: periodLength,
        last_period_start_date: lastPeriodStartDate,
        language: normalizeLanguage(payload.language),
        timezone: normalizeTimeZone(payload.timeZone),
        daily_reminder_hour: dailyReminderHour,
        push_token_invalid_at: expoPushToken ? null : undefined,
      },
      { onConflict: "installation_id" },
    );

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to sync push profile",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
