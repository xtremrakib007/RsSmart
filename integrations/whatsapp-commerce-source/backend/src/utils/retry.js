/**
 * Retry utility for transient failures
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const withRetry = async (fn, options = {}) => {
  const maxRetries = options.maxRetries || parseInt(process.env.WHATSAPP_MAX_RETRIES) || 3;
  const delayMs = options.delayMs || parseInt(process.env.WHATSAPP_RETRY_DELAY_MS) || 2000;
  const shouldRetry = options.shouldRetry || (() => true);

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) break;
      if (!shouldRetry(error)) {
        throw error;
      }
      const waitTime = delayMs * Math.pow(2, attempt);
      await sleep(waitTime);
    }
  }

  throw lastError;
};

export const isRetryableError = (error) => {
  if (!error.statusCode && !error.response?.status) return true;
  const status = error.statusCode || error.response?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
};
