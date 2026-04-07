"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type SupportedLanguage, getAvailableLanguages } from "./translations";

// ============================================
// Type Definitions
// ============================================

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  availableLanguages: ReturnType<typeof getAvailableLanguages>;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = "valorhive-language";
const DEFAULT_LANGUAGE: SupportedLanguage = "en";

// ============================================
// Context Creation
// ============================================

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// ============================================
// Helper Functions
// ============================================

/**
 * Get the initial language from localStorage or default
 * This is called during initial render
 */
function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // Validate that it's a supported language
      const availableLanguages = getAvailableLanguages();
      const isValid = availableLanguages.some((lang) => lang.code === stored);
      if (isValid) {
        return stored as SupportedLanguage;
      }
    }
  } catch (error) {
    console.error("[LanguageContext] Error reading language from localStorage:", error);
  }

  return DEFAULT_LANGUAGE;
}

// ============================================
// Provider Component
// ============================================

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  // Use lazy initializer to get language from localStorage on first render
  const [language, setLanguageState] = useState<SupportedLanguage>(getInitialLanguage);
  const availableLanguages = getAvailableLanguages();

  // Set language and persist to localStorage
  const setLanguage = useCallback((newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage);
    
    try {
      localStorage.setItem(STORAGE_KEY, newLanguage);
      
      // Dispatch custom event for other components to react
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("languagechange", {
            detail: { language: newLanguage },
          })
        );
      }
    } catch (error) {
      console.error("[LanguageContext] Error saving language to localStorage:", error);
    }
  }, []);

  // Context value
  const value: LanguageContextType = {
    language,
    setLanguage,
    availableLanguages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

/**
 * Hook to access the current language context
 * Must be used within a LanguageProvider
 */
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  
  return context;
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to get just the current language code
 */
export function useCurrentLanguage(): SupportedLanguage {
  const { language } = useLanguage();
  return language;
}

/**
 * Hook to get the language changer function
 */
export function useSetLanguage() {
  const { setLanguage } = useLanguage();
  return setLanguage;
}

// ============================================
// Export
// ============================================

export default LanguageContext;
