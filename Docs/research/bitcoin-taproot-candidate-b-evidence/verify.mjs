// REGTEST ONLY. Deterministic, publicly derivable test keys: NEVER send real funds.
// Owns a fresh run-* directory, starts one isolated Core process, and stops it in finally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import * as btc from '@scure/btc-signer';
import { sha256, pubSchnorr, signSchnorr, taprootTweakPrivKey } from '@scure/btc-signer/utils.js';
import { ready, compilePolicyTaproot } from '@bitcoinerlab/miniscript-policies';
import { compileMiniscript, satisfier } from '@bitcoinerlab/miniscript';

const root = path.dirname(fileURLToPath(import.meta.url));
const run = fs.mkdtempSync(path.join(root, 'run-'));
const dataDir = path.join(run, 'node');
fs.mkdirSync(dataDir);
const hex = bytes => Buffer.from(bytes).toString('hex');
const fromHex = text => Uint8Array.from(Buffer.from(text, 'hex'));
const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const save = (name, value) => fs.writeFileSync(path.join(run, name), json(value) + '\n', { flag: 'wx' });
const N = 6; // Test parameter only, not a recommended real-world recovery delay.
const network = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
const labels = ['U', 'R', 'P', 'SQ', 'NEW_U', 'DEST', 'ATTACKER'];
const secrets = Object.fromEntries(labels.map(k => [k, sha256(Buffer.from(`PUBLIC REGTEST FIXTURE ONLY / Candidate B / ${k}`))]));
const pubs = Object.fromEntries(labels.map(k => [k, pubSchnorr(secrets[k])]));
const policy = `and(pk(R),and(or(pk(P),pk(SQ)),older(${N})))`;
await ready;
const compiled = compilePolicyTaproot(policy);
assert.equal(compiled.issane, true, json(compiled));
const assembly = compileMiniscript(compiled.miniscript, { tapscript: true });
assert.equal(assembly.issane, true, json(assembly));
const symbolic = satisfier(compiled.miniscript, { tapscript: true });
assert.equal(symbolic.malleableSats.length, 0);
assert.equal(symbolic.nonMalleableSats.length, 2);
const concrete = compiled.miniscript.replace(/\b(R|P|SQ)\b/g, label => hex(pubs[label]));
const ops = assembly.asm.split(/\s+/).map(token => {
  const key = token.match(/^<(R|P|SQ)>$/);
  if (key) return pubs[key[1]];
  if (/^\d+$/.test(token)) return Number(token);
  assert.match(token, /^OP_/);
  const op = token.slice(3);
  assert.ok(op in btc.OP, `unknown opcode ${token}`);
  return op;
});
const script = btc.Script.encode(ops);
const payment = btc.p2tr(pubs.U, { script }, network, true);
const newPayment = btc.p2tr(pubs.NEW_U, { script }, network, true);
const dest = btc.p2tr(pubs.DEST, undefined, network);
const attacker = btc.p2tr(pubs.ATTACKER, undefined, network);
const control = btc.TaprootControlBlock.encode(payment.tapLeafScript[0][0]);
const report = { started: new Date().toISOString(), run, network: 'regtest', N, policy,
  sourceSha256: hex(sha256(fs.readFileSync(fileURLToPath(import.meta.url)))),
  nodeVersion: process.version,
  compiler: '@bitcoinerlab/miniscript-policies@1.1.0 (reference compiler + tapscript rewrite/validation shim)',
  analysis: '@bitcoinerlab/miniscript@2.0.0', signer: '@scure/btc-signer@2.4.1',
  symbolicMiniscript: compiled.miniscript, concreteMiniscript: concrete,
  symbolicASM: assembly.asm, scriptHex: hex(script), scriptBytes: script.length,
  internalKey: hex(pubs.U), publicKeys: Object.fromEntries(labels.map(k => [k, hex(pubs[k])])),
  tapMerkleRoot: hex(payment.tapMerkleRoot), controlBlockHex: hex(control),
  address: payment.address, scriptPubKey: hex(payment.script), recoveryAddress: newPayment.address,
  descriptor: `tr(${hex(pubs.U)},${concrete})`, witnessTemplates: symbolic.nonMalleableSats,
  checks: [], minedTransactions: [] };
