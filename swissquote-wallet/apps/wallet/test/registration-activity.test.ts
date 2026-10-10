import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as protocol from '@sq/protocol';
import type { DeviceRecord } from '../src/storage';
const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const owner = protocol.mnemonicToAddress(seed);
const wallet = '0x1111111111111111111111111111111111111111' as const;
const guardian = '0x3333333333333333333333333333333333333333' as const;
const setupCode = protocol.encodeCode({ v: 1, kind: 'setup', chainId: 31337, wallet, owner, partnerGuardian: guardian, sqGuardian: guardian, saltNonce: '9' });
const record = { id: 'client', owner, wallet, setupCode, cardGuardian: guardian, createdAt: 'now', envelope: { ciphertext: 'encrypted-only' } as DeviceRecord['envelope'] } satisfies DeviceRecord;
let signatures = 0;
let afterSign: (() => void) | undefined;
await mock.module('@sq/protocol', { namedExports: { ...protocol, signOwnershipProof: async (...args: Parameters<typeof protocol.signOwnershipProof>) => {
  signatures++; const proof = await protocol.signOwnershipProof(...args); afterSign?.(); return proof;
} } });
const { registerDeviceOwnership } = await import('../src/lifecycle');
for (const stage of ['before challenge', 'after challenge', 'after signing', 'after POST'] as const) {
  test(`optional activity guard refuses ${stage} at the actual helper boundary`, async () => {
    const original = globalThis.fetch; let active = stage !== 'before challenge'; let challenges = 0; let posts = 0; signatures = 0;
    afterSign = stage === 'after signing' ? () => { active = false; } : undefined;
    try {
      globalThis.fetch = async (url) => {
        if (String(url).endsWith('/challenge')) { challenges++; if (stage === 'after challenge') active = false; return Response.json({ nonce: 'fresh' }); }
        posts++; if (stage === 'after POST') active = false;
        return Response.json({ wallet, owner, verified: true });
      };
      await assert.rejects(registerDeviceOwnership(record, seed, 'client', 'token', 31337, 123n, () => { if (!active) throw new Error('Activity invalidated'); }), /Activity invalidated/);
      assert.equal(challenges, stage === 'before challenge' ? 0 : 1);
      assert.equal(signatures, stage === 'before challenge' || stage === 'after challenge' ? 0 : 1);
      assert.equal(posts, stage === 'after POST' ? 1 : 0);
    } finally { globalThis.fetch = original; afterSign = undefined; }
  });
}
test('async optional guard preserves a frozen receipt minimum and unchanged proof tuple', async () => {
  const original = globalThis.fetch; const stages: string[] = []; let body: any;
  const mutable = { ...record, deploymentBlock: '123' };
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/challenge')) { stages.push('challenge'); mutable.deploymentBlock = '999'; return Response.json({ nonce: 'fresh' }); }
      stages.push('post'); body = JSON.parse(String(options?.body)); return Response.json({ wallet, owner, verified: true });
    };
    await registerDeviceOwnership(mutable, seed, 'client', 'token', 31337, undefined, async () => { stages.push('guard'); });
    assert.deepEqual(stages, ['guard', 'challenge', 'guard', 'guard', 'post', 'guard']);
    assert.equal(body.minimumBlockNumber, '123'); assert.equal(body.expectedCurrentOwner, owner); assert.equal(body.ownershipProof.nonce, 'fresh');
    assert.equal(JSON.stringify(body).includes(seed), false);
  } finally { globalThis.fetch = original; }
});
