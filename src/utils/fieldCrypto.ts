import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Field encryption with AES-256-GCM (authenticated: a changed value is detected on decryption).
//
// A stored value looks like:   enc:v1:<iv>:<auth tag>:<ciphertext>   (all three parts base64url)
// - "enc:v1:" marks an encrypted value and the format version (room for key rotation later).
// - Every value gets its own random IV, so the same text never gives the same ciphertext.
//
// Reading works in BOTH modes: a value that is not encrypted passes through unchanged, an encrypted
// one is decrypted when a key is available. The ENCRYPTION_ENABLED switch only decides whether
// NEW values are written encrypted. That makes it safe to switch on and off at any time.

const PREFIX = "enc:v1:";
// 12 bytes IV = 16 chars, 16 bytes tag = 22 chars (base64url, no padding). The strict pattern
// makes sure normal user text is never mistaken for an encrypted value.
const ENCRYPTED_PATTERN = /^enc:v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]*$/;

export type FieldCryptoOptions = {
  /** true: new values are written encrypted. false: new values are written as plain text. */
  enabled: boolean;
  /** 32 bytes. Needed to encrypt, and to read values that are already encrypted. */
  key?: Buffer | undefined;
};

export const createFieldCrypto = ({ enabled, key }: FieldCryptoOptions) => {
  const isEncrypted = (value: unknown): value is string =>
    typeof value === "string" && ENCRYPTED_PATTERN.test(value);

  // Always encrypts (ignores the switch). Used by the migration script.
  const encryptString = (plain: string): string => {
    if (!key) throw new Error("ENCRYPTION_KEY is required to encrypt data");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${data.toString("base64url")}`;
  };

  // Always decrypts an encrypted value (ignores the switch).
  const decryptString = (stored: string): string => {
    if (!key) throw new Error("ENCRYPTION_KEY is required to read encrypted data");
    const [iv, tag, data] = stored.slice(PREFIX.length).split(":") as [string, string, string];
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      throw new Error("Could not decrypt a stored value: wrong ENCRYPTION_KEY or the data was changed");
    }
  };

  // Mongoose setter: runs when a value is written. Empty text stays empty (nothing to protect, and
  // it keeps the "required" validators working). The text is trimmed like the old `trim: true`.
  const protect = (value: unknown): unknown => {
    if (!enabled || typeof value !== "string") return value;
    const text = value.trim();
    return text === "" ? text : encryptString(text);
  };

  // Mongoose getter: runs when a value is read. Plain values pass through.
  const reveal = (value: unknown): unknown => (isEncrypted(value) ? decryptString(value) : value);

  return { isEncrypted, encryptString, decryptString, protect, reveal };
};

export type FieldCrypto = ReturnType<typeof createFieldCrypto>;
