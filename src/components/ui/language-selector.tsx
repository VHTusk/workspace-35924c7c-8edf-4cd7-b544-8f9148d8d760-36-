"use client";

import { useLanguage } from "@/lib/language-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Type Definitions
// ============================================

interface LanguageSelectorProps {
  variant?: "default" | "compact" | "icon";
  className?: string;
  align?: "start" | "center" | "end";
}

// ============================================
// Language Display Data
// ============================================

// Language scripts/indicators for visual display
const LANGUAGE_INDICATORS: Record<string, string> = {
  en: "EN",
  hi: "हि",
  ta: "த",
  te: "తె",
  mr: "म",
  kn: "ಕ",
};

// ============================================
// Component
// ============================================

export function LanguageSelector({
  variant = "default",
  className,
  align = "end",
}: LanguageSelectorProps) {
  const { language, setLanguage, availableLanguages } = useLanguage();

  const currentLanguage = availableLanguages.find((lang) => lang.code === language);

  if (variant === "icon") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-9 w-9", className)}
            aria-label="Select language"
          >
            <Languages className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-48">
          {availableLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                language === lang.code && "bg-accent"
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium">{lang.nativeName}</span>
                <span className="text-xs text-muted-foreground">{lang.name}</span>
              </div>
              {language === lang.code && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2 h-8", className)}
            aria-label="Select language"
          >
            <span className="font-medium">
              {LANGUAGE_INDICATORS[language] || "EN"}
            </span>
            <Languages className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-48">
          {availableLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                language === lang.code && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-center font-medium text-sm">
                  {LANGUAGE_INDICATORS[lang.code]}
                </span>
                <span>{lang.nativeName}</span>
              </div>
              {language === lang.code && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-2", className)}
          aria-label="Select language"
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLanguage?.nativeName || "English"}
          </span>
          <span className="sm:hidden">
            {LANGUAGE_INDICATORS[language] || "EN"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Select Language / भाषा चुनें
        </div>
        {availableLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "flex items-center justify-between cursor-pointer py-2",
              language === lang.code && "bg-accent"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center font-semibold text-sm">
                {LANGUAGE_INDICATORS[lang.code]}
              </span>
              <div className="flex flex-col">
                <span className="font-medium">{lang.nativeName}</span>
                <span className="text-xs text-muted-foreground">{lang.name}</span>
              </div>
            </div>
            {language === lang.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// Export
// ============================================

export default LanguageSelector;
