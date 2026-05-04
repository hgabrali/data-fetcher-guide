/**
 * 01-basic-fetch.js
 * Demonstrates the most fundamental data fetching patterns
 * using the native Fetch API built into modern browsers and Node.js 18+.
 */

// ─────────────────────────────────────────────
// 1. SIMPLE GET REQUEST
// ─────────────────────────────────────────────

async function getUsers() {
  const response = await fetch('https://jsonplaceholder.typicode.com/users');

  // Always check if the response was successful
  if (!response.ok) {
    throw new Error('Network response was not ok: ' + response.status);
  }

  const users = await response.json();
  return users;
}

// Usage
getUsers()
  .then(users => console.log('Users:', users))
  .catch(err => console.error('Error:', err));


// ─────────────────────────────────────────────
// 2. GET WITH QUERY PARAMETERS
// ─────────────────────────────────────────────

async function searchPosts(userId) {
  // URLSearchParams encodes parameters safely
  const params = new URLSearchParams({ userId });
  const response = await fetch(`https://jsonplaceholder.typicode.com/posts?${params}`);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}


// ─────────────────────────────────────────────
// 3. POST REQUEST (Create)
// ─────────────────────────────────────────────

async function createPost(title, body, userId) {
  const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, userId }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const newPost = await response.json();
  console.log('Created post with id:', newPost.id);
  return newPost;
}


// ─────────────────────────────────────────────
// 4. PUT REQUEST (Replace)
// ─────────────────────────────────────────────

async function replacePost(id, title, body, userId) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, title, body, userId }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}


// ─────────────────────────────────────────────
// 5. PATCH REQUEST (Partial Update)
// ─────────────────────────────────────────────

async function updatePostTitle(id, title) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}


// ─────────────────────────────────────────────
// 6. DELETE REQUEST
// ─────────────────────────────────────────────

async function deletePost(id) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  // DELETE often returns 200 with empty body or 204 No Content
  console.log(`Post ${id} deleted, status: ${response.status}`);
  return response.status === 204 ? null : response.json();
}


// ─────────────────────────────────────────────
// 7. READING DIFFERENT RESPONSE TYPES
// ─────────────────────────────────────────────

async function fetchDifferentTypes() {
  const base = 'https://example.com';

  // JSON
  const json = await fetch(`${base}/data.json`).then(r => r.json());

  // Plain text
  const text = await fetch(`${base}/file.txt`).then(r => r.text());

  // Binary (e.g. image or PDF)
  const blob = await fetch(`${base}/image.png`).then(r => r.blob());

  // ArrayBuffer (for binary processing)
  const buffer = await fetch(`${base}/data.bin`).then(r => r.arrayBuffer());

  return { json, text, blob, buffer };
}


// ─────────────────────────────────────────────
// 8. READING RESPONSE HEADERS
// ─────────────────────────────────────────────

async function inspectResponse(url) {
  const response = await fetch(url);

  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);
  console.log('Content-Type:', response.headers.get('content-type'));
  console.log('Cache-Control:', response.headers.get('cache-control'));

  // Iterate all headers
  for (const [key, value] of response.headers) {
    console.log(`  ${key}: ${value}`);
  }

  return response.json();
}


// ─────────────────────────────────────────────
// 9. SENDING CUSTOM HEADERS (e.g. Auth token)
// ─────────────────────────────────────────────

async function fetchProtectedResource(token) {
  const response = await fetch('https://api.example.com/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-Client-Version': '1.0.0',
    },
  });

  if (response.status === 401) throw new Error('Unauthorized – token may have expired');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return response.json();
}


// ─────────────────────────────────────────────
// 10. UPLOAD A FILE WITH FORMDATA
// ─────────────────────────────────────────────

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', 'My uploaded file');

  // Note: Do NOT set Content-Type manually for FormData —
  // the browser sets it with the correct boundary automatically
  const response = await fetch('https://api.example.com/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return response.json();
}
