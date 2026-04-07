/**
 * Docker Secrets Helper
 * 
 * Reads secrets from files when using Docker secrets (_FILE suffix convention).
 * Falls back to environment variables when not using Docker secrets.
 * 
 * Docker secrets convention:
 * - Environment variable: MY_SECRET
 * - File-based secret: MY_SECRET_FILE (points to file path like /run/secrets/my_secret)
 * 
 * @module lib/secrets
 */

import * as fs from 'fs';

/**
 * Read a secret value, supporting Docker secrets (_FILE suffix convention)
 * 
 * @param envName - The base environment variable name (e.g., 'DATABASE_URL')
 * @param defaultValue - Optional default value if not found
 * @returns The secret value
 */
export function readSecret(envName: string, defaultValue?: string): string | undefined {
  // First, check if there's a _FILE variant
  const fileEnvName = `${envName}_FILE`;
  const filePath = process.env[fileEnvName];
  
  if (filePath && fs.existsSync(filePath)) {
    try {
      const secretValue = fs.readFileSync(filePath, 'utf8').trim();
      return secretValue;
    } catch (error) {
      console.error(`[Secrets] Failed to read secret from ${filePath}:`, error);
    }
  }
  
  // Fall back to regular environment variable
  const envValue = process.env[envName];
  if (envValue !== undefined) {
    return envValue;
  }
  
  // Return default if provided
  return defaultValue;
}

/**
 * Read a required secret (throws if not found)
 */
export function readRequiredSecret(envName: string): string {
  const value = readSecret(envName);
  if (!value) {
    throw new Error(`Required secret ${envName} not found. Set ${envName} or ${envName}_FILE environment variable.`);
  }
  return value;
}

/**
 * Read a numeric secret
 */
export function readNumericSecret(envName: string, defaultValue: number): number {
  const value = readSecret(envName);
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`[Secrets] Failed to parse ${envName} as number, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Read a boolean secret
 */
export function readBooleanSecret(envName: string, defaultValue: boolean): boolean {
  const value = readSecret(envName);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Read a JSON secret
 */
export function readJsonSecret<T>(envName: string, defaultValue: T): T {
  const value = readSecret(envName);
  if (!value) return defaultValue;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    console.warn(`[Secrets] Failed to parse ${envName} as JSON, using default`);
    return defaultValue;
  }
}

/**
 * Check if running with Docker secrets
 */
export function isUsingDockerSecrets(): boolean {
  // Check for common Docker secrets paths
  const secretsPath = '/run/secrets';
  return fs.existsSync(secretsPath);
}

/**
 * List available Docker secrets
 */
export function listDockerSecrets(): string[] {
  const secretsPath = '/run/secrets';
  if (!fs.existsSync(secretsPath)) {
    return [];
  }
  
  try {
    return fs.readdirSync(secretsPath);
  } catch {
    return [];
  }
}

export default {
  readSecret,
  readRequiredSecret,
  readNumericSecret,
  readBooleanSecret,
  readJsonSecret,
  isUsingDockerSecrets,
  listDockerSecrets,
};
