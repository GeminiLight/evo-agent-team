/**
 * Unified LLM module — wraps @mariozechner/pi-ai for multi-provider support.
 *
 * Supports: OpenAI, Anthropic, Google, Groq, and any OpenAI-compatible endpoint
 * (Venus, vLLM, LocalAI, Ollama, etc.) via the `openai-compatible` provider.
 *
 * Backward compatible: existing .env with LLM_API_KEY + LLM_BASE_URL + LLM_MODEL
 * works without changes (defaults to openai-compatible provider).
 */

import { completeSimple, getModel, getEnvApiKey } from '@mariozechner/pi-ai';
import type { Model, Api } from '@mariozechner/pi-ai';

// ── Types ────────────────────────────────────────────────────────────────────

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'openai-compatible';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const VALID_PROVIDERS = new Set<LLMProvider>(['openai', 'anthropic', 'google', 'groq', 'openai-compatible']);

/** Maps standard providers to their canonical API key env var */
const PROVIDER_ENV_KEY: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
};

/** Build LLM config from environment variables */
export function getLLMConfig(): LLMConfig {
  const raw = process.env.LLM_PROVIDER || 'openai-compatible';
  const provider: LLMProvider = VALID_PROVIDERS.has(raw as LLMProvider)
    ? (raw as LLMProvider)
    : 'openai-compatible';
  return {
    provider,
    model: process.env.LLM_MODEL || 'claude-sonnet-4-6',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
  };
}

/** Check whether LLM is configured (has required credentials) */
export function isLLMConfigured(cfg?: LLMConfig): boolean {
  const c = cfg ?? getLLMConfig();
  if (c.provider === 'openai-compatible') {
    return !!(c.apiKey && c.baseUrl);
  }
  // Standard providers — check their canonical env var
  return !!process.env[PROVIDER_ENV_KEY[c.provider] || 'LLM_API_KEY'];
}

// ── Model resolution ─────────────────────────────────────────────────────────

/** Resolve a pi-ai Model object from config */
export function getLLMModel(cfg?: LLMConfig): Model<Api> {
  const c = cfg ?? getLLMConfig();

  if (c.provider === 'openai-compatible') {
    // Custom OpenAI-compatible endpoint — construct Model manually
    return {
      id: c.model,
      name: c.model,
      api: 'openai-completions' as const,
      provider: 'openai' as const,
      baseUrl: c.baseUrl || 'https://api.openai.com/v1',
      reasoning: false,
      input: ['text'] as ('text' | 'image')[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 16_384,
    } satisfies Model<'openai-completions'> as Model<Api>;
  }

  // Standard provider — use pi-ai's built-in model registry
  // getModel is strictly typed; cast through any for dynamic usage
  try {
    return (getModel as any)(c.provider, c.model) as Model<Api>;
  } catch (err) {
    throw new Error(
      `Unknown model "${c.model}" for provider "${c.provider}". ` +
      `Check LLM_PROVIDER and LLM_MODEL in your .env. ` +
      `Original: ${(err as Error).message}`
    );
  }
}

// ── Completion ───────────────────────────────────────────────────────────────

/**
 * Single-shot LLM completion.
 *
 * Accepts either a plain string prompt or an OpenAI-style messages array.
 * Returns the assistant's text response.
 */
export async function llmComplete(
  prompt: string | Array<{ role: string; content: string }>,
  maxTokens = 2048,
  cfg?: LLMConfig,
): Promise<string> {
  const c = cfg ?? getLLMConfig();
  const model = getLLMModel(c);

  // Build pi-ai context
  const rawMessages = typeof prompt === 'string'
    ? [{ role: 'user' as const, content: prompt }]
    : prompt;

  // Separate system prompt from conversation messages
  const systemMessages = rawMessages.filter(m => m.role === 'system');
  const systemPrompt = systemMessages.length > 0
    ? systemMessages.map(m => m.content).join('\n')
    : undefined;

  const messages = rawMessages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user',   // pi-ai Context only accepts user/assistant/toolResult messages
      content: m.content,
      timestamp: Date.now(),
    }));

  // Resolve API key
  const apiKey = c.apiKey
    || (c.provider !== 'openai-compatible' ? getEnvApiKey(c.provider) : undefined);

  const tag = `[llm] ${c.provider}/${c.model}`;
  const start = Date.now();

  let result;
  try {
    result = await completeSimple(model, { systemPrompt, messages }, {
      maxTokens,
      apiKey,
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`${tag} failed after ${elapsed}ms:`, (err as Error).message);
    throw err;
  }

  const elapsed = Date.now() - start;
  console.log(`${tag} ${elapsed}ms, ${result.usage?.totalTokens ?? '?'} tokens`);

  // Extract text from content array
  const text = result.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('');

  if (!text && result.stopReason === 'error') {
    throw new Error(`LLM error: ${result.errorMessage || 'unknown error'}`);
  }

  return text;
}
