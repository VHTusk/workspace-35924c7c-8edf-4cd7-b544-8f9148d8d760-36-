export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  try {
    await import('./sentry.server.config');
  } catch (error) {
    console.warn(
      '[Instrumentation] Sentry server config unavailable:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  console.log('[Instrumentation] MVP server instrumentation initialized');
}

export default register;
