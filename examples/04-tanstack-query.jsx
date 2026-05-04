/**
 * 04-tanstack-query.jsx
 * Demonstrates data fetching with TanStack Query (formerly React Query).
 * Install: npm install @tanstack/react-query
 *
 * TanStack Query manages server state for you:
 *   - Automatic caching and background refresh
 *   - Loading, error, and success states
 *   - Pagination and infinite scroll
 *   - Optimistic updates
 *   - Request deduplication
 */

import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';

// ─────────────────────────────────────────────
// SETUP: Create and provide the QueryClient
// ─────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // Data is fresh for 5 minutes
      cacheTime: 1000 * 60 * 10,     // Keep in cache for 10 minutes
      retry: 2,                       // Retry failed queries twice
      refetchOnWindowFocus: true,    // Refetch when user returns to tab
    },
  },
});

// Wrap your app with QueryClientProvider
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserList />
      <PostList />
      <InfinitePostList />
    </QueryClientProvider>
  );
}


// ─────────────────────────────────────────────
// API FUNCTIONS (pure fetch functions)
// ─────────────────────────────────────────────

const api = {
  getUsers: () =>
    fetch('https://jsonplaceholder.typicode.com/users').then(r => r.json()),

  getUser: (id) =>
    fetch(`https://jsonplaceholder.typicode.com/users/${id}`).then(r => r.json()),

  getPosts: ({ page = 1, limit = 10 } = {}) =>
    fetch(`https://jsonplaceholder.typicode.com/posts?_page=${page}&_limit=${limit}`)
      .then(r => r.json()),

  createPost: (post) =>
    fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    }).then(r => r.json()),

  updatePost: ({ id, ...data }) =>
    fetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deletePost: (id) =>
    fetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
      method: 'DELETE',
    }).then(r => r.json()),
};


// ─────────────────────────────────────────────
// 1. BASIC useQuery
// ─────────────────────────────────────────────

function UserList() {
  const {
    data: users,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['users'],           // Unique cache key
    queryFn: api.getUsers,         // Fetch function
    staleTime: 1000 * 60 * 2,      // Override: 2 min freshness
  });

  if (isLoading) return <div>Loading users...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  return (
    <div>
      {isFetching && <span>Refreshing...</span>}
      <button onClick={refetch}>Reload</button>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name} – {user.email}</li>
        ))}
      </ul>
    </div>
  );
}


// ─────────────────────────────────────────────
// 2. DEPENDENT QUERIES (fetch user, then their posts)
// ─────────────────────────────────────────────

function UserPosts({ userId }) {
  // Query 1: get user
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.getUser(userId),
  });

  // Query 2: only runs when user data is available
  const { data: posts } = useQuery({
    queryKey: ['posts', 'byUser', user?.id],
    queryFn: () => api.getPosts({ userId: user.id }),
    enabled: !!user?.id,   // Don't run until user is loaded
  });

  return (
    <div>
      <h2>{user?.name}'s Posts</h2>
      {posts?.map(post => <div key={post.id}>{post.title}</div>)}
    </div>
  );
}


// ─────────────────────────────────────────────
// 3. useMutation (Create, Update, Delete)
// ─────────────────────────────────────────────

function CreatePost() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: api.createPost,
    onSuccess: (newPost) => {
      // Invalidate the posts cache so the list refreshes
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      console.log('Created:', newPost);
    },
    onError: (error) => {
      console.error('Failed to create post:', error);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      title: 'New Post',
      body: 'Post content here',
      userId: 1,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Creating...' : 'Create Post'}
      </button>
      {createMutation.isError && <p>Error: {createMutation.error.message}</p>}
      {createMutation.isSuccess && <p>Post created!</p>}
    </form>
  );
}


// ─────────────────────────────────────────────
// 4. OPTIMISTIC UPDATES
// ─────────────────────────────────────────────

function PostList() {
  const queryClient = useQueryClient();
  const { data: posts } = useQuery({ queryKey: ['posts'], queryFn: api.getPosts });

  const deleteMutation = useMutation({
    mutationFn: api.deletePost,
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // Snapshot current data for rollback
      const previousPosts = queryClient.getQueryData(['posts']);

      // Optimistically update the UI immediately
      queryClient.setQueryData(['posts'], (old) =>
        old.filter(post => post.id !== deletedId)
      );

      return { previousPosts }; // context for onError
    },
    onError: (err, deletedId, context) => {
      // Roll back if the mutation fails
      queryClient.setQueryData(['posts'], context.previousPosts);
    },
    onSettled: () => {
      // Always refetch after success or failure
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  return (
    <ul>
      {posts?.map(post => (
        <li key={post.id}>
          {post.title}
          <button onClick={() => deleteMutation.mutate(post.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}


// ─────────────────────────────────────────────
// 5. INFINITE SCROLL with useInfiniteQuery
// ─────────────────────────────────────────────

function InfinitePostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['posts', 'infinite'],
    queryFn: ({ pageParam = 1 }) => api.getPosts({ page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      // Return next page number, or undefined if no more pages
      return lastPage.length === 10 ? allPages.length + 1 : undefined;
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data.pages.map((page, i) => (
        <React.Fragment key={i}>
          {page.map(post => (
            <div key={post.id}>{post.title}</div>
          ))}
        </React.Fragment>
      ))}
      <button
        onClick={fetchNextPage}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load More' : 'No more posts'}
      </button>
    </div>
  );
}

export default App;
