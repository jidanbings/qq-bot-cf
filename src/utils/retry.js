
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    onRetry = null,
    shouldRetry = () => true,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts || !shouldRetry(err)) {
        break;
      }

      if (onRetry) {
        onRetry(err, attempt);
      }

      const waitTime = delay * Math.pow(backoff, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

export function createExponentialBackoff(baseDelay = 1000, maxDelay = 30000) {
  return (attempt) => Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
}
