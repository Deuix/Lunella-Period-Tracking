import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PUSH_INSTALLATION_ID_STORAGE_KEY = "push_installation_id";
const DEFAULT_PUSH_PROFILE_SYNC_FUNCTION_NAME = "push-profile-sync";
const DEFAULT_DAILY_REMINDER_HOUR = 9;

type PushRegistrationResult = {
  permissionGranted: boolean;
  token: string | null;
  reason: "unsupported_platform" | "simulator" | "permission_denied" | "registration_failed" | null;
};

export type PushProfileSyncPayload = {
  installationId: string;
  expoPushToken: string | null;
  remindersEnabled: boolean;
  fertilityRemindersEnabled: boolean;
  ovulationRemindersEnabled: boolean;
  cycleLength: number;
  periodLength: number;
  lastPeriodDateISO: string;
  language: string;
  timeZone: string;
  dailyReminderHour: number;
};

function resolveSupabaseFunctionUrl(functionName: string): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL_MISSING");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`;
}

function getPushProfileSyncFunctionName(): string {
  const explicitFunctionName = process.env.EXPO_PUBLIC_PUSH_PROFILE_SYNC_FUNCTION_NAME?.trim();
  return explicitFunctionName || DEFAULT_PUSH_PROFILE_SYNC_FUNCTION_NAME;
}

function resolveExpoProjectId(): string | null {
  const easProjectId = Constants.easConfig?.projectId;
  if (easProjectId) {
    return easProjectId;
  }

  const extraProjectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas
    ?.projectId;

  return extraProjectId ?? null;
}

function createInstallationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getDefaultDailyReminderHour(): number {
  return DEFAULT_DAILY_REMINDER_HOUR;
}

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
}

export async function ensurePushInstallationId(): Promise<string> {
  const existingId = await AsyncStorage.getItem(PUSH_INSTALLATION_ID_STORAGE_KEY);
  if (existingId) {
    return existingId;
  }

  const nextId = createInstallationId();
  await AsyncStorage.setItem(PUSH_INSTALLATION_ID_STORAGE_KEY, nextId);
  return nextId;
}

export async function clearPushInstallationId(): Promise<void> {
  await AsyncStorage.removeItem(PUSH_INSTALLATION_ID_STORAGE_KEY);
}

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return {
      permissionGranted: false,
      token: null,
      reason: "unsupported_platform",
    };
  }

  if (!Device.isDevice) {
    return {
      permissionGranted: false,
      token: null,
      reason: "simulator",
    };
  }

  try {
    const currentPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermissions.status;

    if (finalStatus !== "granted") {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") {
      return {
        permissionGranted: false,
        token: null,
        reason: "permission_denied",
      };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = resolveExpoProjectId();
    const pushToken = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    return {
      permissionGranted: true,
      token: pushToken.data,
      reason: null,
    };
  } catch {
    return {
      permissionGranted: false,
      token: null,
      reason: "registration_failed",
    };
  }
}

export async function syncPushProfileToSupabase(payload: PushProfileSyncPayload): Promise<void> {
  const endpoint = resolveSupabaseFunctionUrl(getPushProfileSyncFunctionName());
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY_MISSING");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "PUSH_PROFILE_SYNC_FAILED");
  }
}
