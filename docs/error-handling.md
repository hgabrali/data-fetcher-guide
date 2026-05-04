# Error Handling in Data Fetching

Robust error handling is one of the most critical aspects of any data fetching implementation. This guide covers a comprehensive approach to identifying, classifying, and gracefully handling errors.

---

## Types of Errors

### 1. Network Errors

Network errors occur when the request cannot be sent or a response cannot be received. Common causes include:

- No internet connection
- DNS resolution failure
- Request timeout
- Server unreachable (firewall, offline)

With the native `fetch()` API, network errors cause the Promise to **reject** — unlike HTTP error status codes (400, 500), which result in a resolved response with `ok: false`.

```js
try {
  const response = await fetch('/api/data');
  // If we reach here, the network request itself succeeded
} catch (networkError) {
  // This only catches network-level failures
  console.error('Network error:', networkError.message);
}
```

### 2. HTTP Error Responses (4xx / 5xx)

These are **not** thrown automatically by `fetch()`. You must check `response.ok` or `response.status` manually:

| Range | Category | Examples |
|-------|----------|---------|
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Moved Permanently, 304 Not Modified |
| 4xx | Client Error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests |
| 5xx | Server Error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable |

### 3. Parsing Errors

Errors that occur when trying to parse the response body:

```js
const response = await fetch('/api/data');
try {
  const data = await response.json(); // throws if body is not valid JSON
} catch (parseError) {
  console.error('Failed to parse JSON:', parseError);
}
```

### 4. Request Aborted

When a request is cancelled via `AbortController`, an `AbortError` is thrown. This is intentional and should not be treated as an error in most cases:

```js
try {
  const data = await fetch(url, { signal });
} catch (error) {
  if (error.name === 'AbortError') {
    // Intentional cancellation — handle silently
    return;
  }
  throw error; // Re-throw unexpected errors
}
```

---

## Building a Robust Error Handler

### Custom Error Class

```js
class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  isClientError() { return this.status >= 400 && this.status < 500; }
  isServerError() { return this.status >= 500; }
  isUnauthorized() { return this.status === 401; }
  isForbidden() { return this.status === 403; }
  isNotFound() { return this.status === 404; }
  isRateLimited() { return this.status === 429; }
}
```

### Centralized Fetch Wrapper

```js
async function apiFetch(url, options = {}) {
  let response;

  // Step 1: Make the network request
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });
  } catch (networkError) {
    if (networkError.name === 'AbortError') throw networkError;
    throw new ApiError(
      'Network error: Unable to reach the server. Check your connection.',
      0,
      null
    );
  }

  // Step 2: Handle HTTP error status codes
  if (!response.ok) {
    let errorData = null;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { message: await response.text() };
      }
    } catch {
      // Ignore parse errors for error responses
    }

    const message = errorData?.message
      || errorData?.error
      || `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, errorData);
  }

  // Step 3: Parse success response
  if (response.status === 204) return null; // No Content

  try {
    return await response.json();
  } catch (parseError) {
    throw new ApiError('Failed to parse server response as JSON', response.status, null);
  }
}
```

---

## Error Classification & User Messaging

```js
function getErrorMessage(error) {
  if (error.name === 'AbortError') {
    return null; // Silent — user cancelled
  }

  if (!(error instanceof ApiError)) {
    return 'An unexpected error occurred. Please try again.';
  }

  switch (true) {
    case error.status === 0:
      return 'No internet connection. Please check your network.';
    case error.status === 400:
      return error.data?.message || 'Invalid request. Please check your input.';
    case error.status === 401:
      return 'Your session has expired. Please log in again.';
    case error.status === 403:
      return 'You do not have permission to perform this action.';
    case error.status === 404:
      return 'The requested resource was not found.';
    case error.status === 409:
      return 'A conflict occurred. The resource may already exist.';
    case error.status === 422:
      return error.data?.message || 'The submitted data is invalid.';
    case error.status === 429:
      return 'Too many requests. Please wait a moment and try again.';
    case error.isServerError():
      return 'A server error occurred. Our team has been notified.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}
```

---

## React Error Boundary for Fetch Errors

```jsx
import { Component } from 'react';

class FetchErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled fetch error:', error, info);
    // Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{getErrorMessage(this.state.error)}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage
// <FetchErrorBoundary>
//   <MyDataComponent />
// </FetchErrorBoundary>
```

---

## Logging & Monitoring

For production applications, errors should be sent to a monitoring service:

```js
import * as Sentry from '@sentry/browser';

function logError(error, context = {}) {
  if (error.name === 'AbortError') return; // Don't log intentional cancellations
  if (error instanceof ApiError && error.status < 500) return; // Don't log 4xx client errors

  console.error('[API Error]', error);

  Sentry.captureException(error, {
    extra: {
      status: error.status,
      data: error.data,
      ...context,
    },
  });
}
```

---

## Best Practices Summary

1. **Never trust `fetch()` to throw on HTTP errors** — always check `response.ok`
2. **Distinguish network errors from HTTP errors** — they need different handling
3. **Handle AbortError separately** — it's intentional, not a failure
4. **Show user-friendly messages** — never expose raw error objects to users
5. **Log server errors** (5xx) to monitoring services, not client errors (4xx)
6. **Provide recovery actions** — "Try again", "Go back", "Contact support"
7. **Validate response shape** before using the data (use Zod, Yup, etc.)
