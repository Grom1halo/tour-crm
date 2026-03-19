import React, { createContext, useContext, useState } from 'react';
import { ru } from './ru';
import { en } from './en';
import type { Translations } from './ru';

type Lang = 'ru' | 'en';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'ru');

  const handleSetLang = (l: Lang) => {
    localStorage.setItem('lang', l);
    setLang(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t: lang === 'ru' ? ru : en }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
