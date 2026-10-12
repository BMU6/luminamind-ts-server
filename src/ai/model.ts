import { createOllama } from "ollama-ai-provider-v2";
import { AI_MODEL, OLLAMA_BASE_URL } from "#config";

// The ONLY place that knows which AI service is used. The rest of the app just imports `model`.
// Later (Mistral, Claude) only this file changes, for example:
//   import { mistral } from "@ai-sdk/mistral";   ->   export const model = mistral("mistral-large-latest");
//   import { anthropic } from "@ai-sdk/anthropic"; -> export const model = anthropic("claude-sonnet-5-5");
const ollama = createOllama({ baseURL: OLLAMA_BASE_URL });

export const model = ollama(AI_MODEL);
