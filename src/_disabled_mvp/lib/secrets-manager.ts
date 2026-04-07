/**
 * AWS Secrets Manager Integration for VALORHIVE
 * 
 * Secure secrets management with:
 * - Automatic secret retrieval and caching
 * - Secret rotation support
 * - Fallback to environment variables
 * - Encrypted secret storage
 * 
 * Environment Variables:
 * - AWS_SECRETS_MANAGER_ENABLED: Enable Secrets Manager (default: false in dev)
 * - AWS_SECRETS_MANAGER_REGION: AWS region for Secrets Manager
 * - AWS_SECRETS_PREFIX: Prefix for secret names (e.g., 'valorhive/prod/')
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
  ListSecretsCommand,
  DescribeSecretCommand,
  type GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import { createLogger } from './logger';

const logger = createLogger('SecretsManager');

// ============================================
// Types and Interfaces
// ============================================

export interface SecretValue {
  [key: string]: string;
}

export interface SecretMetadata {
  name: string;
  arn: string;
  lastChanged: Date;
  nextRotation?: Date;
  versionIdsToStages: Record<string, string[]>;
}

export interface SecretsManagerConfig {
  enabled: boolean;
  region: string;
  prefix: string;
  cacheTTL: number;
}

// ============================================
// Configuration
// ============================================

const getConfig = (): SecretsManagerConfig => ({
  enabled: process.env.AWS_SECRETS_MANAGER_ENABLED === 'true',
  region: process.env.AWS_SECRETS_MANAGER_REGION || process.env.AWS_REGION || 'ap-south-1',
  prefix: process.env.AWS_SECRETS_PREFIX || 'valorhive/',
  cacheTTL: parseInt(process.env.SECRETS_CACHE_TTL || '300000', 10), // 5 minutes
});

// ============================================
// Secrets Manager Client
// ============================================

let client: SecretsManagerClient | null = null;
const secretCache: Map<string, { value: SecretValue; expiresAt: number }> = new Map();

const getClient = (): SecretsManagerClient => {
  if (!client) {
    const config = getConfig();
    client = new SecretsManagerClient({
      region: config.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return client;
};

// ============================================
// Core Functions
// ============================================

/**
 * Get a secret from Secrets Manager
 */
export async function getSecret(secretName: string): Promise<SecretValue | null> {
  const config = getConfig();
  
  // Check if Secrets Manager is enabled
  if (!config.enabled) {
    logger.debug('Secrets Manager disabled, using environment fallback');
    return getFromEnvironment(secretName);
  }

  // Check cache
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug(`Secret ${secretName} retrieved from cache`);
    return cached.value;
  }

  try {
    const secretsClient = getClient();
    const fullName = `${config.prefix}${secretName}`;
    
    const command = new GetSecretValueCommand({ SecretId: fullName });
    const response: GetSecretValueCommandOutput = await secretsClient.send(command);
    
    let secretValue: SecretValue;
    
    if (response.SecretString) {
      secretValue = JSON.parse(response.SecretString);
    } else if (response.SecretBinary) {
      const buffer = Buffer.from(response.SecretBinary as Uint8Array);
      secretValue = JSON.parse(buffer.toString('utf-8'));
    } else {
      logger.warn(`Secret ${secretName} has no value`);
      return null;
    }

    // Cache the secret
    secretCache.set(secretName, {
      value: secretValue,
      expiresAt: Date.now() + config.cacheTTL,
    });

    logger.debug(`Secret ${secretName} retrieved successfully`);
    return secretValue;
  } catch (error) {
    logger.error(`Failed to get secret ${secretName}:`, error);
    
    // Fallback to environment
    return getFromEnvironment(secretName);
  }
}

/**
 * Get a single secret value by key
 */
export async function getSecretValue(secretName: string, key: string): Promise<string | null> {
  const secret = await getSecret(secretName);
  return secret?.[key] || null;
}

/**
 * Store a secret in Secrets Manager
 */
export async function storeSecret(
  secretName: string,
  secretValue: SecretValue,
  description?: string
): Promise<string | null> {
  const config = getConfig();
  
  if (!config.enabled) {
    logger.warn('Secrets Manager disabled, cannot store secret');
    return null;
  }

  try {
    const secretsClient = getClient();
    const fullName = `${config.prefix}${secretName}`;
    
    // Check if secret exists
    const existing = await getSecretMetadata(secretName);
    
    const command = existing
      ? new UpdateSecretCommand({
          SecretId: fullName,
          SecretString: JSON.stringify(secretValue),
          Description: description,
        })
      : new CreateSecretCommand({
          Name: fullName,
          SecretString: JSON.stringify(secretValue),
          Description: description,
        });

    const response = await secretsClient.send(command);
    
    // Invalidate cache
    secretCache.delete(secretName);
    
    logger.info(`Secret ${secretName} ${existing ? 'updated' : 'created'} successfully`);
    return response.ARN || null;
  } catch (error) {
    logger.error(`Failed to store secret ${secretName}:`, error);
    return null;
  }
}

/**
 * Delete a secret from Secrets Manager
 */
