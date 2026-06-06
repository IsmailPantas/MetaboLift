import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import trCommon from './locales/tr/common.json';
import enCommon from './locales/en/common.json';

const STORAGE_KEY = 'app_language';
const FORCED_LANGUAGE = 'tr';
const SUPPORTED_LANGS = ['tr', 'en'];

const normalizeLng = lng => {
  if (!lng) return 'tr';
  const lower = String(lng).toLowerCase();
  if (SUPPORTED_LANGS.includes(lower)) return lower;
  const base = lower.split('-')[0];
  return SUPPORTED_LANGS.includes(base) ? base : 'tr';
};

const resources = {
  tr: { common: trCommon },
  en: { common: enCommon },
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources,
  lng: FORCED_LANGUAGE,
  fallbackLng: 'tr',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
});

export const setAppLanguage = async lng => {
  if (FORCED_LANGUAGE) {
    await i18n.changeLanguage(FORCED_LANGUAGE);
    await AsyncStorage.setItem(STORAGE_KEY, FORCED_LANGUAGE);
    return;
  }
  const normalized = normalizeLng(lng);
  await i18n.changeLanguage(normalized);
  await AsyncStorage.setItem(STORAGE_KEY, normalized);
};

export const hydrateSavedLanguage = async () => {
  if (FORCED_LANGUAGE) {
    await i18n.changeLanguage(FORCED_LANGUAGE);
    await AsyncStorage.setItem(STORAGE_KEY, FORCED_LANGUAGE);
    return;
  }
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      await i18n.changeLanguage(normalizeLng(saved));
    }
  } catch {
    // Keep device language fallback when storage read fails.
  }
};

hydrateSavedLanguage();

export default i18n;
