/**
 * VALORHIVE Internationalization (i18n) Utilities
 * 
 * Supports Indian languages and Indian number system (lakhs, crores)
 * Primary currency: INR (Indian Rupee)
 */

import { db } from './db'
import fs from 'fs'
import path from 'path'

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SupportedLanguage = 'en' | 'hi'

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP'

export interface LocaleConfig {
  code: SupportedLanguage
  name: string
  nativeName: string
  rtl: boolean // Right-to-left
  dateFormat: string
  timeFormat: string
  currencySymbol: string
}

export interface NumberFormattingOptions {
  style?: 'decimal' | 'currency' | 'percent'
  notation?: 'standard' | 'compact'
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export interface DateFormatOptions {
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
  weekday?: 'long' | 'short' | 'narrow'
  year?: 'numeric' | '2-digit'
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
  day?: 'numeric' | '2-digit'
}

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary
}

// ============================================
// LOCALE CONFIGURATIONS
// ============================================

export const SUPPORTED_LOCALES: Record<SupportedLanguage, LocaleConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    rtl: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currencySymbol: '₹',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    rtl: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currencySymbol: '₹',
  },
}

// Default locale
export const DEFAULT_LOCALE: SupportedLanguage = 'en'

// Default currency
export const DEFAULT_CURRENCY: SupportedCurrency = 'INR'

// ============================================
// TRANSLATION CACHE
// ============================================

const translationCache: Map<SupportedLanguage, TranslationDictionary> = new Map()

/**
 * Load translations for a given locale
 */
function loadTranslationsSync(locale: SupportedLanguage): TranslationDictionary {
  // Check cache first
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!
  }

  try {
    const translationsPath = path.join(process.cwd(), 'src', 'lib', 'translations', `${locale}.json`)
    const fileContents = fs.readFileSync(translationsPath, 'utf8')
    const translations = JSON.parse(fileContents) as TranslationDictionary
    
    // Cache the translations
    translationCache.set(locale, translations)
    
    return translations
  } catch (error) {
    console.error(`[i18n] Error loading translations for ${locale}:`, error)
    
    // Return empty object if translations can't be loaded
    return {}
  }
}

/**
 * Get translations for a locale
 * @param locale - The locale to get translations for
 * @returns Translation dictionary
 */
export function getTranslations(locale: string): TranslationDictionary {
  const normalizedLocale = normalizeLanguage(locale)
  return loadTranslationsSync(normalizedLocale)
}

/**
 * Get a translation by key with optional interpolation
 * 
 * @param key - Dot-notation key (e.g., 'auth.loginTitle')
 * @param params - Optional interpolation parameters
 * @param locale - Target language
 * @returns Translated string
 * 
 * @example
 * t('auth.loginTitle') // 'Sign in to your account'
 * t('dashboard.welcome', { name: 'John' }) // 'Welcome, John!'
 * t('dashboard.welcome', { name: 'John' }, 'hi') // 'स्वागत है, John!'
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
  locale: SupportedLanguage = DEFAULT_LOCALE
): string {
  const translations = getTranslations(locale)
  
  // Navigate the nested object using dot notation
  const keys = key.split('.')
  let result: string | TranslationDictionary | undefined = translations
  
  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = result[k] as string | TranslationDictionary
    } else {
      // Key not found, return the key itself
      return key
    }
  }
  
  // If result is not a string, return the key
  if (typeof result !== 'string') {
    return key
  }
  
  // Apply interpolation
  if (params) {
    let interpolated = result
    for (const [paramKey, value] of Object.entries(params)) {
      interpolated = interpolated.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value))
    }
    return interpolated
  }
  
  return result
}

/**
 * Create a translation function bound to a specific locale
 * Useful for components that need to translate multiple strings
 * 
 * @param locale - The locale to bind to
 * @returns A translation function bound to the locale
 * 
 * @example
 * const t = createTranslator('hi')
 * t('auth.loginTitle') // 'अपने खाते में लॉग इन करें'
 */
export function createTranslator(locale: SupportedLanguage) {
  return (key: string, params?: Record<string, string | number>) => t(key, params, locale)
}

// ============================================
// LOCALE DETECTION
// ============================================

/**
 * Get the locale string for Intl formatting
 * Maps our language codes to proper locale strings
 */
