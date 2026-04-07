import { NextResponse } from 'next/server';
import type { AuthApiResponse, AuthCode, AuthField, AuthFieldErrors } from '@/lib/auth-contract';

type AuthResponseExtras = Omit<
  AuthApiResponse,
  'success' | 'code' | 'message' | 'error' | 'field' | 'fieldErrors'
> & {
  field?: AuthField;
  fieldErrors?: AuthFieldErrors;
};

export function authError(
  code: AuthCode,
  message: string,
  status: number,
  extras: AuthResponseExtras = {},
) {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      error: message,
      ...extras,
    } satisfies AuthApiResponse,
    { status },
  );
}

export function authSuccess<T extends Record<string, unknown>>(
  code: AuthCode,
  message: string,
  data?: T,
  status = 200,
) {
  return NextResponse.json(
    {
      success: true,
      code,
      message,
      ...(data ?? {}),
    } satisfies AuthApiResponse<T>,
    { status },
  );
}
