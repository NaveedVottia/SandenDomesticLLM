
class TimeoutError extends Error {
  constructor(message = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

function withTimeout(promise: Promise<any>, timeoutMs = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new TimeoutError(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Usage example:
// const response = await withTimeout(fetch('/api/endpoint'), 10000);