export function getIntlLocale(language: SupportedLanguage = DEFAULT_LOCALE): string {
  const localeMap: Record<SupportedLanguage, string> = {
    en: 'en-IN', // Indian English for proper number formatting
    hi: 'hi-IN',
  }
  return localeMap[language] || 'en-IN'
}

/**
 * Check if a language code is supported
 */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return code in SUPPORTED_LOCALES
}

/**
 * Validate and normalize language code
 * Returns default language if not supported
 */
export function normalizeLanguage(language: string): SupportedLanguage {
  if (isSupportedLanguage(language)) {
    return language
  }
  return DEFAULT_LOCALE
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format currency amount with proper symbol and locale
 * 
 * @param amount - Amount in smallest currency unit (paise for INR)
 * @param currency - Currency code (default: INR)
 * @param language - Locale language (default: en)
 * @param showSymbol - Whether to show currency symbol (default: true)
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(100000) // '₹1,000.00'
 * formatCurrency(150000, 'INR', 'hi') // '₹1,500.00' in Hindi locale
 * formatCurrency(100000, 'USD', 'en') // '$1,000.00'
 */
export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = DEFAULT_CURRENCY,
  language: SupportedLanguage = DEFAULT_LOCALE,
  showSymbol: boolean = true
): string {
  // Convert paise to rupees for INR (amount stored in paise)
  const displayAmount = currency === 'INR' ? amount / 100 : amount
  
  const locale = getIntlLocale(language)
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    
    const formatted = formatter.format(displayAmount)
    
    // Optionally hide symbol
    if (!showSymbol) {
      return formatted.replace(/[₹$€£]/g, '').trim()
    }
    
    return formatted
  } catch {
    // Fallback for unsupported currencies
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'
    return `${symbol}${displayAmount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

/**
 * Format currency in Indian notation (lakhs, crores)
 * 
 * @param amount - Amount in smallest currency unit (paise for INR)
 * @param language - Locale language (default: en)
 * @returns Formatted currency string in Indian notation
 * 
 * @example
 * formatCurrencyIndian(15000000) // '₹1.50 Lakh' or '₹1.50 लाख'
 * formatCurrencyIndian(1500000000) // '₹15.00 Crore' or '₹15.00 करोड़'
 */
export function formatCurrencyIndian(
  amount: number,
  language: SupportedLanguage = DEFAULT_LOCALE
): string {
  // Convert paise to rupees
  const rupees = amount / 100
  
  // Get translated terms
  const croreTerm = t('indianNumberSystem.crore', {}, language)
  const lakhTerm = t('indianNumberSystem.lakh', {}, language)
  
  if (rupees >= 10000000) {
    // 1 Crore = 1,00,00,000
    const crores = rupees / 10000000
    return `₹${crores.toFixed(2)} ${croreTerm}`
  } else if (rupees >= 100000) {
    // 1 Lakh = 1,00,000
    const lakhs = rupees / 100000
    return `₹${lakhs.toFixed(2)} ${lakhTerm}`
  } else {
    return formatCurrency(amount, 'INR', language)
  }
}

// ============================================
// DATE/TIME FORMATTING
// ============================================

/**
 * Format date in locale
 * 
 * @param date - Date to format
 * @param language - Locale language (default: en)
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 * 
 * @example
 * formatDate(new Date()) // '15/01/2024'
 * formatDate(new Date(), 'hi', { dateStyle: 'long' }) // '15 जनवरी 2024'
 */
export function formatDate(
  date: Date | string | number,
  language: SupportedLanguage = DEFAULT_LOCALE,
  options: DateFormatOptions = { dateStyle: 'medium' }
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date
  
  const locale = getIntlLocale(language)
  
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: options.dateStyle,
      weekday: options.weekday,
      year: options.year,
      month: options.month,
      day: options.day,
    })
    
    return formatter.format(dateObj)
  } catch {
    // Fallback to ISO date format
    return dateObj.toLocaleDateString('en-IN')
  }
}

/**
 * Format date and time in locale
 * 
 * @param date - Date to format
 * @param language - Locale language (default: en)
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date and time string
 * 
 * @example
 * formatDateTime(new Date()) // '15/01/2024, 14:30:00'
 * formatDateTime(new Date(), 'hi', { dateStyle: 'long', timeStyle: 'short' })
 */
export function formatDateTime(
  date: Date | string | number,
  language: SupportedLanguage = DEFAULT_LOCALE,
  options: DateFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date
  
  const locale = getIntlLocale(language)
  
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: options.dateStyle,
      timeStyle: options.timeStyle,
      weekday: options.weekday,
      year: options.year,
      month: options.month,
      day: options.day,
      hour: 'numeric',
      minute: 'numeric',
      second: options.timeStyle === 'full' ? 'numeric' : undefined,
    })
    
    return formatter.format(dateObj)
  } catch {
    // Fallback
    return dateObj.toLocaleString('en-IN')
  }
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 * 
 * @param date - Date to compare
 * @param language - Locale language (default: en)
 * @returns Relative time string
 * 
 * @example
 * formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000)) // '2 hours ago'
 * formatRelativeTime(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) // '3 days ago'
 */
export function formatRelativeTime(
  date: Date | string | number,
  language: SupportedLanguage = DEFAULT_LOCALE
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date
  
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)
  
  const locale = getIntlLocale(language)
  
  // Determine the unit and value
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
    { unit: 'year', seconds: 365 * 24 * 60 * 60 },
    { unit: 'month', seconds: 30 * 24 * 60 * 60 },
    { unit: 'week', seconds: 7 * 24 * 60 * 60 },
    { unit: 'day', seconds: 24 * 60 * 60 },
    { unit: 'hour', seconds: 60 * 60 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ]
  
  for (const { unit, seconds } of units) {
    const value = Math.floor(diffInSeconds / seconds)
    
    if (value >= 1) {
      try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
        return rtf.format(-value, unit)
      } catch {
        // Fallback for older browsers
        return `${value} ${unit}${value !== 1 ? 's' : ''} ago`
      }
    }
  }
  
  // Less than a second ago
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    return rtf.format(0, 'second')
  } catch {
    return t('time.justNow', {}, language)
  }
}

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Format number in locale
 * 
 * @param num - Number to format
 * @param language - Locale language (default: en)
 * @param options - Number formatting options
 * @returns Formatted number string
 * 
 * @example
 * formatNumber(1234567) // '12,34,567' (Indian grouping)
 * formatNumber(1234567, 'en', { notation: 'compact' }) // '1.2M'
 */
export function formatNumber(
  num: number,
  language: SupportedLanguage = DEFAULT_LOCALE,
  options: NumberFormattingOptions = {}
): string {
  const locale = getIntlLocale(language)
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: options.style || 'decimal',
      notation: options.notation,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
    })
    
    return formatter.format(num)
  } catch {
    // Fallback
    return num.toLocaleString('en-IN')
  }
}

/**
 * Format number in Indian system (lakhs, crores)
 * Indian grouping: 12,34,567 (2-2-2-... pattern from right after first 3 digits)
 * 
 * @param num - Number to format
 * @param language - Locale language (default: en)
 * @returns Formatted number string with Indian grouping
 * 
 * @example
 * formatNumberIndian(1234567) // '12,34,567'
 * formatNumberIndian(10000000) // '1,00,00,000'
 */
export function formatNumberIndian(
  num: number,
  language: SupportedLanguage = DEFAULT_LOCALE
): string {
  // en-IN locale automatically uses Indian grouping
  const locale = getIntlLocale(language)
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'decimal',
      useGrouping: true,
    })
    
    return formatter.format(num)
  } catch {
    // Manual fallback for Indian number system
    return formatIndianNumbering(num)
  }
}

/**
 * Manual implementation of Indian number formatting
 * Uses 2-2-2-... grouping from right after first 3 digits
 */
function formatIndianNumbering(num: number): string {
  const parts = num.toFixed(0).split('')
  const result: string[] = []
  
  // Process from right
  let count = 0
  for (let i = parts.length - 1; i >= 0; i--) {
    result.unshift(parts[i]!)
    count++
    
    // First comma after 3 digits, then every 2 digits
    if (count === 3 && i > 0) {
      result.unshift(',')
      count = 0
    } else if (count === 2 && i > 0 && result[0] !== ',') {
      result.unshift(',')
      count = 0
    }
  }
  
  return result.join('')
}

/**
 * Format number with Indian terms (lakhs, crores)
 * 
 * @param num - Number to format
 * @param language - Locale language (default: en)
 * @returns Formatted string with lakh/crore suffix
 * 
 * @example
 * formatLakhsCrores(150000) // '1.50 Lakh'
 * formatLakhsCrores(15000000) // '1.50 Crore'
 * formatLakhsCrores(15000000, 'hi') // '1.50 लाख'
 */
export function formatLakhsCrores(
  num: number,
  language: SupportedLanguage = DEFAULT_LOCALE
): string {
  const croreTerm = t('indianNumberSystem.crore', {}, language)
  const lakhTerm = t('indianNumberSystem.lakh', {}, language)
  const thousandTerm = t('indianNumberSystem.thousand', {}, language)
  
  if (num >= 10000000) {
    // 1 Crore = 1,00,00,000
    const crores = num / 10000000
    return `${crores.toFixed(2)} ${croreTerm}`
  } else if (num >= 100000) {
    // 1 Lakh = 1,00,000
    const lakhs = num / 100000
    return `${lakhs.toFixed(2)} ${lakhTerm}`
  } else if (num >= 1000) {
    const thousands = num / 1000
    return `${thousands.toFixed(2)} ${thousandTerm}`
  } else {
    return num.toString()
  }
}

/**
 * Parse Indian number string to number
 * Handles lakh/crore suffixes
 * 
 * @param str - Number string (e.g., "1.5 Lakh", "12,34,567")
 * @returns Parsed number
 * 
 * @example
 * parseIndianNumber('1.5 Lakh') // 150000
 * parseIndianNumber('12,34,567') // 1234567
 */
export function parseIndianNumber(str: string): number {
  const cleanStr = str.toLowerCase().trim()
  
  // Handle lakh/crore suffixes
  if (cleanStr.includes('lakh') || cleanStr.includes('लाख')) {
    const num = parseFloat(cleanStr.replace(/[^\d.]/g, ''))
    return num * 100000
  }
  
  if (cleanStr.includes('crore') || cleanStr.includes('करोड़')) {
    const num = parseFloat(cleanStr.replace(/[^\d.]/g, ''))
    return num * 10000000
  }
  
  // Remove commas and parse
  return parseFloat(cleanStr.replace(/,/g, ''))
}

// ============================================
// USER LANGUAGE PREFERENCE
// ============================================

/**
 * Get user's preferred language from database
 * 
 * @param userId - User ID
 * @returns User's preferred language (defaults to 'en')
 */
export async function getUserLanguage(userId: string): Promise<SupportedLanguage> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { language: true },
    })
    
    if (user?.language && isSupportedLanguage(user.language)) {
      return user.language as SupportedLanguage
    }
    
    return DEFAULT_LOCALE
  } catch (error) {
    console.error('[i18n] Error getting user language:', error)
    return DEFAULT_LOCALE
  }
}

/**
 * Set user's preferred language
 * 
 * @param userId - User ID
 * @param language - Language code to set
 * @returns Success status
 */
export async function setUserLanguage(
  userId: string,
  language: SupportedLanguage
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate language
    if (!isSupportedLanguage(language)) {
      return { 
        success: false, 
        error: `Unsupported language: ${language}. Supported: ${Object.keys(SUPPORTED_LOCALES).join(', ')}` 
      }
    }
    
    await db.user.update({
      where: { id: userId },
      data: { language },
    })
    
    return { success: true }
  } catch (error) {
    console.error('[i18n] Error setting user language:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update language preference' 
    }
  }
}

/**
 * Get organization's preferred language
 * 
 * @param orgId - Organization ID
 * @returns Organization's preferred language (defaults to 'en')
 */
export async function getOrgLanguage(orgId: string): Promise<SupportedLanguage> {
  try {
    // Organizations default to English for now
    // Could be extended to have org-specific language preferences
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true }, // No language field on org currently
    })
    
    return DEFAULT_LOCALE
  } catch (error) {
    console.error('[i18n] Error getting org language:', error)
    return DEFAULT_LOCALE
  }
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): LocaleConfig[] {
  return Object.values(SUPPORTED_LOCALES)
}

/**
 * Get locale configuration
 */
export function getLocaleConfig(language: SupportedLanguage): LocaleConfig {
  return SUPPORTED_LOCALES[language] || SUPPORTED_LOCALES[DEFAULT_LOCALE]
}

/**
 * Check if locale is RTL (right-to-left)
 */
export function isRTL(language: SupportedLanguage): boolean {
  return SUPPORTED_LOCALES[language]?.rtl ?? false
}

/**
 * Get text direction for HTML
 */
export function getTextDirection(language: SupportedLanguage): 'ltr' | 'rtl' {
  return isRTL(language) ? 'rtl' : 'ltr'
}

/**
 * Clear translation cache (useful for development)
 */
export function clearTranslationCache(): void {
  translationCache.clear()
}