export async function deleteSecret(
  secretName: string,
  options: { recoverWindowDays?: number; forceDelete?: boolean } = {}
): Promise<boolean> {
  const config = getConfig();
  
  if (!config.enabled) {
    logger.warn('Secrets Manager disabled, cannot delete secret');
    return false;
  }

  try {
    const secretsClient = getClient();
    const fullName = `${config.prefix}${secretName}`;
    
    await secretsClient.send(new DeleteSecretCommand({
      SecretId: fullName,
      RecoveryWindowInDays: options.forceDelete ? undefined : (options.recoverWindowDays || 7),
      ForceDeleteWithoutRecovery: options.forceDelete,
    }));

    // Invalidate cache
    secretCache.delete(secretName);
    
    logger.info(`Secret ${secretName} deleted successfully`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete secret ${secretName}:`, error);
    return false;
  }
}

/**
 * Get secret metadata
 */
export async function getSecretMetadata(secretName: string): Promise<SecretMetadata | null> {
  const config = getConfig();
  
  if (!config.enabled) {
    return null;
  }

  try {
    const secretsClient = getClient();
    const fullName = `${config.prefix}${secretName}`;
    
    const response = await secretsClient.send(new DescribeSecretCommand({
      SecretId: fullName,
    }));

    return {
      name: response.Name || secretName,
      arn: response.ARN || '',
      lastChanged: response.LastChangedDate || new Date(),
      nextRotation: response.NextRotationDate,
      versionIdsToStages: response.VersionIdsToStages || {},
    };
  } catch (error) {
    return null;
  }
}

/**
 * List all secrets
 */
export async function listSecrets(): Promise<string[]> {
  const config = getConfig();
  
  if (!config.enabled) {
    return [];
  }

  try {
    const secretsClient = getClient();
    const secretNames: string[] = [];
    let nextToken: string | undefined;

    do {
      const response = await secretsClient.send(new ListSecretsCommand({
        Filters: [
          { Key: 'name', Values: [config.prefix] },
        ],
        NextToken: nextToken,
      }));

      for (const secret of response.SecretList || []) {
        if (secret.Name) {
          // Remove prefix from name
          secretNames.push(secret.Name.replace(config.prefix, ''));
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return secretNames;
  } catch (error) {
    logger.error('Failed to list secrets:', error);
    return [];
  }
}

/**
 * Clear the secrets cache
 */
export function clearSecretsCache(): void {
  secretCache.clear();
  logger.info('Secrets cache cleared');
}

/**
 * Refresh a specific secret in cache
 */
export async function refreshSecret(secretName: string): Promise<SecretValue | null> {
  secretCache.delete(secretName);
  return getSecret(secretName);
}

// ============================================
// Environment Fallback
// ============================================

/**
 * Get secret from environment variables as fallback
 */
function getFromEnvironment(secretName: string): SecretValue | null {
  // Map secret names to environment variable patterns
  const envMapping: Record<string, string[]> = {
    'database': ['DATABASE_URL', 'DIRECT_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
    'redis': ['REDIS_URL', 'REDIS_READONLY_URL', 'REDIS_PASSWORD'],
    'jwt': ['JWT_SECRET', 'JWT_EXPIRY'],
    'session': ['SESSION_SECRET', 'SESSION_TTL'],
    'razorpay': ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'],
    'aws': ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET_NAME'],
    'email': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
    'sms': ['MSG91_API_KEY', 'MSG91_SENDER_ID'],
    'push': ['FCM_PROJECT_ID', 'FCM_PRIVATE_KEY', 'FCM_CLIENT_EMAIL'],
    'sentry': ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN'],
  };

  const keys = envMapping[secretName.toLowerCase()] || [secretName.toUpperCase()];
  const values: SecretValue = {};
  let hasValue = false;

  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      values[key] = value;
      hasValue = true;
    }
  }

  return hasValue ? values : null;
}

// ============================================
// Application Secrets Helper
// ============================================

/**
 * Get all application secrets at once
 */
export async function loadApplicationSecrets(): Promise<{
  database: SecretValue | null;
  redis: SecretValue | null;
  jwt: SecretValue | null;
  session: SecretValue | null;
  razorpay: SecretValue | null;
  email: SecretValue | null;
}> {
  const [database, redis, jwt, session, razorpay, email] = await Promise.all([
    getSecret('database'),
    getSecret('redis'),
    getSecret('jwt'),
    getSecret('session'),
    getSecret('razorpay'),
    getSecret('email'),
  ]);

  // Apply secrets to environment if not already set
  applySecretsToEnv('database', database);
  applySecretsToEnv('redis', redis);
  applySecretsToEnv('jwt', jwt);
  applySecretsToEnv('session', session);
  applySecretsToEnv('razorpay', razorpay);
  applySecretsToEnv('email', email);

  return { database, redis, jwt, session, razorpay, email };
}

/**
 * Apply secrets to process.env
 */
function applySecretsToEnv(prefix: string, secrets: SecretValue | null): void {
  if (!secrets) return;

  for (const [key, value] of Object.entries(secrets)) {
    if (!process.env[key]) {
      process.env[key] = value;
      logger.debug(`Applied secret ${key} to environment`);
    }
  }
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize Secrets Manager and load secrets
 */
export async function initializeSecretsManager(): Promise<boolean> {
  const config = getConfig();
  
  if (!config.enabled) {
    logger.info('Secrets Manager not enabled, using environment variables');
    return false;
  }

  try {
    // Test connection
    const secrets = await listSecrets();
    logger.info(`Secrets Manager initialized with ${secrets.length} secrets available`);
    
    // Load application secrets
    await loadApplicationSecrets();
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize Secrets Manager:', error);
    return false;
  }
}

// ============================================
// Shutdown
// ============================================

/**
 * Shutdown Secrets Manager client
 */
export function shutdownSecretsManager(): void {
  client = null;
  clearSecretsCache();
  logger.info('Secrets Manager shutdown');
}
