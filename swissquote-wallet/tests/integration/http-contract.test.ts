import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../../services/swissquote/src/app.ts';

// No shared-protocol crypto import: independently probes the frozen HTTP response
// shapes even while package integration is incomplete. No blockchain claims.
test('Swissquote frozen HTTP responses are usable by published API consumers', async t => {
  const app = createApp({ databasePath: ':memory:', allowMock: true });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const address = app.server.address(); assert.ok(address && typeof address === 'object');
  let token = '';
  async function request(path: string, body?: unknown) {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  const registered = await request('/auth/password/register', { email: 'contract@example.test', password: 'Independent-password!' });
  assert.equal(registered.status, 200); token = registered.body.token; assert.equal(typeof token, 'string');
  await t.test('SessionResponse supplies kycVerified false for newly registered account', () => {
    assert.equal(registered.body.kycVerified, false);
  });
  await t.test('unverified KYC refuses guardian enrollment', async () => {
    const result = await request('/guardian/enroll', {}); assert.equal(result.status, 403); assert.match(result.body.error, /KYC/);
  });
  await t.test('MockKycResponse supplies kycVerified true', async () => {
    const result = await request('/kyc/mock-verify', {}); assert.equal(result.status, 200); assert.equal(result.body.mock, true); assert.equal(result.body.kycVerified, true);
  });
  await t.test('MockMailboxMessage exposes resetToken and reset invalidates old session', async () => {
    assert.equal((await request('/auth/password/reset-request', { email: 'contract@example.test' })).status, 200);
    const mailbox = await request('/mock/mailbox'); assert.equal(mailbox.status, 200);
    const message = mailbox.body.messages[0]; assert.ok(message);
    assert.equal(typeof message.resetToken, 'string', 'frozen API field resetToken, not token');
    const reset = await request('/auth/password/reset', { token: message.resetToken, password: 'Independent-new-password!' }); assert.equal(reset.status, 200);
    assert.equal((await request('/account')).status, 401);
  });
});
