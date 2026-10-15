// server/src/utils/crypto.js
//
// Encryption for stored mailbox (IMAP/SMTP) passwords.
// Compatible with the database shared with the newer abacco-marketing app.
//
// FORMATS IN THE DATABASE (EmailAccount.encryptedPass)
//   v2:<ivHex>:<cipherHex>   written by the newer app — key from MAILBOX_ENCRYPTION_KEY
//   <ivHex>:<cipherHex>      legacy — the old hard-coded key below
//   anything else            plain text
//
// Nothing here writes to the database; it only reads stored values.
// MAILBOX_ENCRYPTION_KEY in server/.env MUST be the same key the newer app uses.

import "dotenv/config";
import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

const LEGACY_KEY = Buffer.from("your-super-secret-key-32-chars!!", "utf8");

const V2_RE = /^v2:([0-9a-f]{32}):([0-9a-f]+)$/i;
const LEGACY_RE = /^([0-9a-f]{32}):([0-9a-f]+)$/i;

function parseKey(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  try {
    const b64 = Buffer.from(value, "base64");
    if (b64.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return b64;
  } catch {
    /* not base64 */
  }
  if (Buffer.byteLength(value, "utf8") === 32) return Buffer.from(value, "utf8");
  throw new Error(
    "MAILBOX_ENCRYPTION_KEY must be 32 bytes: 64 hex characters, 44-char base64, or a 32-character string",
  );
}

// Read lazily so the key is picked up even if .env loads after this module.
function currentKey() {
  return parseKey(process.env.MAILBOX_ENCRYPTION_KEY);
}

function aesEncrypt(key, text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const out = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return { iv: iv.toString("hex"), data: out.toString("hex") };
}

function aesDecrypt(key, ivHex, dataHex) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** "v2" | "legacy" | "plain" | "empty" */
export function secretFormat(stored) {
  if (stored === null || stored === undefined || stored === "") return "empty";
  if (V2_RE.test(stored)) return "v2";
  if (LEGACY_RE.test(stored)) return "legacy";
  return "plain";
}

/** Encrypt for storage — same formats as the newer app. */
export function encryptSecret(plain) {
  if (plain === null || plain === undefined || plain === "") return plain;
  const key = currentKey();
  if (key) {
    const { iv, data } = aesEncrypt(key, plain);
    return `v2:${iv}:${data}`;
  }
  const { iv, data } = aesEncrypt(LEGACY_KEY, plain);
  return `${iv}:${data}`;
}

/**
 * Turn whatever is stored into the usable password.
 * Throws only for a v2 value that can't be decrypted (missing/wrong key),
 * so a clear configuration error is shown instead of sending garbage to SMTP.
 */
export function resolveSecret(stored) {
  const format = secretFormat(stored);
  if (format === "empty") return null;

  if (format === "v2") {
    const key = currentKey();
    if (!key) {
      throw new Error(
        "Stored mailbox password uses the v2 format but MAILBOX_ENCRYPTION_KEY is not set in server/.env",
      );
    }
    const [, iv, data] = stored.match(V2_RE);
    try {
      return aesDecrypt(key, iv, data);
    } catch {
      throw new Error(
        "Could not decrypt mailbox password — MAILBOX_ENCRYPTION_KEY does not match the key used by the other app",
      );
    }
  }

  if (format === "legacy") {
    const [, iv, data] = stored.match(LEGACY_RE);
    try {
      return aesDecrypt(LEGACY_KEY, iv, data);
    } catch {
      return stored; // plain password that happens to look like hex:hex
    }
  }

  return stored;
}

/* ── Names used elsewhere in this project ─────────────────────────────── */
export const encrypt = (text) => encryptSecret(text);
export const decrypt = (value) => resolveSecret(value);
export const safeDecrypt = (value) => resolveSecret(value);
export const isEncrypted = (value) => {
  const f = secretFormat(value);
  return f === "v2" || f === "legacy";
};