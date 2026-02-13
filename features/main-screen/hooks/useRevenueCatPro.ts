import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  addRevenueCatCustomerInfoListener,
  getPackagesFromOffering,
  getRevenueCatCustomerInfo,
  getRevenueCatOfferings,
  hasLunellaProEntitlement,
  initializeRevenueCat,
  isRevenueCatAlreadyPurchasedError,
  isRevenueCatUserCancelledError,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  presentRevenueCatPaywallIfNeeded,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  syncRevenueCatPurchases,
  type RevenueCatPackagesMap,
  type RevenueCatPlanId,
} from "../../../services/revenuecat";
import { EMPTY_REVENUECAT_PACKAGES } from "../constants";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type UseRevenueCatProParams = {
  isPro: boolean;
  setIsPro: (value: boolean) => void;
  t: TranslationFn;
  onProUnlocked: () => void;
};

type UseRevenueCatProResult = {
  isRevenueCatEnabled: boolean;
  isRevenueCatLoading: boolean;
  revenueCatPackages: RevenueCatPackagesMap;
  refreshRevenueCatState: () => Promise<void>;
  presentPaywall: (ifNeeded?: boolean) => Promise<boolean>;
  purchasePlan: (planId: RevenueCatPlanId) => Promise<boolean>;
  restoreSubscription: () => Promise<boolean>;
  openCustomerCenter: () => Promise<void>;
};

