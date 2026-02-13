import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { i18n as I18nInstance } from "i18next";
import { persistLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../../../i18n";
import { GOAL_OPTIONS } from "../constants";
import { NumberAdjuster } from "../shared-components";
import { styles } from "../styles";
import type { CycleContext, GoalOption, HomeTab, ProfileView } from "../types";
import type { RevenueCatPackagesMap, RevenueCatPlanId } from "../../../services/revenuecat";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type ProfileTabProps = {
  cycleContext: CycleContext;
  cycleLength: number;
  dateLocale: string;
  draftProfileName: string;
  goals: GoalOption[];
  hasProAccess: boolean;
  healthSyncEnabled: boolean;
  i18n: I18nInstance;
  insightNudgesEnabled: boolean;
  isDebugProOverrideEnabled: boolean;
  isRevenueCatLoading: boolean;
  isSubscriptionModalVisible: boolean;
  languagePickerVisible: boolean;
  lastPeriodDate: Date;
  name: string;
  onCloseEditProfile: () => void;
  onExportCycleData: () => void;
  onOpenCustomerCenter: () => Promise<void>;
  onOpenEditProfile: () => void;
  onOpenSubscriptionModal: () => void;
  onPresentPaywall: (ifNeeded?: boolean) => Promise<void>;
  onPurchasePlan: (planId: RevenueCatPlanId) => Promise<void>;
  onRestoreSubscription: () => Promise<void>;
  onSaveProfileName: () => void;
  onSetActiveTab: (tab: HomeTab) => void;
  onSetCycleLength: (value: number) => void;
  onSetDebugProOverrideEnabled: (enabled: boolean) => void;
  onSetDraftProfileName: (name: string) => void;
  onSetHealthSyncEnabled: (enabled: boolean) => void;
  onSetInsightNudgesEnabled: (enabled: boolean) => void;
  onSetLanguagePickerVisible: (visible: boolean) => void;
  onSetPinLockEnabled: (enabled: boolean) => void;
  onSetProfileView: (view: ProfileView) => void;
  onSetPeriodLength: (value: number) => void;
  onSetRemindersEnabled: (enabled: boolean) => void;
  onSetSubscriptionModalVisible: (visible: boolean) => void;
  periodLength: number;
  pinLockEnabled: boolean;
  profileView: ProfileView;
  remindersEnabled: boolean;
  revenueCatPackages: RevenueCatPackagesMap;
  showProUpsell: (source: "health_sync" | "passcode") => void;
  t: TranslationFn;
};

export function ProfileTab({
  cycleContext,
  cycleLength,
  dateLocale,
  draftProfileName,
  goals,
  hasProAccess,
  healthSyncEnabled,
  i18n,
  insightNudgesEnabled,
  isDebugProOverrideEnabled,
  isRevenueCatLoading,
  isSubscriptionModalVisible,
  languagePickerVisible,
  lastPeriodDate,
  name,
  onCloseEditProfile,
  onExportCycleData,
  onOpenCustomerCenter,
  onOpenEditProfile,
  onOpenSubscriptionModal,
  onPresentPaywall,
  onPurchasePlan,
  onRestoreSubscription,
  onSaveProfileName,
  onSetActiveTab,
  onSetCycleLength,
  onSetDebugProOverrideEnabled,
  onSetDraftProfileName,
  onSetHealthSyncEnabled,
  onSetInsightNudgesEnabled,
  onSetLanguagePickerVisible,
  onSetPinLockEnabled,
  onSetProfileView,
  onSetPeriodLength,
  onSetRemindersEnabled,
  onSetSubscriptionModalVisible,
  periodLength,
  pinLockEnabled,
  profileView,
  remindersEnabled,
  revenueCatPackages,
  showProUpsell,
  t,
}: ProfileTabProps) {
  const profileName = name.trim() || "Gul";
  const profileGoals =
    goals.length > 0
      ? goals
          .map((goal) => {
            const found = GOAL_OPTIONS.find((option) => option.id === goal);
            return found ? t(found.labelKey) : goal;
          })
          .join(", ")
      : t("goals.cycleTracking");

  const subscriptionPlans: { id: RevenueCatPlanId; label: string }[] = [
    { id: "monthly", label: t("pro.planMonthly") },
    { id: "yearly", label: t("pro.planYearly") },
    { id: "lifetime", label: t("pro.planLifetime") },
  ];

  if (profileView === "edit_profile") {
    const editNamePreview = draftProfileName.trim() || profileName;

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.settingsHeaderRow}>
          <TouchableOpacity style={styles.settingsBackButton} onPress={onCloseEditProfile}>
            <Ionicons name="chevron-back" size={20} color="#4B3E53" />
          </TouchableOpacity>
          <Text style={styles.settingsHeaderTitle}>{t("profile.editProfileTitle")}</Text>
          <View style={styles.settingsHeaderSpacer} />
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>{t("profile.editProfileSectionTitle")}</Text>
          <Text style={styles.settingsRowSubtitle}>{t("profile.editProfileHint")}</Text>

          <View style={styles.editProfileAvatarWrap}>
            <View style={styles.profileAvatarLarge}>
              <Text style={styles.profileAvatarLargeText}>{editNamePreview[0].toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.editProfileFieldLabel}>{t("profile.nameLabel")}</Text>
          <TextInput
            style={styles.editProfileInput}
            value={draftProfileName}
            onChangeText={onSetDraftProfileName}
            placeholder={t("profile.namePlaceholder")}
            placeholderTextColor="#9A8BA0"
            maxLength={40}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={onSaveProfileName}
          />

          <View style={styles.editProfileActionsRow}>
            <TouchableOpacity style={styles.editProfileCancelButton} onPress={onCloseEditProfile}>
              <Text style={styles.editProfileCancelButtonText}>{t("languagePicker.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.editProfileSaveButton,
                !draftProfileName.trim() && styles.editProfileSaveButtonDisabled,
              ]}
              onPress={onSaveProfileName}
              disabled={!draftProfileName.trim()}>
              <Text style={styles.editProfileSaveButtonText}>{t("profile.saveChanges")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (profileView === "settings") {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.settingsHeaderRow}>
          <TouchableOpacity style={styles.settingsBackButton} onPress={() => onSetProfileView("main")}>
            <Ionicons name="chevron-back" size={20} color="#4B3E53" />
          </TouchableOpacity>
          <Text style={styles.settingsHeaderTitle}>{t("settings.title")}</Text>
          <View style={styles.settingsHeaderSpacer} />
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>{t("settings.notifications")}</Text>

          <View style={styles.settingsSwitchRow}>
            <View style={styles.settingsSwitchTextWrap}>
              <Text style={styles.settingsRowTitle}>{t("settings.cycleReminders")}</Text>
              <Text style={styles.settingsRowSubtitle}>{t("settings.cycleRemindersDesc")}</Text>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={onSetRemindersEnabled}
              trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingsSwitchRow}>
            <View style={styles.settingsSwitchTextWrap}>
              <Text style={styles.settingsRowTitle}>{t("settings.insightNudges")}</Text>
              <Text style={styles.settingsRowSubtitle}>{t("settings.insightNudgesDesc")}</Text>
            </View>
            <Switch
              value={insightNudgesEnabled}
              onValueChange={onSetInsightNudgesEnabled}
              trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>{t("settings.privacySecurity")}</Text>

          <View style={styles.settingsSwitchRow}>
            <View style={styles.settingsSwitchTextWrap}>
              <Text style={styles.settingsRowTitle}>{t("settings.appPasscodeLock")}</Text>
              <Text style={styles.settingsRowSubtitle}>{t("settings.appPasscodeLockDesc")}</Text>
            </View>
            <Switch
              value={pinLockEnabled}
              onValueChange={(nextValue) => {
                if (!hasProAccess && nextValue) {
                  showProUpsell("passcode");
                  return;
                }
                onSetPinLockEnabled(nextValue);
              }}
              trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>{t("settings.integrations")}</Text>

          <View style={styles.settingsSwitchRow}>
            <View style={styles.settingsSwitchTextWrap}>
              <Text style={styles.settingsRowTitle}>{t("settings.healthSync")}</Text>
              <Text style={styles.settingsRowSubtitle}>{t("settings.healthSyncDesc")}</Text>
            </View>
            <Switch
              value={healthSyncEnabled}
              onValueChange={(nextValue) => {
                if (!hasProAccess && nextValue) {
                  showProUpsell("health_sync");
                  return;
                }
                onSetHealthSyncEnabled(nextValue);
              }}
              trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.settingsCard}>
            <Text style={styles.settingsSectionTitle}>{t("settings.debugSection")}</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={styles.settingsSwitchTextWrap}>
                <Text style={styles.settingsRowTitle}>{t("settings.debugProAccess")}</Text>
                <Text style={styles.settingsRowSubtitle}>{t("settings.debugProAccessDesc")}</Text>
              </View>
              <Switch
                value={isDebugProOverrideEnabled}
                onValueChange={onSetDebugProOverrideEnabled}
                trackColor={{ false: "#D2C4DA", true: "#AB8FD9" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        )}

        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>{t("settings.general")}</Text>

          <TouchableOpacity style={styles.settingsNavRow} onPress={() => onSetLanguagePickerVisible(true)}>
            <Text style={styles.settingsRowTitle}>{t("settings.language")}</Text>
            <View style={styles.settingsNavRight}>
              <Text style={styles.settingsNavValue}>{SUPPORTED_LANGUAGES[i18n.language] ?? "English"}</Text>
              <Ionicons name="chevron-forward" size={16} color="#85788A" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsNavRow} onPress={onOpenSubscriptionModal}>
            <Text style={styles.settingsRowTitle}>{t("pro.managePlan")}</Text>
            <View style={styles.settingsNavRight}>
              <Text style={styles.settingsNavValue}>
                {hasProAccess ? t("pro.activeShort") : t("pro.freeShort")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#85788A" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsNavRow} onPress={onExportCycleData}>
            <Text style={styles.settingsRowTitle}>{t("settings.exportCycleData")}</Text>
            <Ionicons name="chevron-forward" size={16} color="#85788A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsNavRow}>
            <Text style={styles.settingsRowTitle}>{t("settings.helpSupport")}</Text>
            <Ionicons name="chevron-forward" size={16} color="#85788A" />
          </TouchableOpacity>
        </View>

        <Modal
          visible={languagePickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => onSetLanguagePickerVisible(false)}>
          <Pressable style={styles.languageModalOverlay} onPress={() => onSetLanguagePickerVisible(false)}>
            <View style={styles.languageModalContent}>
              <Text style={styles.languageModalTitle}>{t("languagePicker.title")}</Text>
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => (
                <TouchableOpacity
                  key={code}
                  style={styles.languageOptionRow}
                  onPress={() => {
                    void i18n.changeLanguage(code);
                    persistLanguage(code as SupportedLanguage);
                    onSetLanguagePickerVisible(false);
                  }}>
                  <Text
                    style={[
                      styles.languageOptionText,
                      i18n.language === code && styles.languageOptionTextActive,
                    ]}>
                    {label}
                  </Text>
                  {i18n.language === code && <Ionicons name="checkmark" size={18} color="#8F72C5" />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.languageCancelButton}
                onPress={() => onSetLanguagePickerVisible(false)}>
                <Text style={styles.languageCancelText}>{t("languagePicker.cancel")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={isSubscriptionModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => onSetSubscriptionModalVisible(false)}>
          <Pressable style={styles.subscriptionModalOverlay} onPress={() => onSetSubscriptionModalVisible(false)}>
            <Pressable style={styles.subscriptionModalCard} onPress={() => null}>
              <Text style={styles.subscriptionModalTitle}>{t("pro.managePlan")}</Text>
              <Text style={styles.subscriptionModalSubtitle}>
                {hasProAccess ? t("pro.activePlan") : t("pro.freePlan")}
              </Text>

              {subscriptionPlans.map((plan) => {
                const revenueCatPackage = revenueCatPackages[plan.id];
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.subscriptionPlanButton,
                      !revenueCatPackage && styles.subscriptionPlanButtonDisabled,
                    ]}
                    disabled={!revenueCatPackage || isRevenueCatLoading}
                    onPress={() => {
                      void onPurchasePlan(plan.id);
                    }}>
                    <View>
                      <Text style={styles.subscriptionPlanTitle}>{plan.label}</Text>
                      <Text style={styles.subscriptionPlanPrice}>
                        {revenueCatPackage?.product.priceString ?? t("pro.planUnavailable")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#85788A" />
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.subscriptionActionButton}
                disabled={isRevenueCatLoading}
                onPress={() => {
                  void onPresentPaywall(false);
                }}>
                <Text style={styles.subscriptionActionButtonText}>{t("pro.openPaywall")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.subscriptionActionButton}
                disabled={isRevenueCatLoading}
                onPress={() => {
                  void onRestoreSubscription();
                }}>
                <Text style={styles.subscriptionActionButtonText}>{t("pro.restorePurchases")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.subscriptionActionButton}
                disabled={isRevenueCatLoading}
                onPress={() => {
                  void onOpenCustomerCenter();
                }}>
                <Text style={styles.subscriptionActionButtonText}>{t("pro.openCustomerCenter")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.subscriptionCloseButton}
                disabled={isRevenueCatLoading}
                onPress={() => onSetSubscriptionModalVisible(false)}>
                <Text style={styles.subscriptionCloseButtonText}>{t("pro.close")}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeaderRow}>
        <View style={styles.profileIdentityWrap}>
          <View style={styles.profileAvatarLarge}>
            <Text style={styles.profileAvatarLargeText}>{profileName[0].toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profileName}</Text>
            <Text style={styles.profileMetaText}>{profileGoals}</Text>
            <Text style={styles.profilePlanText}>
              {hasProAccess ? t("pro.activePlan") : t("pro.freePlan")}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.profileSettingsIconButton} onPress={onOpenEditProfile}>
          <Ionicons name="settings-outline" size={22} color="#5D4F64" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileHeroCard}>
        <Text style={styles.profileHeroTitle}>{t("profile.heroTitle")}</Text>
        <Text style={styles.profileHeroSubtitle}>{t("profile.heroSubtitle")}</Text>
      </View>

      <View style={styles.profileStatsGrid}>
        <View style={[styles.profileStatCard, styles.profileStatCardLavender]}>
          <Text style={styles.profileStatTitle}>{t("profile.cycleLength")}</Text>
          <Text style={styles.profileStatValue}>{t("profile.days", { count: cycleLength })}</Text>
        </View>

        <View style={[styles.profileStatCard, styles.profileStatCardPink]}>
          <Text style={styles.profileStatTitle}>{t("profile.periodLength")}</Text>
          <Text style={styles.profileStatValue}>{t("profile.days", { count: periodLength })}</Text>
        </View>

        <View style={[styles.profileStatCard, styles.profileStatCardMint]}>
          <Text style={styles.profileStatTitle}>{t("profile.lastLogged")}</Text>
          <Text style={styles.profileStatValueSmall}>{lastPeriodDate.toLocaleDateString(dateLocale)}</Text>
        </View>

        <View style={[styles.profileStatCard, styles.profileStatCardPeach]}>
          <Text style={styles.profileStatTitle}>{t("profile.nextPeriod")}</Text>
          <Text style={styles.profileStatValueSmall}>
            {cycleContext.nextPeriodStart.toLocaleDateString(dateLocale)}
          </Text>
        </View>
      </View>

      <View style={styles.profileMenuCard}>
        <TouchableOpacity style={styles.profileMenuRow} onPress={() => onSetActiveTab("insights")}>
          <View style={styles.profileMenuLabelWrap}>
            <Text style={styles.profileMenuTitle}>{t("profile.cycleInsights")}</Text>
            <Text style={styles.profileMenuSubtitle}>{t("profile.cycleInsightsDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#877A8A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuRow} onPress={() => onSetActiveTab("tips")}>
          <View style={styles.profileMenuLabelWrap}>
            <Text style={styles.profileMenuTitle}>{t("profile.tipsWellbeing")}</Text>
            <Text style={styles.profileMenuSubtitle}>{t("profile.tipsWellbeingDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#877A8A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuRow} onPress={() => onSetActiveTab("ai")}>
          <View style={styles.profileMenuLabelWrap}>
            <Text style={styles.profileMenuTitle}>{t("profile.aiAssistant")}</Text>
            <Text style={styles.profileMenuSubtitle}>{t("profile.aiAssistantDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#877A8A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuRow} onPress={() => onSetProfileView("settings")}>
          <View style={styles.profileMenuLabelWrap}>
            <Text style={styles.profileMenuTitle}>{t("profile.appSettings")}</Text>
            <Text style={styles.profileMenuSubtitle}>{t("profile.appSettingsDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#877A8A" />
        </TouchableOpacity>
      </View>

      <NumberAdjuster
        label={t("profile.cycleLength")}
        hint={t("profile.cycleLengthHint")}
        value={cycleLength}
        min={21}
        max={40}
        onChange={onSetCycleLength}
      />

      <NumberAdjuster
        label={t("profile.periodLength")}
        hint={t("profile.periodLengthHint")}
        value={periodLength}
        min={3}
        max={10}
        onChange={onSetPeriodLength}
      />
    </ScrollView>
  );
}
