
async function withRetry(operation: () => Promise<any>, config = {
  "maxRetries": 3,
  "baseDelay": 1000,
  "maxDelay": 10000,
  "backoffMultiplier": 2
}) {
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );

        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, (error as Error).message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Usage example:
// const result = await withRetry(() => fetch('/api/endpoint'));
