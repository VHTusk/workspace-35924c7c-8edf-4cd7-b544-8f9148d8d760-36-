import { afterEach, vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-purposes';
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-for-testing';

// Note: Web Crypto API is available in Node.js 19+ and Bun by default
// No need to polyfill crypto

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
