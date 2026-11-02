import assert from 'node:assert/strict';
import test from 'node:test';
import { auth, register, request } from './helpers.mjs';

test('moderation flow requires authentication and prevents duplicate reports', async () => {
  const user = await register();
  const challenge = await request('/api/challenges?limit=1');
  assert.equal(challenge.response.status, 200);
  assert.ok(challenge.body.data[0]?.id);

  const unauthenticated = await request('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ challengeId: challenge.body.data[0].id, reason: 'Inappropriate content' })
  });
  assert.equal(unauthenticated.response.status, 401);

  const payload = { challengeId: challenge.body.data[0].id, reason: 'Runtime moderation validation' };
  const created = await request('/api/reports', {
    method: 'POST',
    headers: auth(user.token),
    body: JSON.stringify(payload)
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.demo, false);

  const duplicate = await request('/api/reports', {
    method: 'POST',
    headers: auth(user.token),
    body: JSON.stringify(payload)
  });
  assert.equal(duplicate.response.status, 409);
});
