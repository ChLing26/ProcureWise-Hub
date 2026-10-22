import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";

export const SECRET_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;

// Operator configuration only: public account data and request claims are never consulted.
export function toolsAdminIds(): number[] {
  const raw = process.env.TOOLS_ADMIN_ACCOUNT_IDS ?? "";
  if (!/^[1-9]\d*(,[1-9]\d*)*$/.test(raw)) return [];
  const ids = raw.split(",").map(Number);
  return ids.every(Number.isSafeInteger) ? ids : [];
}

export function toolsEncryptionKey(): Buffer | null {
  const raw = process.env.TOOLS_SECRETS_ENCRYPTION_KEY ?? "";
  // A separate 256-bit random key, never derived from a session secret or password.
  return /^[a-fA-F0-9]{64}$/.test(raw) ? Buffer.from(raw, "hex") : null;
}

export function toolsCapabilities(accountId: number) {
  const ids = toolsAdminIds();
  return { canManageSecrets: ids.includes(accountId), setupRequired: !ids.length || !toolsEncryptionKey() };
}

export const requireToolsAdmin: RequestHandler = (_req, res, next) => {
  const capability = toolsCapabilities(res.locals.user.id);
  if (!capability.canManageSecrets) {
    res.status(403).json({ error: "Only designated site owners or administrators can manage secrets." });
    return;
  }
  if (capability.setupRequired) {
    res.status(503).json({ error: "Secrets management requires trusted operator setup before changes can be made." });
    return;
  }
  next();
};

export function encryptSecret(name: string, value: string): string {
  const key = toolsEncryptionKey();
  if (!key) throw new Error("SecretsSetupRequired");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(`procureflow:tools-secret:v1:${name}`, "utf8"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

// Server-only primitive for future explicit consumers; never exposed as a read endpoint.
export function decryptSecret(name: string, stored: string): string {
  const key = toolsEncryptionKey();
  if (!key) throw new Error("SecretsSetupRequired");
  const [version, iv, tag, encrypted, extra] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error("InvalidEncryptedSecret");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(`procureflow:tools-secret:v1:${name}`, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}
