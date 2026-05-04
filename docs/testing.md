# Testing Data Fetchers

Testing your data fetching layer is essential for catching bugs, preventing regressions, and ensuring your app behaves correctly when APIs respond with errors, timeouts, or unexpected data.

---

## Testing Strategy

A solid testing strategy for data fetchers involves three levels:

**Unit Tests** verify that individual fetch functions handle responses, errors, and transformations correctly in isolation.

**Integration Tests** verify that your components correctly interact with your fetching layer — loading states, error states, and successful data rendering.

**End-to-End Tests** verify the complete user flow from UI interaction to actual API calls in a production-like environment.

---

## Mock Service Worker (MSW) – Recommended Approach

MSW intercepts requests at the network level (using a Service Worker in browsers, or Node.js HTTP interception in tests). This means your code runs exactly as it would in production — no mocking of `fetch` or `axios`.

### Installation

```bash
npm install msw --save-dev
# For browsers: also run
npx msw init public/ --save
```

### Setup

```js
// src/mocks/handlers.js
import { http, HttpResponse } from 'msw';

export const handlers = [
  // GET /api/users
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
      { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
    ]);
  }),

  // GET /api/users/:id
  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    if (id === '999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ id: Number(id), name: 'Alice Johnson', email: 'alice@example.com' });
  }),

  // POST /api/users
  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 3, ...body },
      { status: 201 }
    );
  }),

  // DELETE /api/users/:id
  http.delete('/api/users/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

```js
// src/mocks/server.js – Node.js (Jest/Vitest)
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```js
// src/setupTests.js – runs before all tests
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers()); // Reset overrides after each test
afterAll(() => server.close());
```

---

## Unit Tests for Fetch Functions

```js
// src/api/users.js
export async function fetchUsers() {
  const response = await fetch('/api/users');
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

export async function createUser(data) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create user');
  return response.json();
}
```

```js
// src/api/users.test.js
import { fetchUsers, createUser } from './users';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('fetchUsers', () => {
  test('returns a list of users', async () => {
    const users = await fetchUsers();
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({ id: 1, name: 'Alice Johnson' });
  });

  test('throws an error when the server returns 500', async () => {
    // Override the default handler for this test only
    server.use(
      http.get('/api/users', () => new HttpResponse(null, { status: 500 }))
    );

    await expect(fetchUsers()).rejects.toThrow('Failed to fetch users');
  });

  test('throws on network failure', async () => {
    server.use(
      http.get('/api/users', () => HttpResponse.error()) // Simulate network error
    );

    await expect(fetchUsers()).rejects.toThrow();
  });
});

describe('createUser', () => {
  test('creates a user and returns it with an id', async () => {
    const newUser = await createUser({ name: 'Charlie', email: 'charlie@example.com' });
    expect(newUser).toMatchObject({
      id: expect.any(Number),
      name: 'Charlie',
      email: 'charlie@example.com',
    });
  });
});
```

---

## Integration Tests for React Components

```jsx
// src/components/UserList.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import UserList from './UserList';

describe('UserList Component', () => {
  test('shows loading state initially', () => {
    render(<UserList />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders users after successful fetch', async () => {
    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });
  });

  test('shows error message when fetch fails', async () => {
    server.use(
      http.get('/api/users', () => new HttpResponse(null, { status: 500 }))
    );

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  test('shows empty state when no users returned', async () => {
    server.use(
      http.get('/api/users', () => HttpResponse.json([]))
    );

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });
  });
});
```

---

## Testing with TanStack Query

Wrap the component with a fresh QueryClient for each test to prevent cache interference:

```jsx
// src/test-utils.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

export function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,     // Don't retry on failure in tests
        gcTime: 0,        // Don't cache
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

```jsx
// Usage in tests
import { renderWithQuery } from '../test-utils';
import { waitFor, screen } from '@testing-library/react';
import UsersPage from './UsersPage';

test('displays fetched users', async () => {
  renderWithQuery(<UsersPage />);

  await waitFor(() => {
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
  });
});
```

---

## Testing Pagination

```js
// Override handler to return different pages
test('loads more items when Load More is clicked', async () => {
  let callCount = 0;
  server.use(
    http.get('/api/items', ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') || 1);
      return HttpResponse.json({
        items: Array.from({ length: 10 }, (_, i) => ({
          id: (page - 1) * 10 + i + 1,
          name: `Item ${(page - 1) * 10 + i + 1}`,
        })),
        hasNextPage: page < 3,
      });
    })
  );

  const user = userEvent.setup();
  render(<InfiniteList />);

  // Wait for first page
  await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument());
  expect(screen.queryByText('Item 11')).not.toBeInTheDocument();

  // Load next page
  await user.click(screen.getByText('Load More'));
  await waitFor(() => expect(screen.getByText('Item 11')).toBeInTheDocument());
});
```

---

## Testing Abort / Cancellation

```js
test('cancels in-flight request on unmount', async () => {
  const abortSpy = jest.fn();

  server.use(
    http.get('/api/slow', async ({ request }) => {
      request.signal.addEventListener('abort', abortSpy);
      await delay(1000); // Simulate slow response
      return HttpResponse.json({ data: 'too late' });
    })
  );

  const { unmount } = render(<SlowDataComponent />);
  
  // Unmount before response arrives
  unmount();
  
  await delay(100); // Give time for abort to propagate
  expect(abortSpy).toHaveBeenCalled();
});
```

---

## Best Practices for Testing Fetchers

1. **Use MSW over mocking fetch/axios** — it tests the actual code path more accurately
2. **Reset handlers after each test** — prevents test pollution
3. **Test all states**: loading, success, error, empty
4. **Use `waitFor`** for async assertions in React component tests
5. **Disable retries in test QueryClients** — TanStack Query retries by default which slows tests
6. **Test error boundaries** — ensure your error UI actually shows up
7. **Test network errors separately from HTTP errors** — they require different handling
