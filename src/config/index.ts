import { z } from 'zod';

const envSchema = z.object({
  MONGO_URI: z.url({ protocol: /mongodb/ }),
  DB_NAME: z.string().default('travel-journal'),
  REFRESH_TOKEN_TTL: z.coerce.number().default(30 * 24 * 60 * 60), // 30 days in seconds
  ACCESS_TOKEN_TTL: z.coerce.number().default(15 * 60), // 15 minutes in seconds
  SALT_ROUNDS: z.coerce.number().default(13),

  ACCESS_JWT_SECRET: z
    .string({
      error: 'ACCESS_JWT_SECRET is required and must be at least 64 characters long'
    })
    .min(64),
  CLIENT_BASE_URL: z.url().default('http://localhost:5173'),
  PORT: z.coerce.number().int().default(3000),

  // AI summary: local Ollama during development
  OLLAMA_BASE_URL: z.url().default('http://localhost:11434/api'),
  AI_MODEL: z.string().default('llama3.1:8b'),

  // Field encryption of personal data in the database (reports, medications, chat messages).
  // ENCRYPTION_ENABLED only decides whether NEW data is written encrypted. Existing encrypted data
  // is always readable as long as ENCRYPTION_KEY is set. Create a key with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ENCRYPTION_ENABLED: z.stringbool().default(false),
  ENCRYPTION_KEY: z
    .preprocess(
      (value) => (value === '' ? undefined : value), // an empty line in .env counts as "not set"
      z
        .string()
        .transform((key) => Buffer.from(key, 'base64'))
        .refine((key) => key.length === 32, { error: 'ENCRYPTION_KEY must be 32 bytes, base64 encoded' })
        .optional()
    ),
}).refine((env) => !env.ENCRYPTION_ENABLED || env.ENCRYPTION_KEY, {
  error: 'ENCRYPTION_KEY is required when ENCRYPTION_ENABLED=true',
  path: ['ENCRYPTION_KEY']
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:\n', z.prettifyError(parsedEnv.error));
  process.exit(1);
}

export const {
  ACCESS_JWT_SECRET,
  ACCESS_TOKEN_TTL,
  DB_NAME,
  CLIENT_BASE_URL,
  MONGO_URI,
  REFRESH_TOKEN_TTL,
  SALT_ROUNDS,
  PORT,
  OLLAMA_BASE_URL,
  AI_MODEL,
  ENCRYPTION_ENABLED,
  ENCRYPTION_KEY
} = parsedEnv.data;
