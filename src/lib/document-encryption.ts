/**
 * Document Encryption at Rest
 * 
 * Provides AES-256-GCM encryption for sensitive documents (KYC, identity proofs)
 * Documents are encrypted before storage and decrypted on retrieval
 */

import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // Initialization vector length
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length
const SALT_LENGTH = 64; // Salt for key derivation
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment
 * Falls back to deriving from master key if not set
 */
function getEncryptionKey(): Buffer {
  const key = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (key) {
    return Buffer.from(key, 'hex');
  }
  
  // Derive from master key (use only in development)
  const masterKey = process.env.ENCRYPTION_MASTER_KEY || 'valorhive-master-key-change-in-production';
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Derive a key from password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha512');
}

/**
 * Encrypt a document buffer
 * 
 * @param buffer - Document content as buffer
 * @param documentId - Unique identifier for the document (used for key derivation)
 * @returns Encrypted data with IV and auth tag
 */
export function encryptDocument(buffer: Buffer, documentId: string): {
  encrypted: Buffer;
  iv: string;
  authTag: string;
  salt: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive unique key for this document
  const derivedKey = deriveKey(documentId + key.toString('hex'), salt);
  
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
  };
}

/**
 * Decrypt a document buffer
 * 
 * @param encryptedData - Encrypted document content
 * @param iv - Initialization vector (hex string)
 * @param authTag - Authentication tag (hex string)
 * @param salt - Salt used for key derivation (hex string)
 * @param documentId - Document identifier used during encryption
 * @returns Decrypted document buffer
 */
export function decryptDocument(
  encryptedData: Buffer,
  iv: string,
  authTag: string,
  salt: string,
  documentId: string
): Buffer {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');
  const saltBuffer = Buffer.from(salt, 'hex');
  
  // Derive the same key used during encryption
  const derivedKey = deriveKey(documentId + key.toString('hex'), saltBuffer);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  try {
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch (error) {
    throw new Error('Document decryption failed: authentication tag mismatch or corrupted data');
  }
}

/**
 * Encrypt a string (for small data like IDs, names)
 */
export function encryptString(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt a string
 */
export function decryptString(
  ciphertext: string,
  iv: string,
  authTag: string
): string {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');
  const encryptedBuffer = Buffer.from(ciphertext, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  try {
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]).toString('utf8');
  } catch (error) {
    throw new Error('String decryption failed: authentication tag mismatch');
  }
}

/**
 * Hash a value (one-way, for sensitive data that doesn't need retrieval)
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Verify document integrity
 * Returns true if the document can be decrypted successfully
 */
export function verifyDocumentIntegrity(
  encryptedData: Buffer,
  iv: string,
  authTag: string,
  salt: string,
  documentId: string
): boolean {
  try {
    decryptDocument(encryptedData, iv, authTag, salt, documentId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-encrypt a document with a new key (for key rotation)
 */
export function reEncryptDocument(
  encryptedData: Buffer,
  oldIv: string,
  oldAuthTag: string,
  oldSalt: string,
  documentId: string
): {
  encrypted: Buffer;
  iv: string;
  authTag: string;
  salt: string;
} {
  // Decrypt with old key
  const decrypted = decryptDocument(encryptedData, oldIv, oldAuthTag, oldSalt, documentId);
  
  // Re-encrypt (will use current key from environment)
  return encryptDocument(decrypted, documentId);
}

/**
 * Document encryption metadata stored in database
 */
export interface EncryptedDocumentMetadata {
  iv: string;
  authTag: string;
  salt: string;
  algorithm: string;
  encryptedAt: Date;
  keyVersion?: number; // For key rotation tracking
}

/**
 * Create encryption metadata for storage
 */
export function createEncryptionMetadata(
  iv: string,
  authTag: string,
  salt: string
): EncryptedDocumentMetadata {
  return {
    iv,
    authTag,
    salt,
    algorithm: ALGORITHM,
    encryptedAt: new Date(),
    keyVersion: 1,
  };
}

/**
 * Encrypt file for upload to S3/storage
 * Returns both the encrypted buffer and metadata to store in DB
 */
export function encryptForStorage(
  fileBuffer: Buffer,
  documentId: string
): {
  encryptedBuffer: Buffer;
  metadata: EncryptedDocumentMetadata;
} {
  const { encrypted, iv, authTag, salt } = encryptDocument(fileBuffer, documentId);
  
  return {
    encryptedBuffer: encrypted,
    metadata: createEncryptionMetadata(iv, authTag, salt),
  };
}

/**
 * Decrypt file from storage
 */
export function decryptFromStorage(
  encryptedBuffer: Buffer,
  metadata: EncryptedDocumentMetadata,
  documentId: string
): Buffer {
  return decryptDocument(
    encryptedBuffer,
    metadata.iv,
    metadata.authTag,
    metadata.salt,
    documentId
  );
}

const documentEncryption = {
  encryptDocument,
  decryptDocument,
  encryptString,
  decryptString,
  hashValue,
  generateSecureToken,
  verifyDocumentIntegrity,
  reEncryptDocument,
  createEncryptionMetadata,
  encryptForStorage,
  decryptFromStorage,
};

export default documentEncryption;
