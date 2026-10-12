import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationEN from './locales/en/translation.json';
import translationVI from './locales/vi/translation.json';

const resources = {
  en: { translation: translationEN },
  vi: { translation: translationVI }
};

const savedLanguage =
  (typeof window !== 'undefined' &&
    (localStorage.getItem('i18nextLng') || localStorage.getItem('multilingo_language'))) ||
  'vi';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false
    }
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('i18nextLng', lng);
    localStorage.setItem('multilingo_language', lng);
  }
});

export default i18n;
