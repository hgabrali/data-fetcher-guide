/**
 * 03-retry-and-abort.js
 * Demonstrates retry logic with exponential backoff,
 * and request cancellation using AbortController.
 */

// ─────────────────────────────────────────────
// 1. BASIC RETRY WITH EXPONENTIAL BACKOFF
// ─────────────────────────────────────────────

/**
 * Fetches a URL and retries on failure using exponential backoff.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} maxRetries  - Max number of retry attempts
 * @param {number} baseDelay   - Initial delay in ms (doubles each attempt)
 * @returns {Promise<any>}
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, baseDelay = 500) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on server errors (5xx) but not client errors (4xx)
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Client error: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      // Don't retry if the request was intentionally aborted
      if (error.name === 'AbortError') throw error;

      lastError = error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // 500, 1000, 2000, ...
        const jitter = Math.random() * 200; // Add up to 200ms of jitter
        console.warn(
          `Attempt ${attempt} failed. Retrying in ${Math.round(delay + jitter)}ms...`,
          error.message
        );
        await sleep(delay + jitter);
      }
    }
  }

  throw new Error(`All ${maxRetries} retry attempts failed. Last error: ${lastError.message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ─────────────────────────────────────────────
// 2. RETRY WITH RESPECT FOR Retry-After HEADER
// ─────────────────────────────────────────────

async function fetchRespectingRateLimit(url, options = {}, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      // Server is telling us to slow down
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000 * attempt;
      console.warn(`Rate limited. Waiting ${delay}ms before retry...`);
      await sleep(delay);
      continue;
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  throw new Error('Max retries reached due to rate limiting');
}


// ─────────────────────────────────────────────
// 3. ABORT CONTROLLER – CANCEL A SINGLE REQUEST
// ─────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();

  // Auto-cancel after timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId); // Don't cancel if it succeeded
    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}


// ─────────────────────────────────────────────
// 4. CANCELLABLE FETCH (return both promise and cancel fn)
// ─────────────────────────────────────────────

function createCancellableFetch(url, options = {}) {
  const controller = new AbortController();

  const promise = fetch(url, { ...options, signal: controller.signal })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

  return {
    promise,
    cancel: (reason = 'Request cancelled') => controller.abort(reason),
    signal: controller.signal,
  };
}

// Usage:
const { promise, cancel } = createCancellableFetch('/api/large-dataset');

// Cancel if user navigates away
window.addEventListener('beforeunload', cancel);

const data = await promise;
window.removeEventListener('beforeunload', cancel);


// ─────────────────────────────────────────────
// 5. REACT HOOK: CANCEL ON UNMOUNT
// ─────────────────────────────────────────────

// import { useState, useEffect } from 'react';
//
// function useAbortableFetch(url) {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//
//   useEffect(() => {
//     const controller = new AbortController();
//     setLoading(true);
//
//     fetch(url, { signal: controller.signal })
//       .then(res => {
//         if (!res.ok) throw new Error('HTTP ' + res.status);
//         return res.json();
//       })
//       .then(json => {
//         setData(json);
//         setError(null);
//       })
//       .catch(err => {
//         if (err.name !== 'AbortError') setError(err.message);
//       })
//       .finally(() => setLoading(false));
//
//     // Cleanup: abort on unmount or url change
//     return () => controller.abort();
//   }, [url]);
//
//   return { data, loading, error };
// }


// ─────────────────────────────────────────────
// 6. RACE: FETCH VS TIMEOUT
// ─────────────────────────────────────────────

async function fetchOrTimeout(url, timeoutMs = 3000) {
  const controller = new AbortController();

  const fetchPromise = fetch(url, { signal: controller.signal }).then(r => r.json());

  const timeoutPromise = sleep(timeoutMs).then(() => {
    controller.abort();
    throw new Error(`Timed out after ${timeoutMs}ms`);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}