save('compiled-policy.json', report);
console.log(`ARTIFACT_DIRECTORY=${run}`);
console.log(`COMPILED ${compiled.miniscript}`);
let core;
let cookie;
let rpcPort;
let coreExit;
let logFd;
let miner;
let reqId = 0;
let success = false;

async function rpc(method, params = [], wallet) {
  const response = await fetch(`http://127.0.0.1:${rpcPort}/${wallet ? `wallet/${encodeURIComponent(wallet)}` : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(cookie).toString('base64')}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++reqId, method, params }), signal: AbortSignal.timeout(15000)
  });
  const body = await response.json();
  if (body.error) {
    const error = new Error(`${method}: ${body.error.message}`);
    error.rpcCode = body.error.code;
    error.rpcMessage = body.error.message;
    throw error;
  }
  return body.result;
}
function check(name, evidence) {
  report.checks.push({ name, passed: true, ...evidence });
  console.log(`PASS ${name}`);
}
async function mine(count = 1) { return rpc('generatetoaddress', [count, miner]); }
async function fund(count = 1, pay = payment) {
  // Address reuse is intentional only for this bounded regression test.
  const txids = [];
  for (let i = 0; i < count; i++) txids.push(await rpc('sendtoaddress', [pay.address, 0.01], 'funding'));
  await mine();
  const height = await rpc('getblockcount');
  const utxos = [];
  for (const txid of txids) {
    const decoded = await rpc('getrawtransaction', [txid, true]);
    for (const v of decoded.vout.filter(v => v.scriptPubKey.hex === hex(pay.script))) {
      utxos.push({ txid, index: v.n, amount: BigInt(Math.round(v.value * 1e8)), height, pay });
    }
  }
  assert.equal(utxos.length, count);
  return utxos;
}
function unsigned(utxo, { sequence = N, version = 2, destination = dest, amount = utxo.amount - 2000n } = {}) {
  const tx = new btc.Transaction({ version, allowUnknownInputs: true, allowUnknownOutputs: true });
  tx.addInput({ txid: utxo.txid, index: utxo.index, sequence,
    witnessUtxo: { script: utxo.pay.script, amount: utxo.amount } });
  tx.addOutput({ script: destination.script, amount });
  return tx;
}
function keySpend(utxo, who = 'U', opts = {}) {
  const tx = unsigned(utxo, { sequence: 0xffffffff, ...opts });
  const digest = tx.preimageWitnessV1(0, [utxo.pay.script], 0, [utxo.amount]);
  const sig = signSchnorr(digest, taprootTweakPrivKey(secrets[who], utxo.pay.tapMerkleRoot), new Uint8Array(32));
  tx.updateInput(0, { finalScriptWitness: [sig] });
  return tx;
}
function scriptSpend(utxo, holders, templateIndex = 0, opts = {}) {
  const tx = unsigned(utxo, opts);
  const digest = tx.preimageWitnessV1(0, [utxo.pay.script], 0, [utxo.amount], undefined, script, 0xc0);
  const template = symbolic.nonMalleableSats[templateIndex];
  const stack = template.asm.split(/\s+/).map(token => {
    if (token === '0') return new Uint8Array();
    const match = token.match(/^<sig\((R|P|SQ)\)>$/);
    assert.ok(match, `unknown witness token ${token}`);
    const label = opts.substitute?.[match[1]] ?? match[1];
    return holders.includes(label) ? signSchnorr(digest, secrets[label], new Uint8Array(32)) : new Uint8Array();
  });
  tx.updateInput(0, { finalScriptWitness: [...stack, script, control] });
  return tx;
}
async function probe(name, tx, expected, reasonPattern) {
  const [result] = await rpc('testmempoolaccept', [[tx.hex]]);
  (report.probes ??= []).push({ name, expectedAllowed: expected, result });
  assert.equal(result.allowed, expected, `${name}: ${json(result)}`);
  if (reasonPattern) assert.match(result['reject-reason'], reasonPattern, `${name}: ${json(result)}`);
  const evidence = { expectedAllowed: expected, mempool: result, txid: tx.id,
    transactionHex: tx.hex, height: await rpc('getblockcount'), witnessItems: tx.getInput(0).finalScriptWitness.length };
  check(name, evidence);
  return evidence;
}
async function rejectBlock(name, tx, pattern) {
  const height = await rpc('getblockcount');
  let rejection;
  try { await rpc('generateblock', [miner, [tx.hex]]); }
  catch (error) { rejection = { code: error.rpcCode, message: error.rpcMessage }; }
  assert.ok(rejection, `${name}: invalid transaction unexpectedly mined`);
  if (pattern) assert.match(rejection.message, pattern);
  assert.equal(await rpc('getblockcount'), height);
  check(name, { blockRejection: rejection, height, txid: tx.id });
}
async function broadcastMine(name, tx) {
  const txid = await rpc('sendrawtransaction', [tx.hex]);
  const [hash] = await mine();
  const block = await rpc('getblock', [hash]);
  assert.ok(block.tx.includes(txid));
  report.minedTransactions.push({ name, txid, blockhash: hash, height: block.height, transactionHex: tx.hex });
  check(name, { txid, blockhash: hash, height: block.height });
  return { txid, index: 0, amount: tx.getOutput(0).amount, height: block.height };
}

try {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  rpcPort = server.address().port;
  await new Promise(resolve => server.close(resolve));
  logFd = fs.openSync(path.join(run, 'node-process.log'), 'wx');
  const args = ['-regtest', '-server=1', '-listen=0', '-networkactive=0', '-dnsseed=0', '-discover=0',
    '-listenonion=0', '-rpcbind=127.0.0.1', '-rpcallowip=127.0.0.1', `-rpcport=${rpcPort}`,
    `-datadir=${dataDir}`, '-fallbackfee=0.0002', '-txindex=1', '-persistmempool=0', '-printtoconsole=1'];
  report.nodeArguments = args;
  core = spawn(path.join(root, 'bitcoin-29.0/bin/bitcoind'), args, { stdio: ['ignore', logFd, logFd] });
  coreExit = once(core, 'exit');
  // This bounded startup loop is inside one test process, not repeated model polling.
  for (let i = 0; i < 150; i++) {
    if (core.exitCode !== null) throw new Error(`Bitcoin Core exited during startup: ${core.exitCode}`);
    try {
      cookie = fs.readFileSync(path.join(dataDir, 'regtest/.cookie'), 'utf8').trim();
      await rpc('getblockchaininfo');
      break;
    } catch (error) { if (i === 149) throw error; await delay(100); }
  }
  report.coreVersion = await rpc('getnetworkinfo');
  assert.equal(report.coreVersion.version, 290000);
  assert.equal(report.coreVersion.networkactive, false);
  assert.equal(report.coreVersion.connections, 0);
  const chain = await rpc('getblockchaininfo');
  assert.equal(chain.chain, 'regtest');
  check('Isolated regtest node: networking disabled, no peers', { version: report.coreVersion.version });
  const deployment = await rpc('getdeploymentinfo');
  assert.equal(deployment.deployments.taproot.active, true);
  check('Taproot consensus deployment active', deployment.deployments.taproot);
  await rpc('createwallet', ['funding']);
  miner = await rpc('getnewaddress', ['', 'bech32'], 'funding');
  await mine(101);
  report.descriptorInfo = await rpc('getdescriptorinfo', [report.descriptor]);
  const [coreAddress] = await rpc('deriveaddresses', [report.descriptorInfo.descriptor]);
  assert.equal(coreAddress, payment.address);
  check('Core independently parses compiled descriptor and derives the identical Taproot address', { address: coreAddress });
  const stripped = btc.p2tr(pubs.U, undefined, network);
  assert.notEqual(stripped.address, payment.address);
  check('Phone key without recovery-tree metadata derives a different address', { withoutTree: stripped.address, withTree: payment.address });
  assert.notEqual(newPayment.address, payment.address);
  check('Replacing the phone key changes the address', { old: payment.address, replacement: newPayment.address });

  const [u0, rp, rsq, matrix, oldCoin, race, metadata] = await fund(7);
  report.fundingHeight = u0.height;
  const early = scriptSpend(rp, ['R', 'P']);
  await probe('Recovery before CSV age fails mempool validation', early, false, /non-BIP68-final/);
  await rejectBlock('Recovery before CSV age fails block validation', early, /non-BIP68-final|bad-txns-nonfinal/);
  await probe('Phone key path works immediately with final sequence', keySpend(u0), true);
  await broadcastMine('Phone-only key-path spend actually mined', keySpend(u0));
  // At height H+N-2, next block is H+N-1, still one too early.
  const toBoundary = u0.height + N - 2 - await rpc('getblockcount');
  assert.ok(toBoundary >= 0);
  if (toBoundary) await mine(toBoundary);
  await probe('CSV boundary: next block H+N-1 rejected', early, false, /non-BIP68-final/);
  await mine();
  assert.equal(await rpc('getblockcount'), u0.height + N - 1);
  await probe('CSV boundary: next block H+N accepted', early, true);
  await probe('R plus Swissquote is also allowed at the exact boundary', scriptSpend(rsq, ['R', 'SQ'], 1), true);

  // Enumerate every coalition. Build actual witnesses, including empty slots for absent keys.
  // A failure does not constitute an exhaustive proof over all possible scripts/signatures.
  for (let mask = 0; mask < 8; mask++) {
    const holders = ['R', 'P', 'SQ'].filter((_, bit) => mask & (1 << bit));
    const sats = satisfier(compiled.miniscript, { tapscript: true, knowns: holders.map(k => `<sig(${k})>`) });
    const expectedAny = holders.includes('R') && (holders.includes('P') || holders.includes('SQ'));
    assert.equal(sats.nonMalleableSats.length > 0, expectedAny);
    for (let branch = 0; branch < 2; branch++) {
      const other = branch === 0 ? 'P' : 'SQ';
      const allowed = holders.includes('R') && holders.includes(other);
      await probe(`Coalition [${holders.join(',') || 'none'}], ${other} witness path`, scriptSpend(matrix, holders, branch), allowed);
    }
  }
  for (const who of ['R', 'P', 'SQ']) {
    await probe(`Recovery party ${who} cannot use phone key path`, keySpend(matrix, who), false, /Schnorr/);
  }
  const forgedR = scriptSpend(matrix, ['P', 'SQ'], 0, { substitute: { R: 'SQ' } });
  await probe('P plus SQ cannot substitute SQ signature for mandatory R', forgedR, false, /Schnorr/);
  await rejectBlock('Forged mandatory-user signature also fails block validation', forgedR, /mandatory-script-verify-flag-failed|block validation failed|Schnorr/);
  for (const [name, opts] of [
    ['Sequence below script threshold', { sequence: N - 1 }],
    ['Sequence disable flag cannot bypass script CSV', { sequence: 0x80000000 + N }],
    ['Final sequence cannot bypass script CSV', { sequence: 0xffffffff }],
    ['Time-based sequence cannot satisfy block-based CSV', { sequence: 0x00400000 }],
    ['Transaction version one cannot bypass CSV', { version: 1 }]
  ]) await probe(name, scriptSpend(matrix, ['R', 'P'], 0, opts), false, /Locktime|locktime/);

  const beforeTamper = scriptSpend(matrix, ['R', 'P']);
  const tampered = unsigned(matrix, { destination: attacker });
  tampered.updateInput(0, { finalScriptWitness: beforeTamper.getInput(0).finalScriptWitness });
  await probe('Destination substitution after user signature fails', tampered, false, /Schnorr/);
  // Simulate only deserializing a backup payload: no encryption, paper code or kit UX is implemented.
  const kitPayload = JSON.stringify({ testOnlyPrivateKey: hex(secrets.U), descriptor: report.descriptor,
    tapMerkleRoot: hex(payment.tapMerkleRoot) });
  const restored = JSON.parse(kitPayload);
  const kitKeySpend = unsigned(metadata, { sequence: 0xffffffff });
  const kitDigest = kitKeySpend.preimageWitnessV1(0, [metadata.pay.script], 0, [metadata.amount]);
  const restoredSig = signSchnorr(kitDigest,
    taprootTweakPrivKey(fromHex(restored.testOnlyPrivateKey), fromHex(restored.tapMerkleRoot)), new Uint8Array(32));
  kitKeySpend.updateInput(0, { finalScriptWitness: [restoredSig] });
  await probe('Deserialized phone key plus public tree metadata spends without recovery parties', kitKeySpend, true);

  const bypassScript = btc.Script.encode([pubs.P, 'CHECKSIG']);
  const bypass = unsigned(matrix);
  const bypassDigest = bypass.preimageWitnessV1(0, [matrix.pay.script], 0, [matrix.amount], undefined, bypassScript, 0xc0);
  bypass.updateInput(0, { finalScriptWitness: [signSchnorr(bypassDigest, secrets.P, new Uint8Array(32)), bypassScript, control] });
  await probe('Replacing the committed leaf with partner-only script fails', bypass, false, /mismatch/);

  const rpTx = scriptSpend(rp, ['R', 'P'], 0, { destination: newPayment });
  await broadcastMine('R plus partner recovery sweep actually mined', rpTx);
  await broadcastMine('R plus Swissquote recovery sweep actually mined', scriptSpend(rsq, ['R', 'SQ'], 1));
  const recovered = { txid: rpTx.id, index: 0, amount: rpTx.getOutput(0).amount, height: await rpc('getblockcount') - 1, pay: newPayment };
  await probe('Old phone key fails on migrated output', keySpend(recovered, 'U'), false, /Schnorr/);
  await probe('New phone key succeeds on migrated output', keySpend(recovered, 'NEW_U'), true);
  await broadcastMine('New phone-only spend of recovered output actually mined', keySpend(recovered, 'NEW_U'));
  const utxoAfter = await rpc('gettxout', [rp.txid, rp.index]);
  assert.equal(utxoAfter, null);
  check('Recovery consumes the original UTXO; it does not rewrite its address', { spentOutpoint: `${rp.txid}:${rp.index}` });

  await mine(N + 2);
  // No recovery-initiation transaction was made for oldCoin.
  await probe('Already-old output has immediate recovery eligibility without a recovery request', scriptSpend(oldCoin, ['R', 'P']), true);
  const [fresh] = await fund(1);
  await probe('Fresh deposit to the same address has its own new delay', scriptSpend(fresh, ['R', 'P']), false, /non-BIP68-final/);
  await probe('Old phone key still spends future deposits to the original address', keySpend(fresh, 'U'), true);
  await probe('Old deposit remains eligible despite fresh deposit to the same address', scriptSpend(oldCoin, ['R', 'P']), true);
  const intendedRecovery = scriptSpend(race, ['R', 'P']);
  await probe('Mature recovery transaction valid before conflicting phone spend', intendedRecovery, true);
  // A phone-key thief is cryptographically indistinguishable from the owner.
  await broadcastMine('Competing phone-key spend wins when mined first', keySpend(race, 'U', { destination: attacker }));
  assert.equal(await rpc('gettxout', [race.txid, race.index]), null);
  await probe('Recovery cannot reverse a confirmed conflicting phone-key spend', intendedRecovery, false);

  report.completed = new Date().toISOString();
  report.summary = { passed: report.checks.length, minedTransactions: report.minedTransactions.length,
    finalHeight: await rpc('getblockcount'), conclusion: 'Authorization works; CSV is UTXO age, not a request-started cancellable timer; recovery migrates funds; SQ signs the recovery spending transaction.' };
  success = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  if (core && core.exitCode === null) {
    try { await rpc('stop'); } catch { core.kill('SIGTERM'); }
    // Clear the timer after successful exit so the runner does not stay alive needlessly.
    let timer;
    await Promise.race([coreExit, new Promise(resolve => {
      timer = setTimeout(() => { core.kill('SIGKILL'); resolve(); }, 10000);
    })]);
    clearTimeout(timer);
  }
  if (logFd !== undefined) fs.closeSync(logFd);
  report.nodeStopped = !core || core.exitCode !== null || core.signalCode !== null;
  assert.equal(report.nodeStopped, true, 'Bitcoin Core process did not stop');
  report.success = success;
  save('results.json', report);
  console.log(`RESULTS=${path.join(run, 'results.json')}`);
  console.log(success ? `ALL ${report.checks.length} CHECKS PASSED; ${report.minedTransactions.length} SPENDS MINED; NODE STOPPED` : 'TEST RUN FAILED; NODE STOPPED');
}
