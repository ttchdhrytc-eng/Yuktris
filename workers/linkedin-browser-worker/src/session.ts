import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';

const KEY_ID = 'li-session-aes256-gcm-v3';
const SALT = 'linkedin-session-salt-v3';

function getKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

export function encrypt(plaintext: string, secret: string): string {
  const key = getKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string, secret: string): string {
  try {
    const key = getKey(secret);
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Session decryption failed — data may be corrupted or key mismatch');
  }
}

export function getKeyId(): string {
  return KEY_ID;
}

export const LINKEDIN_CREDENTIAL_ENCRYPTION_VERSION = 'linkedin-credentials-aes256-gcm-v1';

export function decryptLinkedInCredential(ciphertext: string, secret: string, version: string): string {
  if (version !== LINKEDIN_CREDENTIAL_ENCRYPTION_VERSION) throw new Error('Unsupported LinkedIn credential encryption version');
  try {
    const key = createHash('sha256').update(secret, 'utf8').digest();
    const data = Buffer.from(ciphertext, 'base64');
    if (data.length < 29) throw new Error('invalid ciphertext');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(data.length - 16);
    const encrypted = data.subarray(12, data.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('LinkedIn credential decryption failed');
  }
}
