"use client";

import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  variant?: "default" | "compact" | "icon";
  className?: string;
  align?: "start" | "center" | "end";
}

const LANGUAGE_INDICATORS: Record<string, string> = {
  en: "EN",
  hi: "हि",
};

export function LanguageSelector({
  variant = "default",
  className,
  align = "end",
}: LanguageSelectorProps) {
  const { language, setLanguage, availableLanguages } = useLanguage();
  const currentLanguage = availableLanguages.find((lang) => lang.code === language);

  const menuItems = availableLanguages.map((lang) => (
    <DropdownMenuItem
      key={lang.code}
      onClick={() => void setLanguage(lang.code)}
      className={cn(
        "flex cursor-pointer items-center justify-between",
        language === lang.code && "bg-accent",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-semibold">
          {LANGUAGE_INDICATORS[lang.code] || lang.code.toUpperCase()}
        </span>
        <div className="flex flex-col">
          <span className="font-medium">{lang.nativeName}</span>
          <span className="text-xs text-muted-foreground">{lang.name}</span>
        </div>
      </div>
      {language === lang.code && <Check className="h-4 w-4 text-primary" />}
    </DropdownMenuItem>
  ));

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
        <DropdownMenuContent align={align} className="w-52">
          {menuItems}
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
            className={cn("h-9 gap-2", className)}
            aria-label="Select language"
          >
            <span className="font-medium">{LANGUAGE_INDICATORS[language] || "EN"}</span>
            <Languages className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

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
          <span className="hidden sm:inline">{currentLanguage?.nativeName || "English"}</span>
          <span className="sm:hidden">{LANGUAGE_INDICATORS[language] || "EN"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Select Language / भाषा चुनें
        </div>
        {menuItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
