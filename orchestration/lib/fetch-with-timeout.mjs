/**
 * Fetch with timeout wrapper using AbortController
 * Prevents hanging requests from blocking the overnight loop
 */

/**
 * Fetch with automatic timeout
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default 30s)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Common timeout values
export const TIMEOUTS = {
  AI_CALL: 180000,      // 3 minutes - AI generation can take time
  EXTERNAL_API: 60000,  // 1 minute - Gmail, GitHub, Calendar
  INTERNAL_API: 30000,  // 30 seconds - internal API calls
  QUICK: 10000,         // 10 seconds - fast operations
};
