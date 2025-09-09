// Langfuse prompt loader via official SDK with minimal in-memory caching.
// Falls back to empty string when Langfuse is unavailable, so callers can use their own fallback.

import { Langfuse } from "langfuse";

type PromptCacheEntry = { content: string; fetchedAt: number };
const promptCache: Record<string, PromptCacheEntry> = {};

let langfuseClient: Langfuse | null = null;

function getEnv(name: string): string | undefined {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

function getClient(): Langfuse | null {
  if (langfuseClient) return langfuseClient;

  const publicKey = getEnv("LANGFUSE_PUBLIC_KEY");
  const secretKey = getEnv("LANGFUSE_SECRET_KEY");
  const baseUrl = getEnv("LANGFUSE_HOST");

  console.log(`[Langfuse] Debug - publicKey: ${publicKey ? 'present' : 'missing'} (${publicKey?.length || 0} chars)`);
  console.log(`[Langfuse] Debug - secretKey: ${secretKey ? 'present' : 'missing'} (${secretKey?.length || 0} chars)`);
  console.log(`[Langfuse] Debug - baseUrl: ${baseUrl || 'missing'}`);

  if (!publicKey || !secretKey || !baseUrl) {
    console.error(`[Langfuse] Missing required environment variables`);
    return null;
  }

  try {
    console.log(`[Langfuse] Initializing client with baseUrl: ${baseUrl}`);
    langfuseClient = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: baseUrl.replace(/\/$/, '') // Remove trailing slash if present
    });
    console.log(`[Langfuse] Client initialized successfully`);
    return langfuseClient;
  } catch (error) {
    console.error(`[Langfuse] Client initialization failed:`, error);
    return null;
  }
}

export async function loadLangfusePrompt(
  name: string,
  { label = "production", cacheTtlMs = 1_000 }: { label?: string; cacheTtlMs?: number } = {} // Reduced TTL to 1 second
): Promise<string> {
  // Keep cache key shape compatible with previous implementations (label not used by SDK v2)
  const cacheKey = `${name}:${label}`;
  const cached = promptCache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) return cached.content;

  const client = getClient();
  if (!client) {
    console.warn("[Langfuse] Env missing or client not initialized. Returning empty instructions.");
    promptCache[cacheKey] = { content: "", fetchedAt: Date.now() };
    return "";
  }

  try {
    console.log(`[Langfuse] Attempting to fetch prompt: ${name}`);

    // Try different SDK method signatures for compatibility
    let promptClient;
    let text = "";

    try {
      // Method 1: Try with version parameter (SDK v2.x)
      promptClient = await client.getPrompt(name, undefined, { cacheTtlSeconds: 60 });
      text = promptClient?.prompt ?? "";
      console.log(`[Langfuse] Method 1 succeeded: ${text.length} chars`);
    } catch (method1Error) {
      console.warn(`[Langfuse] Method 1 failed:`, method1Error instanceof Error ? method1Error.message : String(method1Error));

      try {
        // Method 2: Try without version parameter
        promptClient = await client.getPrompt(name);
        text = promptClient?.prompt ?? "";
        console.log(`[Langfuse] Method 2 succeeded: ${text.length} chars`);
      } catch (method2Error) {
        console.warn(`[Langfuse] Method 2 failed:`, method2Error instanceof Error ? method2Error.message : String(method2Error));

        try {
          // Method 3: Try without label parameter (label is not a valid parameter for getPrompt)
          promptClient = await client.getPrompt(name);
          text = promptClient?.prompt ?? "";
          console.log(`[Langfuse] Method 3 succeeded: ${text.length} chars`);
        } catch (method3Error) {
          console.warn(`[Langfuse] Method 3 failed:`, method3Error instanceof Error ? method3Error.message : String(method3Error));
          throw new Error(`All Langfuse SDK methods failed for prompt: ${name}`);
        }
      }
    }

    if (text) {
      promptCache[cacheKey] = { content: text, fetchedAt: Date.now() };
      console.log(`[Langfuse] ✅ Loaded prompt via SDK: ${name} (${text.length} chars)`);
      return text;
    } else {
      console.warn(`[Langfuse] ⚠️ Empty prompt content for ${name}`);
    }
  } catch (err) {
    console.error(`[Langfuse] Prompt fetch failed for ${name}:`, err instanceof Error ? err.message : String(err));
  }

  // Return empty string so caller can decide fallback behavior
  console.warn(`[Langfuse] ⚠️ No prompt available for ${name}. Returning empty instructions.`);
  promptCache[cacheKey] = { content: "", fetchedAt: Date.now() };
  return "";
}

export function clearLangfusePromptCache(): void {
  for (const k of Object.keys(promptCache)) delete (promptCache as any)[k];
}

