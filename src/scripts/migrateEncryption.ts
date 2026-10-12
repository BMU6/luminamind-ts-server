// Encrypts (or decrypts) the data that is ALREADY in the database: reports, medications, chat messages.
// New data is handled automatically by the models, this script is only for existing documents.
// It needs ENCRYPTION_KEY in the env file (ENCRYPTION_ENABLED is not needed) and can be run again
// at any time: values that are already in the wanted state are left alone.
//
// Run from the server folder (make a backup of the database first):
//   node --env-file=.env.development.local --conditions development src/scripts/migrateEncryption.ts encrypt
//   node --env-file=.env.development.local --conditions development src/scripts/migrateEncryption.ts decrypt
// Add --dry-run to only count what would change.
import "#db";
import mongoose from "mongoose";
import { ENCRYPTION_KEY } from "#config";
import { MedicationList, Message, Report } from "#models";
import { fieldCrypto, getEncryptedPaths, mapPath } from "#utils";

const mode = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (mode !== "encrypt" && mode !== "decrypt") {
  console.error("Usage: migrateEncryption.ts <encrypt|decrypt> [--dry-run]");
  process.exit(1);
}
if (mode === "encrypt" && !ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY is missing in the env file. Create one and set it first.");
  process.exit(1);
}

const transform =
  mode === "encrypt"
    ? (value: string) => (value === "" || fieldCrypto.isEncrypted(value) ? value : fieldCrypto.encryptString(value))
    : (value: string) => (fieldCrypto.isEncrypted(value) ? fieldCrypto.decryptString(value) : value);

const BATCH_SIZE = 500;
type BulkOperation = Parameters<typeof Report.collection.bulkWrite>[0][number];

for (const model of [Report, MedicationList, Message]) {
  const paths = getEncryptedPaths(model.schema).map((path) => path.split("."));
  const topLevelFields = [...new Set(paths.map(([field]) => field!))];

  let checked = 0;
  let changed = 0;
  let operations: BulkOperation[] = [];
  const flush = async () => {
    if (operations.length > 0 && !dryRun) await model.collection.bulkWrite(operations);
    operations = [];
  };

  // The raw collection is used on purpose: the model would encrypt/decrypt by itself
  for await (const doc of model.collection.find({})) {
    checked++;
    const $set: Record<string, unknown> = {};
    for (const field of topLevelFields) {
      const before = JSON.stringify(doc[field]);
      for (const path of paths.filter(([first]) => first === field)) mapPath(doc, path, transform);
      if (JSON.stringify(doc[field]) !== before) $set[field] = doc[field];
    }
    if (Object.keys($set).length === 0) continue;

    changed++;
    operations.push({ updateOne: { filter: { _id: doc._id }, update: { $set } } });
    if (operations.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`${model.collection.collectionName}: ${checked} documents checked, ${changed} ${dryRun ? "would be " : ""}${mode}ed`);
}

await mongoose.disconnect();
