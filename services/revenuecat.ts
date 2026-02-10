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

const DEFAULT_ENTITLEMENT_ID = "lunella_pro";
const ENTITLEMENT_ID = (process.env.EXPO_PUBLIC_RC_PRO_ENTITLEMENT ?? "").trim() || DEFAULT_ENTITLEMENT_ID;

let isConfigured = false;

function sanitizeEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getPlatformApiKey(): string | null {
  if (Platform.OS === "ios") {
    return sanitizeEnvValue(process.env.EXPO_PUBLIC_RC_IOS_API_KEY);
  }

  if (Platform.OS === "android") {
    return sanitizeEnvValue(process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY);
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
  if (!customerInfo) {
    return false;
  }

  if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
    return true;
  }

  const activeEntitlementIds = Object.keys(customerInfo.entitlements.active);
  if (activeEntitlementIds.length === 1) {
    if (__DEV__) {
      console.warn(
        `[RevenueCat] Expected entitlement "${ENTITLEMENT_ID}" but found "${activeEntitlementIds[0]}". ` +
        "Treating single active entitlement as Pro.",
      );
    }
    return true;
  }

  return false;
}

export function getPackagesFromOffering(offering: PurchasesOffering | null): RevenueCatPackagesMap {
  if (!offering) {
    return { ...DEFAULT_PACKAGES };
  }

  const findByIdentifier = (identifiers: string[]): PurchasesPackage | null => {
    return (
      offering.availablePackages.find((pkg) =>
        identifiers.includes(pkg.identifier.toLowerCase()),
      ) ?? null
    );
  };

  const findByPackageType = (
    packageTypes: ((typeof Purchases.PACKAGE_TYPE)[keyof typeof Purchases.PACKAGE_TYPE])[],
  ): PurchasesPackage | null => {
    return offering.availablePackages.find((pkg) => packageTypes.includes(pkg.packageType)) ?? null;
  };

  const packages = { ...DEFAULT_PACKAGES };
  packages.monthly =
    offering.monthly ??
    findByPackageType([Purchases.PACKAGE_TYPE.MONTHLY]) ??
    findByIdentifier(["monthly", "$rc_monthly"]);

  packages.yearly =
    offering.annual ??
    findByPackageType([Purchases.PACKAGE_TYPE.ANNUAL]) ??
    findByIdentifier(["yearly", "annual", "$rc_annual"]);

  packages.lifetime =
    offering.lifetime ??
    findByPackageType([Purchases.PACKAGE_TYPE.LIFETIME]) ??
    findByIdentifier(["lifetime", "$rc_lifetime"]);

  return packages;
}

export function isRevenueCatUserCancelledError(error: unknown): boolean {
  if (typeof error !== "object" || !error) {
    return false;
  }

  const err = error as { userCancelled?: boolean };
  return Boolean(err.userCancelled);
}

export function isRevenueCatAlreadyPurchasedError(error: unknown): boolean {
  if (typeof error !== "object" || !error) {
    return false;
  }

  const err = error as { code?: string };
  return (
    err.code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR ||
    err.code === Purchases.PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR
  );
}

export async function initializeRevenueCat(appUserId?: string): Promise<boolean> {
  const apiKey = getPlatformApiKey();
  const normalizedAppUserId = sanitizeEnvValue(appUserId);

  if (!apiKey) {
    return false;
  }

  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return false;
  }

  const alreadyConfigured = isConfigured || (await Purchases.isConfigured());

  if (!alreadyConfigured) {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    Purchases.configure({
      apiKey,
      appUserID: normalizedAppUserId ?? undefined,
    });

    isConfigured = true;
  } else {
    isConfigured = true;
  }

  if (normalizedAppUserId) {
    const currentAppUserId = await Purchases.getAppUserID();
    if (currentAppUserId !== normalizedAppUserId) {
      await Purchases.logIn(normalizedAppUserId);
    }
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

export async function syncRevenueCatPurchases(): Promise<CustomerInfo | null> {
  if (!(await ensureConfigured())) {
    return null;
  }

  try {
    const result = await Purchases.syncPurchasesForResult();
    return result.customerInfo;
  } catch {
    return null;
  }
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
