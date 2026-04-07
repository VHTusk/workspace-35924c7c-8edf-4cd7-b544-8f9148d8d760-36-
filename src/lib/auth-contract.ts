export const AUTH_CODES = {
  ACCOUNT_ALREADY_REGISTERED: 'ACCOUNT_ALREADY_REGISTERED',
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_VERIFICATION_SENT: 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  INVALID_IDENTIFIER_FORMAT: 'INVALID_IDENTIFIER_FORMAT',
  INVALID_OTP: 'INVALID_OTP',
  INVALID_PHONE_FORMAT: 'INVALID_PHONE_FORMAT',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  INVALID_SPORT: 'INVALID_SPORT',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  OTP_ALREADY_USED: 'OTP_ALREADY_USED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_RESENT: 'OTP_RESENT',
  OTP_SEND_FAILED: 'OTP_SEND_FAILED',
  OTP_SENT: 'OTP_SENT',
  OTP_VERIFIED: 'OTP_VERIFIED',
  PARTIAL_REGISTRATION_EXISTS: 'PARTIAL_REGISTRATION_EXISTS',
  PASSWORD_LOGIN_NOT_ENABLED: 'PASSWORD_LOGIN_NOT_ENABLED',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  PASSWORD_REUSE_NOT_ALLOWED: 'PASSWORD_REUSE_NOT_ALLOWED',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  REGISTRATION_SUCCESS: 'REGISTRATION_SUCCESS',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  RESET_LINK_EXPIRED: 'RESET_LINK_EXPIRED',
  SERVER_ERROR: 'SERVER_ERROR',
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
  SOCIAL_LOGIN_REQUIRED: 'SOCIAL_LOGIN_REQUIRED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VERIFICATION_PENDING: 'VERIFICATION_PENDING',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
} as const;

export type AuthCode = (typeof AUTH_CODES)[keyof typeof AUTH_CODES];

export type AuthField =
  | 'accountType'
  | 'confirmPassword'
  | 'email'
  | 'emailOrPhone'
  | 'firstName'
  | 'identifier'
  | 'lastName'
  | 'name'
  | 'otp'
  | 'password'
  | 'phone'
  | 'sport'
  | 'token';

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export interface AuthApiResponse<T extends Record<string, unknown> = Record<string, never>> {
  success: boolean;
  code: string;
  message: string;
  error?: string;
  field?: AuthField;
  fieldErrors?: AuthFieldErrors;
  retryAfterSeconds?: number;
  alreadyVerified?: boolean;
  canResendVerification?: boolean;
  requiresVerification?: boolean;
  emailVerificationPending?: boolean;
  details?: string;
  user?: Record<string, unknown>;
  organization?: Record<string, unknown>;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export function getAuthMessage(
  response: Partial<AuthApiResponse> | null | undefined,
  fallback: string,
): string {
  if (!response) {
    return fallback;
  }

  if (typeof response.message === 'string' && response.message.trim()) {
    return response.message;
  }

  if (typeof response.error === 'string' && response.error.trim()) {
    return response.error;
  }

  return fallback;
}

export function getAuthFieldErrors(
  response: Partial<AuthApiResponse> | null | undefined,
): AuthFieldErrors {
  if (!response?.fieldErrors || typeof response.fieldErrors !== 'object') {
    return {};
  }

  return response.fieldErrors;
}
