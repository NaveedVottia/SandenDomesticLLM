// Langfuse prompt loader via official SDK with minimal in-memory caching.
// Falls back to empty string when Langfuse is unavailable, so callers can use their own fallback.
import { Langfuse } from "langfuse";
const promptCache = {};
let langfuseClient = null;
function getEnv(name) {
    try {
        return process.env[name];
    }
    catch {
        return undefined;
    }
}
function getClient() {
    if (langfuseClient)
        return langfuseClient;
    const publicKey = getEnv("LANGFUSE_PUBLIC_KEY");
    const secretKey = getEnv("LANGFUSE_SECRET_KEY");
    const baseUrl = getEnv("LANGFUSE_HOST");
    if (!publicKey || !secretKey || !baseUrl)
        return null;
    langfuseClient = new Langfuse({ publicKey, secretKey, baseUrl });
    return langfuseClient;
}
export async function loadLangfusePrompt(name, { label = "production", cacheTtlMs = 1000 } = {} // Reduced TTL to 1 second
) {
    // Keep cache key shape compatible with previous implementations (label not used by SDK v2)
    const cacheKey = `${name}:${label}`;
    const cached = promptCache[cacheKey];
    if (cached && Date.now() - cached.fetchedAt < cacheTtlMs)
        return cached.content;
    const client = getClient();
    if (!client) {
        console.warn("[Langfuse] Env missing or client not initialized. Returning empty instructions.");
        promptCache[cacheKey] = { content: "", fetchedAt: Date.now() };
        return "";
    }
    try {
        // SDK handles internal caching; expose configurable TTL
        const ttlSeconds = Math.max(1, Math.floor(cacheTtlMs / 1000));
        const promptClient = await client.getPrompt(name, undefined, { cacheTtlSeconds: ttlSeconds });
        const text = promptClient?.prompt ?? "";
        if (text) {
            promptCache[cacheKey] = { content: text, fetchedAt: Date.now() };
            console.log(`[Langfuse] ✅ Loaded prompt via SDK: ${name} (v${promptClient.version})`);
            return text;
        }
    }
    catch (err) {
        console.warn(`[Langfuse] Prompt fetch failed for ${name}:`, err);
    }
    // Return empty string so caller can decide fallback behavior
    console.warn(`[Langfuse] ⚠️ No prompt available for ${name}. Returning empty instructions.`);
    promptCache[cacheKey] = { content: "", fetchedAt: Date.now() };
    return "";
}
export function clearLangfusePromptCache() {
    for (const k of Object.keys(promptCache))
        delete promptCache[k];
}
