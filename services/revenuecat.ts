import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  LOG_LEVEL,
  type MakePurchaseResult,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, {
  PAYWALL_RESULT,
  type CustomerCenterCallbacks,
} from "react-native-purchases-ui";

export type RevenueCatPlanId = "monthly" | "yearly" | "lifetime";

export type RevenueCatPackagesMap = Record<RevenueCatPlanId, PurchasesPackage | null>;

const DEFAULT_PACKAGES: RevenueCatPackagesMap = {
  monthly: null,
  yearly: null,
  lifetime: null,
};

const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_PRO_ENTITLEMENT ?? "lunella_pro";

let isConfigured = false;

function getPlatformApiKey(): string | null {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_RC_IOS_API_KEY ?? null;
  }

  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY ?? null;
  }

  return null;
}

async function ensureConfigured(): Promise<boolean> {
  if (isConfigured) {
    return true;
  }

  return initializeRevenueCat();
}

export function getRevenueCatEntitlementId(): string {
  return ENTITLEMENT_ID;
}

export function isRevenueCatReady(): boolean {
  return isConfigured;
}

export function hasLunellaProEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
  return Boolean(customerInfo?.entitlements.active[ENTITLEMENT_ID]);
}

export function getPackagesFromOffering(offering: PurchasesOffering | null): RevenueCatPackagesMap {
  if (!offering) {
    return { ...DEFAULT_PACKAGES };
  }

  const packages = { ...DEFAULT_PACKAGES };
  offering.availablePackages.forEach((availablePackage) => {
    if (availablePackage.identifier === "monthly") {
      packages.monthly = availablePackage;
      return;
    }

    if (availablePackage.identifier === "yearly") {
      packages.yearly = availablePackage;
      return;
    }

    if (availablePackage.identifier === "lifetime") {
      packages.lifetime = availablePackage;
    }
  });

  return packages;
}

export function isRevenueCatUserCancelledError(error: unknown): boolean {
  if (typeof error !== "object" || !error) {
    return false;
  }

  const err = error as { userCancelled?: boolean };
  return Boolean(err.userCancelled);
}

export async function initializeRevenueCat(appUserId?: string): Promise<boolean> {
  const apiKey = getPlatformApiKey();

  if (!apiKey) {
    return false;
  }

  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return false;
  }

  if (!isConfigured) {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    Purchases.configure({
      apiKey,
      appUserID: appUserId,
    });

    isConfigured = true;
    return true;
  }

  if (appUserId) {
    await Purchases.logIn(appUserId);
  }

  return true;
}

export function addRevenueCatCustomerInfoListener(listener: CustomerInfoUpdateListener): () => void {
  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!(await ensureConfigured())) {
    return null;
  }

  return Purchases.getCustomerInfo();
}

export async function getRevenueCatOfferings(): Promise<PurchasesOfferings | null> {
  if (!(await ensureConfigured())) {
    return null;
  }

  return Purchases.getOfferings();
}

export async function purchaseRevenueCatPackage(
  selectedPackage: PurchasesPackage,
): Promise<MakePurchaseResult> {
  if (!(await ensureConfigured())) {
    throw new Error("RC_NOT_CONFIGURED");
  }

  return Purchases.purchasePackage(selectedPackage);
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  if (!(await ensureConfigured())) {
    throw new Error("RC_NOT_CONFIGURED");
  }

  return Purchases.restorePurchases();
}

export async function presentRevenueCatPaywallIfNeeded(
  offering?: PurchasesOffering | null,
): Promise<PAYWALL_RESULT> {
  if (!(await ensureConfigured())) {
    throw new Error("RC_NOT_CONFIGURED");
  }

  return RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ENTITLEMENT_ID,
    offering: offering ?? undefined,
    displayCloseButton: true,
  });
}

export async function presentRevenueCatPaywall(
  offering?: PurchasesOffering | null,
): Promise<PAYWALL_RESULT> {
  if (!(await ensureConfigured())) {
    throw new Error("RC_NOT_CONFIGURED");
  }

  return RevenueCatUI.presentPaywall({
    offering: offering ?? undefined,
    displayCloseButton: true,
  });
}

export async function presentRevenueCatCustomerCenter(
  callbacks?: CustomerCenterCallbacks,
): Promise<void> {
  if (!(await ensureConfigured())) {
    throw new Error("RC_NOT_CONFIGURED");
  }

  await RevenueCatUI.presentCustomerCenter({ callbacks });
}
