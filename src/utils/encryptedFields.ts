import type { Query, Schema } from "mongoose";
import { ENCRYPTION_ENABLED, ENCRYPTION_KEY } from "#config";
import { createFieldCrypto } from "./fieldCrypto.ts";

// One shared instance, configured from the .env file (ENCRYPTION_ENABLED, ENCRYPTION_KEY).
export const fieldCrypto = createFieldCrypto({ enabled: ENCRYPTION_ENABLED, key: ENCRYPTION_KEY });

/**
 * Spread this into a String path of a model to store it encrypted:
 *
 *   message: { type: String, trim: true, ...encrypted }
 *   names:   { type: [{ type: String, ...encrypted }] }       // array of strings
 *
 * - set: encrypts when the value is written (create, save, insertMany, findOneAndUpdate ...)
 * - get: decrypts when the value is read from a normal Mongoose document
 * Results of `.lean()` queries have no getters, the fieldEncryption plugin below handles those.
 */
export const encrypted = { set: fieldCrypto.protect, get: fieldCrypto.reveal };

// Applies `fn` to the value at a dotted path of a plain object. Arrays on the way (for example
// `activeMedications.name`) and arrays of strings at the end are handled element by element.
export const mapPath = (target: unknown, path: string[], fn: (value: string) => string): void => {
  if (Array.isArray(target)) {
    target.forEach((item, index) => {
      if (path.length === 0 && typeof item === "string") target[index] = fn(item);
      else mapPath(item, path, fn);
    });
    return;
  }
  if (target === null || typeof target !== "object") return;

  const [key, ...rest] = path;
  if (key === undefined) return;
  const record = target as Record<string, unknown>;
  const value = record[key];
  if (rest.length === 0 && typeof value === "string") record[key] = fn(value);
  else mapPath(value, rest, fn);
};

// All dotted paths of a schema (including sub-schemas like activeMedications) that use `encrypted`.
export const getEncryptedPaths = (schema: Schema, prefix = ""): string[] => {
  const paths: string[] = [];
  schema.eachPath((path, type) => {
    const fullPath = prefix + path;
    const options = (type as { options?: { get?: unknown } }).options;
    const itemType = (type as { embeddedSchemaType?: { options?: { get?: unknown } } }).embeddedSchemaType;
    const subSchema = (type as { schema?: Schema }).schema;

    if (options?.get === fieldCrypto.reveal || itemType?.options?.get === fieldCrypto.reveal) {
      paths.push(fullPath);
    } else if (subSchema) {
      paths.push(...getEncryptedPaths(subSchema, fullPath + "."));
    }
  });
  return paths;
};

// Sub-schemas must return decrypted values in JSON as well
const useGettersInJson = (schema: Schema): void => {
  schema.set("toJSON", { getters: true, virtuals: false });
  schema.set("toObject", { getters: true, virtuals: false });
  schema.eachPath((_path, type) => {
    const subSchema = (type as { schema?: Schema }).schema;
    if (subSchema) useGettersInJson(subSchema);
  });
};

/**
 * Plugin for the models with encrypted fields:  schema.plugin(fieldEncryption)
 * 1. res.json(document) sends decrypted values (getters are applied in toJSON/toObject).
 * 2. `.lean()` results are decrypted after the query, because lean skips the getters.
 */
export const fieldEncryption = (schema: Schema): void => {
  useGettersInJson(schema);

  const paths = getEncryptedPaths(schema).map((path) => path.split("."));
  if (paths.length === 0) return;

  schema.post(
    ["find", "findOne", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace"],
    function (this: Query<unknown, unknown>, result: unknown) {
      if (!this.mongooseOptions().lean || !result) return;
      for (const path of paths) {
        mapPath(result, path, (value) => fieldCrypto.reveal(value) as string);
      }
    },
  );
};
