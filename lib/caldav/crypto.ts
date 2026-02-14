import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getEncryptionKey(): Buffer {
  const hex = process.env.CALDAV_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CALDAV_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptPassword(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Store encrypted + authTag together
  const combined = Buffer.concat([encrypted, authTag]);
  return {
    encrypted: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptPassword(encrypted: string, iv: string): string {
  const key = getEncryptionKey();
  const ivBuf = Buffer.from(iv, "base64");
  const combined = Buffer.from(encrypted, "base64");
  // Last 16 bytes are the auth tag
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
