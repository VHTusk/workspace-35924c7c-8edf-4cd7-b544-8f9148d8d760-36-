'use client'

import * as React from 'react'
import { Globe, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SUPPORTED_LOCALES, type SupportedLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  currentLanguage?: SupportedLanguage
  onLanguageChange?: (language: SupportedLanguage) => void
  variant?: 'default' | 'compact' | 'text'
  className?: string
}

/**
 * Language Switcher Component
 * 
 * Allows users to switch between supported languages (English, Hindi)
 * Persists preference to user profile and sets cookie for immediate effect
 */
export function LanguageSwitcher({
  currentLanguage = 'en',
  onLanguageChange,
  variant = 'default',
  className,
}: LanguageSwitcherProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedLanguage, setSelectedLanguage] = React.useState<SupportedLanguage>(currentLanguage)

  // Sync with prop changes
  React.useEffect(() => {
    setSelectedLanguage(currentLanguage)
  }, [currentLanguage])

  const handleLanguageChange = async (language: SupportedLanguage) => {
    if (language === selectedLanguage) return

    setIsLoading(true)
    
    try {
      // Call API to update language preference
      const response = await fetch('/api/user/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language }),
      })

      if (response.ok) {
        setSelectedLanguage(language)
        
        // Set cookie for immediate effect
        document.cookie = `language=${language}; path=/; max-age=${60 * 60 * 24 * 365}`
        
        // Call callback if provided
        onLanguageChange?.(language)
        
        // Reload page to apply translations
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to update language:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentLocale = SUPPORTED_LOCALES[selectedLanguage]

  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', className)}
            disabled={isLoading}
          >
            <Globe className="h-4 w-4" />
            <span className="sr-only">Switch language</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.values(SUPPORTED_LOCALES).map((locale) => (
            <DropdownMenuItem
              key={locale.code}
              onClick={() => handleLanguageChange(locale.code)}
              className="flex items-center justify-between"
            >
              <span>{locale.nativeName}</span>
              {selectedLanguage === locale.code && (
                <Check className="h-4 w-4 ml-2" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (variant === 'text') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2', className)}
            disabled={isLoading}
          >
            <Globe className="h-4 w-4" />
            {currentLocale?.nativeName}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.values(SUPPORTED_LOCALES).map((locale) => (
            <DropdownMenuItem
              key={locale.code}
              onClick={() => handleLanguageChange(locale.code)}
              className="flex items-center justify-between"
            >
              <span>{locale.nativeName}</span>
              {selectedLanguage === locale.code && (
                <Check className="h-4 w-4 ml-2" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Default variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', className)}
          disabled={isLoading}
        >
          <Globe className="h-4 w-4" />
          <span>{currentLocale?.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {Object.values(SUPPORTED_LOCALES).map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => handleLanguageChange(locale.code)}
            className={cn(
              'flex items-center justify-between cursor-pointer',
              selectedLanguage === locale.code && 'bg-accent'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{locale.nativeName}</span>
              <span className="text-muted-foreground text-sm">
                ({locale.name})
              </span>
            </div>
            {selectedLanguage === locale.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Simple language badge for display purposes
 */
export function LanguageBadge({ 
  language = 'en',
  className 
}: { 
  language?: SupportedLanguage
  className?: string 
}) {
  const locale = SUPPORTED_LOCALES[language]
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted',
      className
    )}>
      <Globe className="h-3 w-3" />
      {locale?.nativeName}
    </span>
  )
}

export default LanguageSwitcher
