import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import tr from "./locales/tr.json";
import ru from "./locales/ru.json";

const LANGUAGE_STORAGE_KEY = "app_language";

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  tr: "Türkçe",
  ru: "Русский",
};

export type SupportedLanguage = "en" | "tr" | "ru";

export function getDateLocale(lang: SupportedLanguage): string {
  const map: Record<SupportedLanguage, string> = {
    en: "en-US",
    tr: "tr-TR",
    ru: "ru-RU",
  };
  return map[lang];
}

export async function persistLanguage(lang: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

function getDeviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales();
  if (locales.length > 0) {
    const code = locales[0].languageCode;
    if (code && code in SUPPORTED_LANGUAGES) {
      return code as SupportedLanguage;
    }
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
    ru: { translation: ru },
  },
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
  if (stored && stored in SUPPORTED_LANGUAGES) {
    i18n.changeLanguage(stored);
  }
});

export default i18n;
