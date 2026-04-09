"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type SupportedLanguage } from "@/lib/translations";

interface AvailableLanguage {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  availableLanguages: AvailableLanguage[];
}

const STORAGE_KEY = "valorhive-language";
const COOKIE_KEY = "language";
const DEFAULT_LANGUAGE: SupportedLanguage = "en";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function isDualLanguage(value: string | null | undefined): value is SupportedLanguage {
  return value === "en" || value === "hi";
}

function getCookieLanguage(): SupportedLanguage | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieValue = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE_KEY}=`))
    ?.split("=")[1];

  return isDualLanguage(cookieValue) ? cookieValue : null;
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const cookieLanguage = getCookieLanguage();
  if (cookieLanguage) {
    return cookieLanguage;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isDualLanguage(stored)) {
      return stored;
    }
  } catch (error) {
    console.error("[LanguageContext] Failed to read stored language:", error);
  }

  return DEFAULT_LANGUAGE;
}

function applyLanguageToDocument(language: SupportedLanguage) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = language;
  document.documentElement.dir = "ltr";
}

function persistLanguageLocally(language: SupportedLanguage) {
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_KEY}=${language}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, language);
  }
}

async function persistLanguageRemotely(language: SupportedLanguage) {
  try {
    const response = await fetch("/api/user/language", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ language }),
    });

    if (response.status === 401) {
      return;
    }

    if (!response.ok) {
      throw new Error(`Language update failed with status ${response.status}`);
    }
  } catch (error) {
    console.error("[LanguageContext] Failed to persist language remotely:", error);
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(getInitialLanguage);

  const availableLanguages = useMemo<AvailableLanguage[]>(
    () => [
      { code: "en", name: "English", nativeName: "English" },
      { code: "hi", name: "Hindi", nativeName: "हिंदी" },
    ],
    [],
  );

  useEffect(() => {
    applyLanguageToDocument(language);
    persistLanguageLocally(language);
  }, [language]);

  const setLanguage = useCallback(async (nextLanguage: SupportedLanguage) => {
    if (!isDualLanguage(nextLanguage) || nextLanguage === language) {
      return;
    }

    setLanguageState(nextLanguage);
    persistLanguageLocally(nextLanguage);
    applyLanguageToDocument(nextLanguage);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("languagechange", {
          detail: { language: nextLanguage },
        }),
      );
    }

    await persistLanguageRemotely(nextLanguage);
  }, [language]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      availableLanguages,
    }),
    [availableLanguages, language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
}

export function useCurrentLanguage(): SupportedLanguage {
  return useLanguage().language;
}

export function useSetLanguage() {
  return useLanguage().setLanguage;
}
