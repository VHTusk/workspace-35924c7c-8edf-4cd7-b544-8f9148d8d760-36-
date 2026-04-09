"use client";

import { useCallback, useMemo } from "react";
import { useLanguage } from "@/lib/language-context";
import {
  type SupportedLanguage,
  type TranslationStrings,
  getTranslations,
} from "@/lib/translations";

// ============================================
// Types
// ============================================

interface TranslationParams {
  [key: string]: string | number;
}

interface UseTranslationReturn {
  t: (key: string, params?: TranslationParams) => string;
  language: SupportedLanguage;
  translations: TranslationStrings;
  availableLanguages: Array<{ code: SupportedLanguage; name: string; nativeName: string }>;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: TranslationStrings, path: string): string | undefined {
  const keys = path.split(".");
  let result: TranslationStrings | string = obj;

  for (const key of keys) {
    if (typeof result === "object" && key in result) {
      result = result[key] as TranslationStrings | string;
    } else {
      return undefined;
    }
  }

  return typeof result === "string" ? result : undefined;
}

/**
 * Interpolate parameters into a translation string
 */
function interpolate(template: string, params: TranslationParams): string {
  let result = template;

  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }

  return result;
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook for accessing translations with current language
 * 
 * @example
 * const { t, language, setLanguage } = useTranslation();
 * 
 * // Get translation
 * const title = t('nav.dashboard'); // 'Dashboard' or 'डैशबोर्ड' based on language
 * 
 * // With parameters
 * const welcome = t('dashboard.welcome', { name: 'John' }); // 'Welcome back, John'
 * 
 * // Change language
 * setLanguage('hi');
 */
export function useTranslation(): UseTranslationReturn {
  const { language, setLanguage, availableLanguages } = useLanguage();

  // Get translations for current language
  const translations = useMemo(() => {
    return getTranslations(language);
  }, [language]);

  // Translation function with fallback to English
  const t = useCallback(
    (key: string, params?: TranslationParams): string => {
      // Try current language first
      let translation = getNestedValue(translations, key);

      // Fallback to English if not found
      if (translation === undefined && language !== "en") {
        const englishTranslations = getTranslations("en");
        translation = getNestedValue(englishTranslations, key);
      }

      // If still not found, return the key itself
      if (translation === undefined) {
        console.warn(`[Translation] Missing translation key: ${key}`);
        return key;
      }

      // Interpolate parameters if provided
      if (params) {
        return interpolate(translation, params);
      }

      return translation;
    },
    [translations, language]
  );

  return {
    t,
    language,
    translations,
    availableLanguages,
    setLanguage,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get translation for a key without using the hook
 * Useful for non-React code or server-side rendering
 */
export function getTranslation(
  key: string,
  language: SupportedLanguage = "en",
  params?: TranslationParams
): string {
  const translations = getTranslations(language);
  let translation = getNestedValue(translations, key);

  // Fallback to English
  if (translation === undefined && language !== "en") {
    const englishTranslations = getTranslations("en");
    translation = getNestedValue(englishTranslations, key);
  }

  if (translation === undefined) {
    return key;
  }

  if (params) {
    return interpolate(translation, params);
  }

  return translation;
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(key: string, language: SupportedLanguage = "en"): boolean {
  const translations = getTranslations(language);
  return getNestedValue(translations, key) !== undefined;
}

// ============================================
// Export
// ============================================

export default useTranslation;
