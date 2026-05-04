# 📡 Data Fetcher Guide

> A comprehensive reference for data fetching concepts, patterns, best practices, and tools in modern web development.

---

## 📚 Table of Contents

1. [What is a Data Fetcher?](#what-is-a-data-fetcher)
2. [Core Concepts](#core-concepts)
3. [Basic Usage Patterns](#basic-usage-patterns)
4. [Advanced Patterns](#advanced-patterns)
5. [Important Considerations](#important-considerations)
6. [Essential Tools & Libraries](#essential-tools--libraries)
7. [Error Handling](#error-handling)
8. [Caching Strategies](#caching-strategies)
9. [Performance Optimization](#performance-optimization)
10. [Security Best Practices](#security-best-practices)
11. [Testing Fetchers](#testing-fetchers)
12. [Comparison Table](#comparison-table)

---

## What is a Data Fetcher?

A **data fetcher** is a function, module, or abstraction layer responsible for retrieving data from an external source — typically a REST API, GraphQL endpoint, database, or file — and making it available to the application.

Data fetchers act as the bridge between your application logic and remote/local data sources. They abstract away the complexity of HTTP requests, authentication, response parsing, and error handling.

```
[ UI Component ] --> [ Data Fetcher ] --> [ API / Database / File ]
                          |
                    [ Cache Layer ]
                          |
                    [ Error Handler ]
```

---

## Core Concepts

### 1. HTTP Methods

| Method   | Purpose                        | Has Body |
|----------|--------------------------------|----------|
| `GET`    | Retrieve data                  | No       |
| `POST`   | Create new resource            | Yes      |
| `PUT`    | Replace existing resource      | Yes      |
| `PATCH`  | Partially update resource      | Yes      |
| `DELETE` | Remove a resource              | No       |

### 2. Request Lifecycle

```
idle --> loading --> success
                 --> error --> (retry?) --> success / failure
```

Every fetch goes through states: **idle**, **loading**, **success**, and **error**. Managing these states correctly is fundamental to a good user experience.

### 3. Synchronous vs Asynchronous Fetching

- **Synchronous**: Blocks execution until data is returned (avoid in web UIs)
- **Asynchronous**: Non-blocking; uses Promises, async/await, or callbacks

### 4. Request & Response Structure

```
Request:
  - URL (endpoint)
  - Method (GET, POST, etc.)
  - Headers (Content-Type, Authorization, etc.)
  - Body (for POST/PUT/PATCH)
  - Query Parameters

Response:
  - Status Code (200, 201, 400, 401, 403, 404, 500...)
  - Headers (Content-Type, Cache-Control, etc.)
  - Body (JSON, XML, text, binary)
```

### 5. Status Codes You Must Know

| Code | Meaning                    |
|------|----------------------------|
| 200  | OK                         |
| 201  | Created                    |
| 204  | No Content                 |
| 400  | Bad Request                |
| 401  | Unauthorized               |
| 403  | Forbidden                  |
| 404  | Not Found                  |
| 429  | Too Many Requests          |
| 500  | Internal Server Error      |
| 503  | Service Unavailable        |

---

## Basic Usage Patterns

### Using the Fetch API (Native Browser)

```js
// GET request
async function fetchUsers() {
  const response = await fetch('https://api.example.com/users');
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// POST request
async function createUser(userData) {
  const response = await fetch('https://api.example.com/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    throw new Error(`Failed to create user: ${response.status}`);
  }

  return response.json();
}
```

### Using Axios

```js
import axios from 'axios';

// GET
const { data } = await axios.get('/api/users');

// POST with config
const response = await axios.post('/api/users', payload, {
  headers: { Authorization: `Bearer ${token}` },
  timeout: 5000,
});

// Axios instance (recommended for larger projects)
const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});
```

### Using async/await with Error Handling

```js
async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${response.status}: ${error}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Fetch failed:', err);
    throw err;
  }
}
```

---

## Advanced Patterns

### 1. Retry Logic

```js
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}
```

### 2. Request Cancellation (AbortController)

```js
function fetchWithCancel(url) {
  const controller = new AbortController();
  const { signal } = controller;

  const promise = fetch(url, { signal })
    .then(res => res.json());

  return { promise, cancel: () => controller.abort() };
}

// Usage
const { promise, cancel } = fetchWithCancel('/api/data');
setTimeout(cancel, 3000);
const data = await promise;
```

### 3. Parallel Fetching

```js
// Fetch multiple endpoints simultaneously
const [users, posts, comments] = await Promise.all([
  fetch('/api/users').then(r => r.json()),
  fetch('/api/posts').then(r => r.json()),
  fetch('/api/comments').then(r => r.json()),
]);

// Using Promise.allSettled (handles individual failures)
const results = await Promise.allSettled([
  fetch('/api/data1').then(r => r.json()),
  fetch('/api/data2').then(r => r.json()),
]);
```

### 4. Polling

```js
function startPolling(url, interval = 5000, onData) {
  let active = true;

  async function poll() {
    while (active) {
      try {
        const data = await fetch(url).then(r => r.json());
        onData(data);
      } catch (err) {
        console.error('Poll error:', err);
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  poll();
  return () => { active = false; };
}
```

### 5. Interceptors (with Axios)

```js
api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await refreshToken();
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 6. Pagination

```js
async function fetchPage(page = 1, limit = 20) {
  const url = `/api/items?page=${page}&limit=${limit}`;
  return fetch(url).then(r => r.json());
}

async function* fetchAllPages(url) {
  let cursor = null;
  do {
    const endpoint = cursor ? `${url}?cursor=${cursor}` : url;
    const { data, nextCursor } = await fetch(endpoint).then(r => r.json());
    yield data;
    cursor = nextCursor;
  } while (cursor);
}
```

---

## Important Considerations

### CORS (Cross-Origin Resource Sharing)

CORS is a browser security mechanism that restricts HTTP requests from one origin to another. Key points:
- The **server** controls CORS via response headers like `Access-Control-Allow-Origin`
- During development, use a **proxy** (e.g., Vite's `server.proxy`) to bypass CORS
- Never disable CORS globally in production
- Preflight requests (`OPTIONS`) are automatically sent for non-simple requests

### Race Conditions

Multiple rapid requests can resolve out of order:

```js
let controller;
async function search(query) {
  controller?.abort();
  controller = new AbortController();
  try {
    const results = await fetch(`/api/search?q=${query}`, {
      signal: controller.signal
    }).then(r => r.json());
    setResults(results);
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }
}
```

### Memory Leaks in React

Always cancel fetch results when a component unmounts:

```js
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(setData)
    .catch(err => { if (err.name !== 'AbortError') console.error(err); });

  return () => controller.abort();
}, []);
```

### Response Validation

Never trust API responses blindly:

```js
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const raw = await fetch('/api/user/1').then(r => r.json());
const user = UserSchema.parse(raw);
```

---

## Essential Tools & Libraries

### Native Browser APIs

| Tool | Description |
|------|-------------|
| `fetch()` | Built-in Promise-based HTTP client |
| `XMLHttpRequest` | Legacy API, useful for upload progress events |
| `AbortController` | Cancel in-flight requests |
| `EventSource` | Server-Sent Events (one-way real-time streaming) |
| `WebSocket` | Full-duplex real-time communication |

### HTTP Client Libraries

| Library | Description | Best For |
|---------|-------------|----------|
| **Axios** | Feature-rich HTTP client with interceptors, auto JSON | Most projects |
| **ky** | Tiny, modern fetch wrapper with retry & timeout | Small bundles |
| **got** | Powerful Node.js HTTP client | Server-side Node |
| **superagent** | Fluent API HTTP client (browser & Node) | Legacy environments |

```bash
npm install axios
npm install ky
npm install got
```

### Data Fetching & State Management Libraries

| Library | Description | Key Features |
|---------|-------------|--------------|
| **TanStack Query** | Server state management for React/Vue/Svelte | Caching, background refresh, pagination |
| **SWR** | React hooks for remote data fetching by Vercel | Stale-While-Revalidate, focus revalidation |
| **RTK Query** | Built into Redux Toolkit | Integrates with Redux |
| **Apollo Client** | GraphQL client with cache | GraphQL-first, normalized cache |
| **tRPC** | Type-safe API calls without REST/GraphQL | Full-stack TypeScript |

```bash
npm install @tanstack/react-query
npm install swr
npm install @apollo/client graphql
```

### Mocking & Testing Tools

| Tool | Purpose |
|------|---------|
| **MSW** | Intercept and mock network requests at service worker level |
| **nock** | HTTP mocking for Node.js |
| **json-server** | Create a fake REST API from a JSON file |
| **Mirage JS** | In-browser API mock server |

```bash
npm install msw --save-dev
npm install json-server --save-dev
```

### API Development & Exploration

| Tool | Purpose |
|------|---------|
| **Postman** | GUI client to test and document APIs |
| **Insomnia** | Lightweight REST & GraphQL client |
| **Hoppscotch** | Open-source web-based API testing |
| **Bruno** | Git-friendly API client (offline-first) |
| **curl** | CLI tool for HTTP requests |

---

## Error Handling

### Comprehensive Error Handler

```js
class FetchError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.data = data;
  }
}

async function apiFetch(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (networkError) {
    throw new FetchError('Network error – check your connection', 0, null);
  }

  if (!response.ok) {
    let errorData;
    try { errorData = await response.json(); } catch { errorData = null; }
    throw new FetchError(
      errorData?.message || `Request failed with status ${response.status}`,
      response.status,
      errorData
    );
  }

  if (response.status === 204) return null;
  return response.json();
}
```

### Error Classification

```js
function handleFetchError(error) {
  if (error.name === 'AbortError') return;
  
  if (error.status === 0)        showMessage('No internet connection');
  else if (error.status === 401) redirectToLogin();
  else if (error.status === 403) showMessage('Permission denied');
  else if (error.status === 404) showMessage('Resource not found');
  else if (error.status === 429) showMessage('Too many requests. Please slow down.');
  else if (error.status >= 500)  showMessage('Server error. Please try again later.');
  else                           showMessage(`Unexpected error: ${error.message}`);
}
```

---

## Caching Strategies

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| **No Cache** | Fresh request every time | Real-time data |
| **Memory Cache** | Cache in JS Map | Short-lived session data |
| **Stale-While-Revalidate** | Return cached, refresh in background | Frequently changing but tolerant data |
| **Cache-First** | Use cache if available | Static / rarely changing data |
| **Network-First** | Try network, fall back to cache | Freshness is important |

### Simple In-Memory Cache

```js
const cache = new Map();

async function cachedFetch(url, ttl = 60000) {
  const cached = cache.get(url);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = await fetch(url).then(r => r.json());
  cache.set(url, { data, timestamp: now });
  return data;
}
```

### HTTP Cache Headers

```
Cache-Control: no-store                    # Never cache
Cache-Control: no-cache                    # Cache but revalidate
Cache-Control: max-age=3600               # Cache for 1 hour
Cache-Control: stale-while-revalidate=60  # SWR pattern
ETag: "abc123"                             # Conditional requests
```

---

## Performance Optimization

### 1. Debounce Search Requests

```js
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const debouncedSearch = debounce(async (query) => {
  const results = await fetch(`/api/search?q=${query}`).then(r => r.json());
  displayResults(results);
}, 300);
```

### 2. Lazy Loading / On-Demand Fetching

Only fetch data when it's actually needed — when a tab is activated, a modal opens, or user scrolls to a section.

### 3. Prefetching

```js
link.addEventListener('mouseenter', () => {
  fetch('/api/next-page-data')
    .then(r => r.json())
    .then(data => prefetchCache.set('next-page', data));
});
```

### 4. Batch Requests

```js
// Instead of: N individual requests
// Do: one request with all IDs
const users = await fetch('/api/users?ids=1,2,3').then(r => r.json());
```

### 5. Streaming Large Responses

```js
const response = await fetch('/api/large-dataset');
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  processChunk(decoder.decode(value));
}
```

---

## Security Best Practices

### Authentication
- Store tokens in **memory** or **httpOnly cookies** — never in `localStorage` for sensitive tokens
- Always send tokens via **Authorization headers**, not query parameters
- Implement **token refresh** logic for expired tokens
- Use **short-lived access tokens** + long-lived refresh tokens

### Input Sanitization
```js
// Always encode user input in URLs
const url = `/api/search?q=${encodeURIComponent(userInput)}`;
```

### HTTPS Only
- Always use `https://` in production
- Set `Strict-Transport-Security` header on the server

### Rate Limiting Awareness
- Respect `429 Too Many Requests` responses
- Implement exponential backoff when retrying
- Check the `Retry-After` response header

---

## Testing Fetchers

### Unit Test with MSW (Mock Service Worker)

```js
// src/mocks/handlers.js
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),
];
```

```js
// users.test.js
import { server } from './mocks/server';
import { fetchUsers } from './api/users';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('fetches users successfully', async () => {
  const users = await fetchUsers();
  expect(users).toHaveLength(2);
  expect(users[0].name).toBe('Alice');
});

test('handles server error gracefully', async () => {
  server.use(http.get('/api/users', () => HttpResponse.error()));
  await expect(fetchUsers()).rejects.toThrow();
});
```

---

## Comparison Table

| Feature | fetch() | Axios | TanStack Query | SWR |
|---------|---------|-------|----------------|-----|
| Built-in browser | Yes | No | No | No |
| Auto JSON parse | No | Yes | Yes | Yes |
| Interceptors | No | Yes | No | No |
| Request cancellation | Yes | Yes | Yes | Yes |
| Caching | No | No | Yes | Yes |
| Background refresh | No | No | Yes | Yes |
| Retry logic | No | No | Yes | Yes |
| Pagination helpers | No | No | Yes | Yes |
| Optimistic updates | No | No | Yes | Yes |
| Framework agnostic | Yes | Yes | Yes | No (React) |
| Bundle size | 0 KB | ~13 KB | ~47 KB | ~7 KB |

---

## Repository Structure

```
data-fetcher-guide/
├── README.md                   # Main guide (this file)
├── examples/
│   ├── 01-basic-fetch.js       # Native fetch API basics
│   ├── 02-axios-examples.js    # Axios usage
│   ├── 03-retry-logic.js       # Retry with exponential backoff
│   ├── 04-abort-controller.js  # Request cancellation
│   ├── 05-parallel-fetch.js    # Promise.all patterns
│   ├── 06-caching.js           # In-memory cache
│   ├── 07-polling.js           # Polling pattern
│   └── 08-react-query.jsx      # TanStack Query in React
├── docs/
│   ├── error-handling.md       # Deep dive into error strategies
│   ├── caching-strategies.md   # Detailed caching guide
│   ├── security.md             # Security best practices
│   └── testing.md              # Testing guide with MSW
└── LICENSE
```

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/add-graphql-guide`
3. Commit your changes: `git commit -m 'Add GraphQL fetching guide'`
4. Push to the branch: `git push origin feature/add-graphql-guide`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

*Made with for developers who want to master data fetching.*
