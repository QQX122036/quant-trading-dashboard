import { createContext, useContext, createSignal, ParentComponent, createMemo } from 'solid-js';
import { zh } from './zh';
import { en } from './en';

export type Locale = 'zh' | 'en';
export type Translations = typeof zh;

const dictionaries: Record<Locale, Translations> = { zh, en };

interface I18nContextValue {
  locale: () => Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>();

export const I18nProvider: ParentComponent = (props) => {
  const [locale, setLocale] = createSignal<Locale>('zh');

  const value = createMemo(() => ({
    locale,
    setLocale,
    t: dictionaries[locale()],
  }));

  return (
    <I18nContext.Provider value={value()}>
      {props.children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};

export { zh, en };
