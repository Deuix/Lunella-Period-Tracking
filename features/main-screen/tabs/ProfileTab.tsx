import { Ionicons } from "@expo/vector-icons";
import type { i18n as I18nInstance } from "i18next";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { persistLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../../../i18n";
import type { RevenueCatPackagesMap, RevenueCatPlanId } from "../../../services/revenuecat";
import { GOAL_OPTIONS, PROFILE_AVATAR_OPTIONS } from "../constants";
import { NumberAdjuster } from "../shared-components";
import { useMainScreenStyles } from "../styles";
import {
  pickThemeValue,
  useMainScreenTheme,
  type ThemePreference,
} from "../theme";
import type { CycleContext, GoalOption, HomeTab, ProfileAvatarIcon, ProfileView } from "../types";

type TranslationFn = (key: string, opts?: Record<string, unknown>) => string;

type ProfileTabProps = {
  cycleContext: CycleContext;
  cycleLength: number;
  dateLocale: string;
  dailyReminderHour: number;
  draftProfileAvatarIcon: ProfileAvatarIcon;
  draftProfileName: string;
  celebrationEffectsEnabled: boolean;
  fertilityRemindersEnabled: boolean;
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
  profileAvatarIcon: ProfileAvatarIcon;
  onCloseEditProfile: () => void;
  onDeleteAllData: () => void;
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
  onSetCelebrationEffectsEnabled: (enabled: boolean) => void;
  onSetDailyReminderHour: (value: number) => void;
  onSetDebugProOverrideEnabled: (enabled: boolean) => void;
  onSetDraftProfileAvatarIcon: (icon: ProfileAvatarIcon) => void;
  onSetDraftProfileName: (name: string) => void;
  onSetHealthSyncEnabled: (enabled: boolean) => void;
  onSetFertilityRemindersEnabled: (enabled: boolean) => void;
  onSetInsightNudgesEnabled: (enabled: boolean) => void;
  onSetLanguagePickerVisible: (visible: boolean) => void;
  onSetPeriodEndCelebrationEnabled: (enabled: boolean) => void;
  onSetPeriodStartCelebrationEnabled: (enabled: boolean) => void;
  onSetPinLockEnabled: (enabled: boolean) => void;
  onSetProfileView: (view: ProfileView) => void;
  onSetOvulationRemindersEnabled: (enabled: boolean) => void;
  onSetPeriodLength: (value: number) => void;
  onSetRemindersEnabled: (enabled: boolean) => void;
  onSetSubscriptionModalVisible: (visible: boolean) => void;
  ovulationRemindersEnabled: boolean;
  periodEndCelebrationEnabled: boolean;
  periodLength: number;
  periodStartCelebrationEnabled: boolean;
  pinLockEnabled: boolean;
  profileView: ProfileView;
  remindersEnabled: boolean;
  revenueCatPackages: RevenueCatPackagesMap;
  themePreference: ThemePreference;
  onSetThemePreference: (nextPreference: ThemePreference) => void;
  showProUpsell: (source: "health_sync" | "passcode") => void;
  t: TranslationFn;
};

// Quick Action Button Component
const QuickActionButton = ({
  icon,
  label,
  onPress,
  color,
  bgColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  bgColor?: string;
}) => {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();

  return (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <View
        style={[
          styles.quickActionIcon,
          { backgroundColor: bgColor ?? pickThemeValue(resolvedTheme, "#F5EEFB", "#3D304F") },
        ]}>
        <Ionicons name={icon} size={20} color={color ?? pickThemeValue(resolvedTheme, "#8F72C5", "#C9B4F6")} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

// Stat Card Component
const StatCard = ({
  label,
  value,
  icon,
  color,
  bgColor,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}) => {
  const styles = useMainScreenStyles();
  return (
    <View style={styles.newProfileStatCard}>
      <View style={[styles.newProfileStatIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.newProfileStatValue}>{value}</Text>
      <Text style={styles.newProfileStatLabel}>{label}</Text>
    </View>
  );
};

// Settings Row Component
const SettingsRow = ({
  icon,
  title,
  subtitle,
  onPress,
  rightComponent,
  showArrow = true,
  isFirst = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  rightComponent?: React.ReactNode;
  showArrow?: boolean;
  isFirst?: boolean;
}) => {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();

  return (
    <TouchableOpacity
      style={[styles.newSettingsRow, !isFirst && styles.newSettingsRowNotFirst]}
      onPress={onPress}>
      <View style={styles.newSettingsRowLeft}>
        <View style={styles.newSettingsIcon}>
          <Ionicons name={icon} size={20} color={pickThemeValue(resolvedTheme, "#8F72C5", "#C5ADFA")} />
        </View>
        <View style={styles.newSettingsTextWrap}>
          <Text style={styles.newSettingsTitle}>{title}</Text>
          {subtitle && <Text style={styles.newSettingsSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (
        showArrow && (
          <Ionicons name="chevron-forward" size={18} color={pickThemeValue(resolvedTheme, "#C5B8D0", "#8A8092")} />
        )
      )}
    </TouchableOpacity>
  );
};

// Toggle Row Component
const ToggleRow = ({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  isPro = false,
  isFirst = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isPro?: boolean;
  isFirst?: boolean;
  disabled?: boolean;
}) => {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();

  return (
    <View style={[styles.newSettingsRow, !isFirst && styles.newSettingsRowNotFirst, disabled && { opacity: 0.55 }]}>
      <View style={styles.newSettingsRowLeft}>
        <View style={styles.newSettingsIcon}>
          <Ionicons name={icon} size={20} color={pickThemeValue(resolvedTheme, "#8F72C5", "#C5ADFA")} />
        </View>
        <View style={styles.newSettingsTextWrap}>
          <Text style={styles.newSettingsTitle}>{title}</Text>
          {subtitle && <Text style={styles.newSettingsSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.newToggleRowRight}>
        {isPro && !value && (
          <View style={styles.newProBadge}>
            <Ionicons name="diamond" size={10} color={pickThemeValue(resolvedTheme, "#B4861D", "#E1C26D")} />
            <Text style={styles.newProBadgeText}>PRO</Text>
          </View>
        )}
        <Switch
          disabled={disabled}
          value={value}
          onValueChange={onValueChange}
          trackColor={{
            false: pickThemeValue(resolvedTheme, "#E8DCF0", "#4D435C"),
            true: pickThemeValue(resolvedTheme, "#D4C0F8", "#6D56A8"),
          }}
          thumbColor={value ? pickThemeValue(resolvedTheme, "#8F72C5", "#D5C2FB") : "#FFFFFF"}
          ios_backgroundColor={pickThemeValue(resolvedTheme, "#E8DCF0", "#4D435C")}
        />
      </View>
    </View>
  );
};

export function ProfileTab({
  cycleContext,
  cycleLength,
  celebrationEffectsEnabled,
  dateLocale,
  dailyReminderHour,
  draftProfileAvatarIcon,
  draftProfileName,
  fertilityRemindersEnabled,
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
  profileAvatarIcon,
  onCloseEditProfile,
  onDeleteAllData,
  onExportCycleData,
  onOpenCustomerCenter,
  onOpenEditProfile,
  onOpenSubscriptionModal,
  onPresentPaywall,
  onPurchasePlan,
  onRestoreSubscription,
  onSaveProfileName,
  onSetActiveTab,
  onSetCelebrationEffectsEnabled,
  onSetCycleLength,
  onSetDailyReminderHour,
  onSetDebugProOverrideEnabled,
  onSetDraftProfileAvatarIcon,
  onSetDraftProfileName,
  onSetFertilityRemindersEnabled,
  onSetHealthSyncEnabled,
  onSetInsightNudgesEnabled,
  onSetLanguagePickerVisible,
  onSetPeriodEndCelebrationEnabled,
  onSetPeriodStartCelebrationEnabled,
  onSetOvulationRemindersEnabled,
  onSetPinLockEnabled,
  onSetProfileView,
  onSetPeriodLength,
  onSetRemindersEnabled,
  onSetSubscriptionModalVisible,
  ovulationRemindersEnabled,
  periodEndCelebrationEnabled,
  periodLength,
  periodStartCelebrationEnabled,
  pinLockEnabled,
  profileView,
  remindersEnabled,
  revenueCatPackages,
  themePreference,
  onSetThemePreference,
  showProUpsell,
  t,
}: ProfileTabProps) {
  const styles = useMainScreenStyles();
  const { resolvedTheme } = useMainScreenTheme();
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
  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: "system", label: t("settings.themeSystem") },
    { key: "light", label: t("settings.themeLight") },
    { key: "dark", label: t("settings.themeDark") },
  ];

  const openTermsAndConditions = () => {
    Alert.alert(t("settings.termsConditions"), t("settings.termsConditionsBody"));
  };

  const openPrivacyPolicy = () => {
    Alert.alert(t("settings.privacyPolicy"), t("settings.privacyPolicyBody"));
  };

  const openHelpSupport = () => {
    Alert.alert(t("settings.helpSupport"), t("settings.helpSupportBody"));
  };

  // Calculate days until next period
  const daysUntilNextPeriod = Math.ceil(
    (cycleContext.nextPeriodStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  // EDIT PROFILE VIEW
  if (profileView === "edit_profile") {
    return (
      <View style={styles.newProfileContainer}>
        <View style={styles.newProfileHeader}>
          <TouchableOpacity style={styles.newProfileBackButton} onPress={onCloseEditProfile}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={pickThemeValue(resolvedTheme, "#2F2436", "#E3DCEC")}
            />
          </TouchableOpacity>
          <Text style={styles.newProfileHeaderTitle}>{t("profile.editProfileTitle")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.newProfileScroll}
          contentContainerStyle={styles.newProfileScrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.newEditProfileAvatarWrap}>
            <View style={styles.newEditProfileAvatar}>
              <Ionicons name={draftProfileAvatarIcon} size={40} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.newEditProfileSectionTitle}>{t("profile.avatarLabel")}</Text>
          <View style={styles.newAvatarOptionsGrid}>
            {PROFILE_AVATAR_OPTIONS.map((avatarIcon) => {
              const isSelected = avatarIcon === draftProfileAvatarIcon;

              return (
                <TouchableOpacity
                  key={avatarIcon}
                  style={[
                    styles.newAvatarOptionButton,
                    isSelected && styles.newAvatarOptionButtonSelected,
                  ]}
                  onPress={() => onSetDraftProfileAvatarIcon(avatarIcon)}>
                  <Ionicons
                    name={avatarIcon}
                    size={24}
                    color={isSelected
                      ? pickThemeValue(resolvedTheme, "#8F72C5", "#C8B2F8")
                      : pickThemeValue(resolvedTheme, "#7A6D82", "#A89DB2")}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.newEditProfileSectionTitle}>{t("profile.editProfileSectionTitle")}</Text>

          <View style={styles.newEditProfileInputWrap}>
            <Text style={styles.newEditProfileInputLabel}>{t("profile.nameLabel")}</Text>
            <TextInput
              style={styles.newEditProfileInput}
              value={draftProfileName}
              onChangeText={onSetDraftProfileName}
              placeholder={t("profile.namePlaceholder")}
              placeholderTextColor={pickThemeValue(resolvedTheme, "#B5A8BC", "#8A8094")}
              maxLength={40}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={onSaveProfileName}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.newEditProfileSaveButton,
              !draftProfileName.trim() && styles.newEditProfileSaveButtonDisabled,
            ]}
            onPress={onSaveProfileName}
            disabled={!draftProfileName.trim()}>
            <Text style={styles.newEditProfileSaveButtonText}>{t("profile.saveChanges")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // SETTINGS VIEW
  if (profileView === "settings") {
    return (
      <View style={styles.newProfileContainer}>
        <View style={styles.newProfileHeader}>
          <TouchableOpacity style={styles.newProfileBackButton} onPress={() => onSetProfileView("main")}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={pickThemeValue(resolvedTheme, "#2F2436", "#E3DCEC")}
            />
          </TouchableOpacity>
          <Text style={styles.newProfileHeaderTitle}>{t("settings.title")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.newProfileScroll}
          contentContainerStyle={styles.newProfileScrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Account Section */}
          <Text style={styles.newSettingsSectionTitle}>{t("settings.account")}</Text>
          <View style={styles.newSettingsCard}>
            <SettingsRow
              icon="person-outline"
              title={t("settings.editProfile")}
              subtitle={t("settings.editProfileDesc")}
              onPress={onOpenEditProfile}
              isFirst
            />
            <SettingsRow
              icon="trash-outline"
              title={t("settings.deleteAllData")}
              subtitle={t("settings.deleteAllDataDesc")}
              onPress={onDeleteAllData}
            />
          </View>

          {/* Notifications Section */}
          <Text style={styles.newSettingsSectionTitle}>{t("settings.notifications")}</Text>
          <View style={styles.newSettingsCard}>
            <ToggleRow
              icon="notifications-outline"
              title={t("settings.cycleReminders")}
              subtitle={t("settings.cycleRemindersDesc")}
              value={remindersEnabled}
              onValueChange={onSetRemindersEnabled}
              isFirst
            />
            <ToggleRow
              icon="leaf-outline"
              title={t("settings.fertilitySupportReminders")}
              subtitle={t("settings.fertilitySupportRemindersDesc")}
              value={fertilityRemindersEnabled}
              onValueChange={onSetFertilityRemindersEnabled}
            />
            <ToggleRow
              icon="sparkles-outline"
              title={t("settings.ovulationSupportReminders")}
              subtitle={t("settings.ovulationSupportRemindersDesc")}
              value={ovulationRemindersEnabled}
              onValueChange={onSetOvulationRemindersEnabled}
            />
            <ToggleRow
              icon="bulb-outline"
              title={t("settings.insightNudges")}
              subtitle={t("settings.insightNudgesDesc")}
              value={insightNudgesEnabled}
              onValueChange={onSetInsightNudgesEnabled}
            />
            <ToggleRow
              icon="sparkles-outline"
              title={t("settings.celebrationEffects")}
              subtitle={t("settings.celebrationEffectsDesc")}
              value={celebrationEffectsEnabled}
              onValueChange={onSetCelebrationEffectsEnabled}
            />
            <ToggleRow
              icon="water-outline"
              title={t("settings.periodStartConfetti")}
              subtitle={t("settings.periodStartConfettiDesc")}
              value={periodStartCelebrationEnabled}
              onValueChange={onSetPeriodStartCelebrationEnabled}
              disabled={!celebrationEffectsEnabled}
            />
            <ToggleRow
              icon="checkmark-circle-outline"
              title={t("settings.periodEndConfetti")}
              subtitle={t("settings.periodEndConfettiDesc")}
              value={periodEndCelebrationEnabled}
              onValueChange={onSetPeriodEndCelebrationEnabled}
              disabled={!celebrationEffectsEnabled}
            />
            <NumberAdjuster
              label={t("settings.reminderTime", { hour: `${String(dailyReminderHour).padStart(2, "0")}:00` })}
              hint={t("settings.reminderTimeDesc")}
              value={dailyReminderHour}
              min={6}
              max={22}
              onChange={onSetDailyReminderHour}
            />
          </View>

          {/* Privacy & Security Section */}
          <Text style={styles.newSettingsSectionTitle}>{t("settings.privacySecurity")}</Text>
          <View style={styles.newSettingsCard}>
            <ToggleRow
              icon="lock-closed-outline"
              title={t("settings.appPasscodeLock")}
              subtitle={t("settings.appPasscodeLockDesc")}
              value={pinLockEnabled}
              onValueChange={(nextValue) => {
                if (!hasProAccess && nextValue) {
                  showProUpsell("passcode");
                  return;
                }
                onSetPinLockEnabled(nextValue);
              }}
              isPro
              isFirst
            />
          </View>

          {/* Integrations Section */}
          <Text style={styles.newSettingsSectionTitle}>{t("settings.integrations")}</Text>
          <View style={styles.newSettingsCard}>
            <ToggleRow
              icon="heart-outline"
              title={t("settings.healthSync")}
              subtitle={t("settings.healthSyncDesc")}
              value={healthSyncEnabled}
              onValueChange={(nextValue) => {
                if (!hasProAccess && nextValue) {
                  showProUpsell("health_sync");
                  return;
                }
                onSetHealthSyncEnabled(nextValue);
              }}
              isPro
              isFirst
            />
          </View>

          {/* Debug Section (DEV only) */}
          {__DEV__ && (
            <>
              <Text style={styles.newSettingsSectionTitle}>{t("settings.debugSection")}</Text>
              <View style={styles.newSettingsCard}>
                <ToggleRow
                  icon="bug-outline"
                  title={t("settings.debugProAccess")}
                  subtitle={t("settings.debugProAccessDesc")}
                  value={isDebugProOverrideEnabled}
                  onValueChange={onSetDebugProOverrideEnabled}
                  isFirst
                />
              </View>
            </>
          )}

          {/* General Section */}
          <Text style={styles.newSettingsSectionTitle}>{t("settings.general")}</Text>
          <View style={styles.newSettingsCard}>
            <View style={styles.newThemePickerRow}>
              <View style={styles.newThemePickerHeader}>
                <View style={styles.newThemePickerIcon}>
                  <Ionicons
                    name="color-palette-outline"
                    size={20}
                    color={pickThemeValue(resolvedTheme, "#8F72C5", "#C5ADFA")}
                  />
                </View>
                <View style={styles.newThemePickerTextWrap}>
                  <Text style={styles.newSettingsTitle}>{t("settings.themeMode")}</Text>
                  <Text style={styles.newSettingsSubtitle}>{t("settings.themeModeDesc")}</Text>
                </View>
              </View>

              <View style={styles.newThemeOptionsRow}>
                {themeOptions.map((option) => {
                  const isActive = themePreference === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.newThemeOptionButton,
                        isActive && styles.newThemeOptionButtonActive,
                      ]}
                      onPress={() => onSetThemePreference(option.key)}>
                      <Text
                        style={[
                          styles.newThemeOptionText,
                          isActive && styles.newThemeOptionTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <SettingsRow
              icon="globe-outline"
              title={t("settings.language")}
              onPress={() => onSetLanguagePickerVisible(true)}
              rightComponent={
                <Text style={styles.newSettingsValue}>
                  {SUPPORTED_LANGUAGES[i18n.language] ?? "English"}
                </Text>
              }
            />
            <SettingsRow
              icon="card-outline"
              title={t("pro.managePlan")}
              onPress={onOpenSubscriptionModal}
              rightComponent={
                <View style={styles.newPlanBadge}>
                  <Text style={styles.newPlanBadgeText}>
                    {hasProAccess ? t("pro.activeShort") : t("pro.freeShort")}
                  </Text>
                </View>
              }
            />
            <SettingsRow
              icon="download-outline"
              title={t("settings.exportCycleData")}
              onPress={onExportCycleData}
            />
            <SettingsRow
              icon="help-circle-outline"
              title={t("settings.helpSupport")}
              onPress={openHelpSupport}
            />
          </View>

          {/* Legal Section */}
          <Text style={styles.newSettingsSectionTitle}>{t("settings.legal")}</Text>
          <View style={styles.newSettingsCard}>
            <SettingsRow
              icon="document-text-outline"
              title={t("settings.termsConditions")}
              subtitle={t("settings.termsConditionsDesc")}
              onPress={openTermsAndConditions}
              isFirst
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              title={t("settings.privacyPolicy")}
              subtitle={t("settings.privacyPolicyDesc")}
              onPress={openPrivacyPolicy}
            />
          </View>

          {/* App Version */}
          <Text style={styles.newAppVersion}>Lunella v1.0.0</Text>
        </ScrollView>

        {/* Language Picker Modal */}
        <Modal
          visible={languagePickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => onSetLanguagePickerVisible(false)}>
          <Pressable
            style={styles.newLanguageModalOverlay}
            onPress={() => onSetLanguagePickerVisible(false)}>
            <View style={styles.newLanguageModalContent}>
              <Text style={styles.newLanguageModalTitle}>{t("languagePicker.title")}</Text>
              <View style={styles.newLanguageOptionsList}>
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.newLanguageOption,
                      i18n.language === code && styles.newLanguageOptionActive,
                    ]}
                    onPress={() => {
                      void i18n.changeLanguage(code);
                      persistLanguage(code as SupportedLanguage);
                      onSetLanguagePickerVisible(false);
                    }}>
                    <Text
                      style={[
                        styles.newLanguageOptionText,
                        i18n.language === code && styles.newLanguageOptionTextActive,
                      ]}>
                      {label}
                    </Text>
                    {i18n.language === code && (
                      <View style={styles.newLanguageCheckIcon}>
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Subscription Modal */}
        <Modal
          visible={isSubscriptionModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => onSetSubscriptionModalVisible(false)}>
          <Pressable
            style={styles.newSubscriptionModalOverlay}
            onPress={() => onSetSubscriptionModalVisible(false)}>
            <Pressable style={styles.newSubscriptionModalContent} onPress={() => null}>
              <View style={styles.newSubscriptionModalHeader}>
                <Text style={styles.newSubscriptionModalTitle}>{t("pro.managePlan")}</Text>
                <TouchableOpacity
                  style={styles.newSubscriptionCloseButton}
                  onPress={() => onSetSubscriptionModalVisible(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={pickThemeValue(resolvedTheme, "#5E5265", "#D0C6DA")}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.newSubscriptionStatusCard}>
                <Ionicons
                  name={hasProAccess ? "diamond" : "ellipse-outline"}
                  size={32}
                  color={hasProAccess
                    ? pickThemeValue(resolvedTheme, "#F7B84B", "#F1C66C")
                    : pickThemeValue(resolvedTheme, "#C5B8D0", "#92869B")}
                />
                <View>
                  <Text style={styles.newSubscriptionStatusTitle}>
                    {hasProAccess ? t("pro.activePlan") : t("pro.freePlan")}
                  </Text>
                  <Text style={styles.newSubscriptionStatusSubtitle}>
                    {hasProAccess ? t("pro.activeDesc") : t("pro.freeDesc")}
                  </Text>
                </View>
              </View>

              <Text style={styles.newSubscriptionSectionTitle}>{t("pro.upgradeOptions")}</Text>
              {subscriptionPlans.map((plan) => {
                const revenueCatPackage = revenueCatPackages[plan.id];
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.newSubscriptionPlanCard,
                      !revenueCatPackage && styles.newSubscriptionPlanCardDisabled,
                    ]}
                    disabled={!revenueCatPackage || isRevenueCatLoading}
                    onPress={() => {
                      void onPurchasePlan(plan.id);
                    }}>
                    <View style={styles.newSubscriptionPlanLeft}>
                      <Text style={styles.newSubscriptionPlanTitle}>{plan.label}</Text>
                      <Text style={styles.newSubscriptionPlanPrice}>
                        {revenueCatPackage?.product.priceString ?? t("pro.planUnavailable")}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={pickThemeValue(resolvedTheme, "#C5B8D0", "#92869B")}
                    />
                  </TouchableOpacity>
                );
              })}

              <View style={styles.newSubscriptionActions}>
                <TouchableOpacity
                  style={styles.newSubscriptionActionButton}
                  disabled={isRevenueCatLoading}
                  onPress={() => {
                    void onPresentPaywall(false);
                  }}>
                  <Ionicons
                    name="sparkles"
                    size={18}
                    color={pickThemeValue(resolvedTheme, "#8F72C5", "#C8B2F8")}
                  />
                  <Text style={styles.newSubscriptionActionText}>{t("pro.openPaywall")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.newSubscriptionActionButton}
                  disabled={isRevenueCatLoading}
                  onPress={() => {
                    void onRestoreSubscription();
                  }}>
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={pickThemeValue(resolvedTheme, "#8F72C5", "#C8B2F8")}
                  />
                  <Text style={styles.newSubscriptionActionText}>{t("pro.restorePurchases")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.newSubscriptionActionButton}
                  disabled={isRevenueCatLoading}
                  onPress={() => {
                    void onOpenCustomerCenter();
                  }}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={pickThemeValue(resolvedTheme, "#8F72C5", "#C8B2F8")}
                  />
                  <Text style={styles.newSubscriptionActionText}>{t("pro.openCustomerCenter")}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // MAIN PROFILE VIEW
  return (
    <View style={styles.newProfileContainer}>
      <ScrollView
        style={styles.newProfileScroll}
        contentContainerStyle={styles.newProfileScrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Profile Header Card */}
        <View style={styles.newProfileHeaderCard}>
          <View style={styles.newProfileHeaderTop}>
            <View style={styles.newProfileAvatarWrap}>
              <View style={styles.newProfileAvatar}>
                <Ionicons name={profileAvatarIcon} size={34} color="#FFFFFF" />
              </View>
              <TouchableOpacity
                style={styles.newProfileEditButton}
                onPress={onOpenEditProfile}>
                <Ionicons name="pencil" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.newProfileSettingsButton}
              onPress={() => onSetProfileView("settings")}>
              <Ionicons
                name="settings-outline"
                size={22}
                color={pickThemeValue(resolvedTheme, "#5E5265", "#D0C6DA")}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.newProfileName}>{profileName}</Text>
          <Text style={styles.newProfileGoals}>{profileGoals}</Text>
          <View style={styles.newProfilePlanBadge}>
            <Ionicons
              name={hasProAccess ? "diamond" : "ellipse-outline"}
              size={12}
              color={hasProAccess
                ? pickThemeValue(resolvedTheme, "#F7B84B", "#F1C66C")
                : pickThemeValue(resolvedTheme, "#8F72C5", "#C8B2F8")}
            />
            <Text style={styles.newProfilePlanText}>
              {hasProAccess ? t("pro.activePlan") : t("pro.freePlan")}
            </Text>
          </View>
        </View>

        {/* Cycle Stats Card */}
        <View style={styles.newProfileStatsCard}>
          <View style={styles.newProfileStatsHeader}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={pickThemeValue(resolvedTheme, "#8F72C5", "#C8B2F8")}
            />
            <Text style={styles.newProfileStatsTitle}>{t("profile.cycleStats")}</Text>
          </View>
          <View style={styles.newProfileStatsGrid}>
            <StatCard
              label={t("profile.cycleLength")}
              value={cycleLength}
              icon="repeat-outline"
              color={pickThemeValue(resolvedTheme, "#8F72C5", "#C8B2F8")}
              bgColor={pickThemeValue(resolvedTheme, "#F5EEFB", "#3B3050")}
            />
            <StatCard
              label={t("profile.periodLength")}
              value={periodLength}
              icon="time-outline"
              color={pickThemeValue(resolvedTheme, "#E91E63", "#F36F9F")}
              bgColor={pickThemeValue(resolvedTheme, "#FDF0F5", "#4E2937")}
            />
            <StatCard
              label={t("profile.lastLogged")}
              value={lastPeriodDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
              icon="arrow-back-outline"
              color={pickThemeValue(resolvedTheme, "#10B981", "#66D9B4")}
              bgColor={pickThemeValue(resolvedTheme, "#EDF8F2", "#254637")}
            />
            <StatCard
              label={t("profile.nextPeriod")}
              value={`${daysUntilNextPeriod}d`}
              icon="calendar-clear-outline"
              color={pickThemeValue(resolvedTheme, "#F59E0B", "#F7C76E")}
              bgColor={pickThemeValue(resolvedTheme, "#FFF4EB", "#503B27")}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.newQuickActionsSection}>
          <QuickActionButton
            icon="stats-chart"
            label={t("profile.cycleInsights")}
            onPress={() => onSetActiveTab("insights")}
          />
          <QuickActionButton
            icon="heart"
            label={t("profile.tipsWellbeing")}
            onPress={() => onSetActiveTab("tips")}
          />
          <QuickActionButton
            icon="sparkles"
            label={t("profile.aiAssistant")}
            onPress={() => onSetActiveTab("ai")}
          />
          <QuickActionButton
            icon="settings-outline"
            label={t("profile.appSettings")}
            onPress={() => onSetProfileView("settings")}
          />
        </View>

        {/* Cycle Length Adjuster */}
        <View style={styles.newProfileAdjusterCard}>
          <NumberAdjuster
            label={t("profile.cycleLength")}
            hint={t("profile.cycleLengthHint")}
            value={cycleLength}
            min={21}
            max={40}
            onChange={onSetCycleLength}
          />
        </View>

        {/* Period Length Adjuster */}
        <View style={styles.newProfileAdjusterCard}>
          <NumberAdjuster
            label={t("profile.periodLength")}
            hint={t("profile.periodLengthHint")}
            value={periodLength}
            min={3}
            max={10}
            onChange={onSetPeriodLength}
          />
        </View>
      </ScrollView>
    </View>
  );
}
