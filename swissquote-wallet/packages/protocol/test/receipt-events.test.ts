import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEventLog, encodeAbiParameters, keccak256, stringToHex, type Hex } from 'viem';
import { safeAbi } from '../src/abis.js';
// Matches Safe v1.4.1 Safe.sol events: txHash is indexed, payment is data.
for (const eventName of ['ExecutionSuccess', 'ExecutionFailure'] as const) {
  test(`Safe ${eventName} decodes the indexed transaction hash`, () => {
    const txHash = `0x${'ab'.repeat(32)}` as Hex;
    const decoded = decodeEventLog({ abi: safeAbi, topics: [keccak256(stringToHex(`${eventName}(bytes32,uint256)`)), txHash], data: encodeAbiParameters([{ type: 'uint256' }], [0n]) });
    assert.equal(decoded.eventName, eventName);
    assert.deepEqual(decoded.args, { txHash, payment: 0n });
  });
}
