import assert from 'node:assert/strict';
import test from 'node:test';
import { auth, register, request } from './helpers.mjs';

test('auth flow registers, rejects unauthenticated access, and persists profile updates', async () => {
  const user = await register();

  const unauthorized = await request('/api/profile');
  assert.equal(unauthorized.response.status, 401);

  const profile = await request('/api/profile', { headers: auth(user.token) });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.data.email, user.email);
  assert.equal(profile.body.demo, false);

  const updated = await request('/api/profile', {
    method: 'PATCH',
    headers: auth(user.token),
    body: JSON.stringify({ name: 'Persisted Runtime User' })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.name, 'Persisted Runtime User');

  const readBack = await request('/api/profile', { headers: auth(user.token) });
  assert.equal(readBack.body.data.name, 'Persisted Runtime User');
});
