import i18next from 'i18next';
import Backend from 'i18next-fs-backend';

i18next.use(Backend).init({
  lng: 'en',
  fallbackLng: 'en',
  backend: {
    loadPath: './locales/{{lng}}/{{ns}}.json',
  },
});

export default i18next;
