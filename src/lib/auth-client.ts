import {
  AUTH_CODES,
  getAuthFieldErrors,
  getAuthMessage,
  type AuthApiResponse,
  type AuthField,
  type AuthFieldErrors,
} from '@/lib/auth-contract';

export interface ParsedAuthError {
  code: string | null;
  message: string;
  field?: AuthField;
  fieldErrors: AuthFieldErrors;
  retryAfterSeconds?: number;
}

export async function parseAuthResponse<T extends Record<string, unknown> = Record<string, never>>(
  response: Response,
  fallbackMessage: string,
): Promise<{ data: AuthApiResponse<T>; error: ParsedAuthError | null }> {
  let json: AuthApiResponse<T>;

  try {
    json = (await response.json()) as AuthApiResponse<T>;
  } catch {
    json = {
      success: false,
      code: AUTH_CODES.SERVER_ERROR,
      message: fallbackMessage,
      error: fallbackMessage,
    } as AuthApiResponse<T>;
  }

  if (response.ok && json.success) {
    return { data: json, error: null };
  }

  const fieldErrors = getAuthFieldErrors(json);

  if (json.field && json.message && !fieldErrors[json.field]) {
    fieldErrors[json.field] = json.message;
  }

  return {
    data: json,
    error: {
      code: typeof json.code === 'string' ? json.code : null,
      message: getAuthMessage(json, fallbackMessage),
      field: json.field,
      fieldErrors,
      retryAfterSeconds:
        typeof json.retryAfterSeconds === 'number' ? json.retryAfterSeconds : undefined,
    },
  };
}
