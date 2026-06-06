import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import trCommon from './locales/tr/common.json';
import enCommon from './locales/en/common.json';

const FORCED_LANGUAGE = 'tr';

const normalizeLng = lng => {
  if (!lng) return 'tr';
  const lower = String(lng).toLowerCase();
  const base = lower.split('-')[0];
  return ['tr', 'en'].includes(base) ? base : 'tr';
};

const resources = {
  tr: { common: trCommon },
  en: { common: enCommon },
};

i18n.use(initReactI18next).init({
  resources,
  lng: FORCED_LANGUAGE,
  fallbackLng: 'tr',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
});

export const setAppLanguage = lng => {
  if (FORCED_LANGUAGE) {
    i18n.changeLanguage(FORCED_LANGUAGE);
    window?.localStorage?.setItem('app_language', FORCED_LANGUAGE);
    return;
  }
  const normalized = normalizeLng(lng);
  i18n.changeLanguage(normalized);
  window?.localStorage?.setItem('app_language', normalized);
};

export default i18n;
