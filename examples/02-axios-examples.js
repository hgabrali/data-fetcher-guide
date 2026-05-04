/**
 * 02-axios-examples.js
 * Demonstrates data fetching with Axios – a popular HTTP client library.
 * Install: npm install axios
 */

import axios from 'axios';

// ─────────────────────────────────────────────
// 1. BASIC GET / POST
// ─────────────────────────────────────────────

// Simple GET
const { data: users } = await axios.get('https://jsonplaceholder.typicode.com/users');
console.log(users);

// GET with params
const { data: posts } = await axios.get('/api/posts', {
  params: { userId: 1, _limit: 5 },
});

// POST
const { data: newPost } = await axios.post('/api/posts', {
  title: 'Hello World',
  body: 'This is the post body.',
  userId: 1,
});


// ─────────────────────────────────────────────
// 2. AXIOS INSTANCE (Recommended Pattern)
// ─────────────────────────────────────────────

const api = axios.create({
  baseURL: 'https://api.example.com/v1',
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// All requests via this instance use the base config
const profile = await api.get('/profile');
const created = await api.post('/items', { name: 'Widget' });


// ─────────────────────────────────────────────
// 3. REQUEST INTERCEPTOR (Add auth token)
// ─────────────────────────────────────────────

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);


// ─────────────────────────────────────────────
// 4. RESPONSE INTERCEPTOR (Handle 401)
// ─────────────────────────────────────────────

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  response => response, // Pass through successful responses
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request until the token is refreshed
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/auth/refresh', {
          refreshToken: localStorage.getItem('refresh_token'),
        });
        localStorage.setItem('access_token', data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


// ─────────────────────────────────────────────
// 5. ERROR HANDLING WITH AXIOS
// ─────────────────────────────────────────────

async function fetchWithErrorHandling(url) {
  try {
    const { data } = await api.get(url);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with a non-2xx status
        console.error('Server error:', error.response.status, error.response.data);
      } else if (error.request) {
        // Request was made but no response received
        console.error('No response received:', error.request);
      } else {
        // Request setup error
        console.error('Request error:', error.message);
      }
    }
    throw error;
  }
}


// ─────────────────────────────────────────────
// 6. UPLOAD FILE WITH PROGRESS
// ─────────────────────────────────────────────

async function uploadWithProgress(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      const percent = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      onProgress(percent);
    },
  });

  return data;
}


// ─────────────────────────────────────────────
// 7. CANCELLING REQUESTS
// ─────────────────────────────────────────────

// With AbortController (Axios 0.22+)
const controller = new AbortController();

api.get('/slow-endpoint', { signal: controller.signal })
  .then(({ data }) => console.log(data))
  .catch(err => {
    if (axios.isCancel(err)) {
      console.log('Request cancelled:', err.message);
    }
  });

// Cancel after 2 seconds
setTimeout(() => controller.abort(), 2000);


// ─────────────────────────────────────────────
// 8. PARALLEL REQUESTS
// ─────────────────────────────────────────────

async function fetchDashboard() {
  const [{ data: user }, { data: stats }, { data: notifications }] = await Promise.all([
    api.get('/user/me'),
    api.get('/stats'),
    api.get('/notifications?unread=true'),
  ]);

  return { user, stats, notifications };
}


// ─────────────────────────────────────────────
// 9. AXIOS WITH TYPESCRIPT (type annotations)
// ─────────────────────────────────────────────

// interface User {
//   id: number;
//   name: string;
//   email: string;
// }
//
// const { data } = await api.get<User[]>('/users');
// data.forEach(user => console.log(user.name)); // fully typed
