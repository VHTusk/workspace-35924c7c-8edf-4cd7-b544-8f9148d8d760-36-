import { isValidIndianPhone, normalizePhoneNumber } from '@/lib/sms-service';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function trimToUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeEmail(email?: string | null): string | null {
  const trimmed = trimToUndefined(email);
  return trimmed ? trimmed.toLowerCase() : null;
}

export function normalizePhone(phone?: string | null): string | null {
  const trimmed = trimToUndefined(phone);
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  return digits;
}

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 255;
}

export function isValidPhoneNumber(phone: string): boolean {
  return isValidIndianPhone(normalizePhoneNumber(phone));
}

export function detectIdentifierType(value?: string | null): 'email' | 'phone' | null {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('@')) {
    return isValidEmailAddress(trimmed) ? 'email' : null;
  }

  return isValidPhoneNumber(trimmed) ? 'phone' : null;
}

export function sanitizeName(value?: string | null): string {
  return value?.trim() ?? '';
}
