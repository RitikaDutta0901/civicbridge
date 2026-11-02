import assert from 'node:assert/strict';

export const baseUrl = process.env.BASE_URL || 'http://localhost:4000';

export async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export async function register(role = 'CITIZEN') {
  const email = `runtime-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = 'RuntimeTest123!';
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Runtime Test User', email, password, confirmPassword: password, role })
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.demo, false);
  return { ...result.body.data, password };
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}