export function useRevenueCatPro({
  isPro,
  setIsPro,
  t,
  onProUnlocked,
}: UseRevenueCatProParams): UseRevenueCatProResult {
  const [isRevenueCatEnabled, setIsRevenueCatEnabled] = useState(false);
  const [isRevenueCatLoading, setIsRevenueCatLoading] = useState(false);
  const [revenueCatPackages, setRevenueCatPackages] =
    useState<RevenueCatPackagesMap>(EMPTY_REVENUECAT_PACKAGES);

  const refreshRevenueCatState = useCallback(async () => {
    if (!isRevenueCatEnabled) {
      return;
    }

    try {
      const [customerInfo, offerings] = await Promise.all([
        getRevenueCatCustomerInfo(),
        getRevenueCatOfferings(),
      ]);

      if (customerInfo) {
        setIsPro(hasLunellaProEntitlement(customerInfo));
      }
      setRevenueCatPackages(getPackagesFromOffering(offerings?.current ?? null));
    } catch (error) {
      if (__DEV__) {
        console.warn("RevenueCat refresh failed", error);
      }
    }
  }, [isRevenueCatEnabled, setIsPro]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupRevenueCat = async () => {
      try {
        const enabled = await initializeRevenueCat();
        setIsRevenueCatEnabled(enabled);

        if (!enabled) {
          return;
        }

        const [customerInfo, offerings] = await Promise.all([
          getRevenueCatCustomerInfo(),
          getRevenueCatOfferings(),
        ]);

        if (customerInfo) {
          setIsPro(hasLunellaProEntitlement(customerInfo));
        }
        setRevenueCatPackages(getPackagesFromOffering(offerings?.current ?? null));

        unsubscribe = addRevenueCatCustomerInfoListener((updatedInfo) => {
          setIsPro(hasLunellaProEntitlement(updatedInfo));
        });
      } catch {
        setIsRevenueCatEnabled(false);
      }
    };

    void setupRevenueCat();

    return () => {
      unsubscribe?.();
    };
  }, [setIsPro]);

  const presentPaywall = useCallback(
    async (ifNeeded = true) => {
      if (!isRevenueCatEnabled) {
        Alert.alert(
          t("pro.revenueCatUnavailableTitle"),
          t("pro.revenueCatUnavailableDescription"),
        );
        return false;
      }

      setIsRevenueCatLoading(true);
      try {
        if (ifNeeded) {
          await presentRevenueCatPaywallIfNeeded();
        } else {
          await presentRevenueCatPaywall();
        }

        const customerInfo = await getRevenueCatCustomerInfo();
        let unlocked = hasLunellaProEntitlement(customerInfo);

        if (!unlocked) {
          const syncedCustomerInfo = await syncRevenueCatPurchases();
          unlocked = hasLunellaProEntitlement(syncedCustomerInfo ?? customerInfo);
        }

        if (unlocked && !isPro) {
          onProUnlocked();
        }
        setIsPro(unlocked);
        await refreshRevenueCatState();

        return unlocked;
      } catch {
        Alert.alert(t("pro.genericErrorTitle"), t("pro.paywallError"));
        return false;
      } finally {
        setIsRevenueCatLoading(false);
      }
    },
    [isPro, isRevenueCatEnabled, onProUnlocked, refreshRevenueCatState, setIsPro, t],
  );

  const purchasePlan = useCallback(
    async (planId: RevenueCatPlanId) => {
      if (!isRevenueCatEnabled) {
        Alert.alert(
          t("pro.revenueCatUnavailableTitle"),
          t("pro.revenueCatUnavailableDescription"),
        );
        return false;
      }

      const selectedPackage = revenueCatPackages[planId];

      if (!selectedPackage) {
        Alert.alert(t("pro.genericErrorTitle"), t("pro.productUnavailable"));
        return false;
      }

      setIsRevenueCatLoading(true);
      try {
        const purchaseResult = await purchaseRevenueCatPackage(selectedPackage);
        let unlocked = hasLunellaProEntitlement(purchaseResult.customerInfo);

        if (!unlocked) {
          const syncedCustomerInfo = await syncRevenueCatPurchases();
          unlocked = hasLunellaProEntitlement(
            syncedCustomerInfo ?? purchaseResult.customerInfo,
          );
        }

        if (unlocked && !isPro) {
          onProUnlocked();
        }
        setIsPro(unlocked);

        if (unlocked) {
          Alert.alert(
            t("pro.purchaseSuccessTitle"),
            t("pro.purchaseSuccessDescription"),
          );
          return true;
        }
      } catch (error) {
        if (isRevenueCatUserCancelledError(error)) {
          return false;
        }

        if (isRevenueCatAlreadyPurchasedError(error)) {
          try {
            const restoredInfo = await restoreRevenueCatPurchases();
            let unlocked = hasLunellaProEntitlement(restoredInfo);

            if (!unlocked) {
              const syncedCustomerInfo = await syncRevenueCatPurchases();
              unlocked = hasLunellaProEntitlement(syncedCustomerInfo ?? restoredInfo);
            }

            if (unlocked && !isPro) {
              onProUnlocked();
            }
            setIsPro(unlocked);

            if (unlocked) {
              Alert.alert(
                t("pro.purchaseSuccessTitle"),
                t("pro.purchaseSuccessDescription"),
              );
              return true;
            }
          } catch {
            // Falls through to generic purchase error.
          }
        }

        Alert.alert(t("pro.genericErrorTitle"), t("pro.purchaseError"));
      } finally {
        setIsRevenueCatLoading(false);
        await refreshRevenueCatState();
      }

      return false;
    },
    [
      isPro,
      isRevenueCatEnabled,
      onProUnlocked,
      refreshRevenueCatState,
      revenueCatPackages,
      setIsPro,
      t,
    ],
  );

  const restoreSubscription = useCallback(async () => {
    if (!isRevenueCatEnabled) {
      Alert.alert(
        t("pro.revenueCatUnavailableTitle"),
        t("pro.revenueCatUnavailableDescription"),
      );
      return false;
    }

    setIsRevenueCatLoading(true);
    try {
      const customerInfo = await restoreRevenueCatPurchases();
      let unlocked = hasLunellaProEntitlement(customerInfo);

      if (!unlocked) {
        const syncedCustomerInfo = await syncRevenueCatPurchases();
        unlocked = hasLunellaProEntitlement(syncedCustomerInfo ?? customerInfo);
      }

      if (unlocked && !isPro) {
        onProUnlocked();
      }
      setIsPro(unlocked);

      if (unlocked) {
        Alert.alert(t("pro.restoreSuccessTitle"), t("pro.restoreSuccessDescription"));
        return true;
      }

      Alert.alert(t("pro.genericErrorTitle"), t("pro.restoreError"));
      return false;
    } catch {
      Alert.alert(t("pro.genericErrorTitle"), t("pro.restoreError"));
      return false;
    } finally {
      setIsRevenueCatLoading(false);
      await refreshRevenueCatState();
    }
  }, [
    isPro,
    isRevenueCatEnabled,
    onProUnlocked,
    refreshRevenueCatState,
    setIsPro,
    t,
  ]);

  const openCustomerCenter = useCallback(async () => {
    if (!isRevenueCatEnabled) {
      Alert.alert(
        t("pro.revenueCatUnavailableTitle"),
        t("pro.revenueCatUnavailableDescription"),
      );
      return;
    }

    setIsRevenueCatLoading(true);
    try {
      await presentRevenueCatCustomerCenter({
        onRestoreCompleted: ({ customerInfo }) => {
          const unlocked = hasLunellaProEntitlement(customerInfo);
          if (unlocked && !isPro) {
            onProUnlocked();
          }
          setIsPro(unlocked);
        },
      });

      await refreshRevenueCatState();
    } catch {
      Alert.alert(t("pro.genericErrorTitle"), t("pro.customerCenterError"));
    } finally {
      setIsRevenueCatLoading(false);
    }
  }, [isPro, isRevenueCatEnabled, onProUnlocked, refreshRevenueCatState, setIsPro, t]);

  return {
    isRevenueCatEnabled,
    isRevenueCatLoading,
    revenueCatPackages,
    refreshRevenueCatState,
    presentPaywall,
    purchasePlan,
    restoreSubscription,
    openCustomerCenter,
  };
}
