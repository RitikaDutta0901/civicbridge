import assert from 'node:assert/strict';
import test from 'node:test';
import { auth, register, request } from './helpers.mjs';

test('challenge flow rejects invalid input, persists a challenge, and exposes its report', async () => {
  const user = await register();
  const invalid = await request('/api/challenges', {
    method: 'POST',
    headers: auth(user.token),
    body: JSON.stringify({ title: 'Incomplete' })
  });
  assert.equal(invalid.response.status, 400);

  const title = `Runtime challenge ${Date.now()}`;
  const created = await request('/api/challenges', {
    method: 'POST',
    headers: auth(user.token),
    body: JSON.stringify({
      title,
      description: 'A runtime validation challenge stored in PostgreSQL.',
      category: 'Environment',
      location: 'Runtime Test Area',
      expectedImpact: 'Verify challenge persistence and reporting.'
    })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.demo, false);
  const challengeId = created.body.data.id;

  const search = await request(`/api/search?q=${encodeURIComponent(title)}`);
  assert.equal(search.response.status, 200);
  assert.ok(search.body.data.some((item) => item.id === challengeId));

  const report = await request(`/api/challenges/${challengeId}/impact-report`);
  assert.equal(report.response.status, 200);
  assert.equal(report.body.data.id, challengeId);
  assert.equal(report.body.data.solutionCount, 0);
});
