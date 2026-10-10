// Local-only recovery retention. Never decrypt/export an owner seed or log secrets.
import { mkdir, open, lstat, realpath, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const walletRoot = fileURLToPath(new URL('../../', import.meta.url));
const safeId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const fail = () => new Error('Secure local retention failed; further broadcasts are blocked.');
const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const deviceFields = new Set(['id', 'wallet', 'owner', 'envelope', 'createdAt', 'setupCode', 'cardGuardian', 'kitSavedAt', 'independentCheckedAt', 'passkeyRegisteredAt', 'pastRecipients', 'deploymentBlock']);

// Only the small JSON-compatible subset actually emitted by Playwright 1.64's
// storageScript is accepted. Primitives are raw; {s,id} is a Set, not a string.
// Never invoke Playwright's general parser (references, buffers, dates, etc.).
function decodeDeviceValue(encoded) {
  const seen = new WeakSet(), ids = new Set();
  let nodes = 0, characters = 0;
  const string = value => {
    if (typeof value !== 'string' || value.length > 8192 || (characters += value.length) > 32768) throw fail();
    return value;
  };
  const fields = object => {
    if (!object || typeof object !== 'object' || Array.isArray(object) || ![Object.prototype, null].includes(Object.getPrototypeOf(object)) || seen.has(object)) throw fail();
    seen.add(object);
    const keys = Reflect.ownKeys(object);
    if (keys.length > 64 || keys.some(key => typeof key !== 'string' || !Object.getOwnPropertyDescriptor(object, key)?.enumerable || !Object.hasOwn(Object.getOwnPropertyDescriptor(object, key), 'value'))) throw fail();
    return keys.sort().join(',');
  };
  const list = array => {
    if (!Array.isArray(array) || Object.getPrototypeOf(array) !== Array.prototype || array.length > 64 || seen.has(array)) throw fail();
    seen.add(array);
    if (Reflect.ownKeys(array).length !== array.length + 1) throw fail();
    for (let i = 0; i < array.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(array, String(i));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw fail();
    }
    return array;
  };
  const decode = (value, depth = 0, recipients = false) => {
    if (++nodes > 256 || depth > 8) throw fail();
    if (typeof value === 'string') return string(value);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
    const keys = fields(value);
    if (keys === 'v') {
      if (value.v === 'undefined') return undefined;
      if (value.v === 'null') return null;
      throw fail();
    }
    if (keys !== 'id,o' && keys !== 'a,id') throw fail();
    if (!Number.isSafeInteger(value.id) || value.id < 1 || ids.has(value.id)) throw fail();
    ids.add(value.id);
    if (keys === 'a,id') {
      // The only array in a device record is a list of prior recipient strings.
      if (!recipients) throw fail();
      return list(value.a).map(item => {
        const decoded = decode(item, depth + 1);
        if (typeof decoded !== 'string') throw fail();
        return decoded;
      });
    }
    const result = Object.create(null);
    for (const entry of list(value.o)) {
      if (++nodes > 256 || fields(entry) !== 'k,v') throw fail();
      const key = string(entry.k);
      if (['__proto__', 'prototype', 'constructor'].includes(key) || Object.hasOwn(result, key)) throw fail();
      result[key] = decode(entry.v, depth + 1, depth === 0 && key === 'pastRecipients');
    }
    return result;
  };
  return decode(encoded);
}

function deviceValue(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw fail();
  const plain = Object.hasOwn(record, 'value'), encoded = Object.hasOwn(record, 'valueEncoded');
  if (plain === encoded) throw fail(); // Missing or ambiguous representation.
  return plain ? record.value : decodeDeviceValue(record.valueEncoded);
}

// Decode only for validation. The original storageState is retained unchanged.
// This checks the actual serialized IndexedDB export, not a UI claim or a seed read.
export function hasEncryptedDevice(state, { owner, wallet } = {}) {
  const records = state.origins?.flatMap(origin => origin.indexedDB?.filter(db => db.name === 'sq-wallet-device-v1').flatMap(db => db.stores?.filter(store => store.name === 'keys').flatMap(store => store.records ?? []) ?? []) ?? []) ?? [];
  const values = records.map(deviceValue);
  for (const value of values) {
    if (!value || Object.keys(value).some(key => !deviceFields.has(key))) throw fail();
    // Public deployment metadata is optional, but must match lifecycle's uint64 format.
    // Require a full-string match: JavaScript's $ also matches before a final newline.
    const block = value.deploymentBlock;
    if (block !== undefined && (typeof block !== 'string' || /^(0|[1-9][0-9]{0,19})$/.exec(block)?.[0] !== block || BigInt(block) > 18446744073709551615n)) throw fail();
    const e = value.envelope;
    if (!e || Object.keys(e).sort().join(',') !== 'ciphertext,iv,kdf,salt,v' || e.v !== 1 || e.kdf?.name !== 'PBKDF2' || e.kdf.hash !== 'SHA-256' || e.kdf.iterations !== 600000 || Object.keys(e.kdf).length !== 3) throw fail();
    if (![e.salt, e.iv, e.ciphertext].every(text => typeof text === 'string' && /^[A-Za-z0-9_-]+$/.test(text)) || Buffer.from(e.salt, 'base64url').length !== 16 || Buffer.from(e.iv, 'base64url').length !== 12 || Buffer.from(e.ciphertext, 'base64url').length < 16 || e.ciphertext.length > 8192) throw fail();
  }
  return values.some(value => (!owner || sameAddress(value.owner, owner)) && (!wallet || sameAddress(value.wallet, wallet)));
}

export async function createLiveRetention({ optIn = process.env.ALLOW_SEPOLIA_LOCAL_RETENTION, runId = process.env.SEPOLIA_RUN_ID ?? randomUUID(), walletCwd = process.cwd() } = {}) {
  if (optIn !== 'yes' || !safeId.test(runId)) throw fail();
  const cwd = resolve(walletCwd);
  // Test fixtures may supply their own wallet root; the live harness passes its fixed root.
  let handles = [];
  try {
    if (await realpath(cwd) !== cwd || !cwd.endsWith('/swissquote-wallet')) throw fail();
    const ignore = (await readFile(join(dirname(cwd), '.gitignore'), 'utf8')).split(/\r?\n/).map(line => line.trim());
    const ignoredAt = ignore.indexOf('swissquote-wallet/.sepolia-runs/');
    if (ignoredAt < 0 || ignore.slice(ignoredAt + 1).some(line => line.startsWith('!'))) throw fail();
    const root = join(cwd, '.sepolia-runs');
    try { await mkdir(root, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const checked = async (path, initial, mode, directory) => {
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== mode || (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) || (initial && (stat.ino !== initial.ino || stat.dev !== initial.dev))) throw fail();
      return stat;
    };
    const rootStat = await checked(root, undefined, 0o700, true);
    const runPath = join(root, runId);
    await mkdir(runPath, { mode: 0o700 }); // Exclusive: never reuse an existing run.
    const runStat = await checked(runPath, undefined, 0o700, true);
    const files = [];
    for (const name of ['recovery-private.json', 'browser-state-0.json', 'browser-state-1.json']) {
      const path = join(runPath, name);
      const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      handles.push(handle);
      await handle.chmod(0o600);
      files.push({ path, handle, stat: await checked(path, undefined, 0o600, false) });
    }
    // Persist newly created names as well as file contents before any broadcast.
    for (const path of [cwd, root, runPath]) {
      const directory = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try { await directory.sync(); } finally { await directory.close(); }
    }
    let credentialsSaved = false, blocked = false, closed = false, slot = 0;
    let queue = Promise.resolve();
    const checkPaths = async () => {
      if (closed || await realpath(cwd) !== cwd) throw fail();
      await checked(root, rootStat, 0o700, true); await checked(runPath, runStat, 0o700, true);
      for (const file of files) {
        await checked(file.path, file.stat, 0o600, false);
        const held = await file.handle.stat();
        if (held.ino !== file.stat.ino || held.dev !== file.stat.dev || held.nlink !== 1 || (held.mode & 0o777) !== 0o600) throw fail();
      }
    };
    const writeHeld = async (file, data) => {
      await checkPaths();
      const bytes = Buffer.from(JSON.stringify(data));
      // Positioned writes through the exclusive original handle defeat file-path swaps.
      let offset = 0;
      while (offset < bytes.length) {
        const { bytesWritten } = await file.handle.write(bytes, offset, bytes.length - offset, offset);
        if (!bytesWritten) throw fail();
        offset += bytesWritten;
      }
      await file.handle.truncate(bytes.length); await file.handle.sync(); await checkPaths();
    };
    const serialized = operation => {
      const result = queue.then(operation).catch(() => { blocked = true; throw fail(); });
      queue = result.catch(() => {});
      return result;
    };
    return {
      runId,
      async retainCredentials({ devicePassphrase, cardWords, ...extra }) {
        return serialized(async () => {
          if (credentialsSaved || Object.keys(extra).length || typeof devicePassphrase !== 'string' || devicePassphrase.length < 12 || typeof cardWords !== 'string' || cardWords.trim().split(/\s+/).length !== 12) throw fail();
          await writeHeld(files[0], { schema: 'sepolia-local-recovery-v1', devicePassphrase, cardWords });
          credentialsSaved = true;
        });
      },
      async snapshot(context, { owner, wallet, requireDevice = false } = {}) {
        return serialized(async () => {
          let timer;
          let state;
          try {
            state = await Promise.race([context.storageState({ indexedDB: true }), new Promise((_, reject) => { timer = setTimeout(() => reject(fail()), 3000); })]);
          } finally { clearTimeout(timer); }
          const present = hasEncryptedDevice(state, { owner, wallet });
          if (requireDevice && !present) throw fail();
          // Two alternating private slots preserve the prior completed snapshot on a failed write.
          await writeHeld(files[1 + slot], state); slot = 1 - slot;
          return present;
        });
      },
      async guardWrite(context, { owner, wallet, deploy = false } = {}) {
        if (!credentialsSaved || blocked || closed) { blocked = true; throw fail(); }
        // App currently saves the encrypted owner before requesting deployment.
        // Require owner now; wallet binding is only available after deployment mines.
        await this.snapshot(context, { owner, ...(deploy ? {} : { wallet }), requireDevice: true });
        if (blocked) throw fail();
      },
      async close() { await queue; closed = true; await Promise.all(handles.map(handle => handle.close())); },
    };
  } catch {
    await Promise.all(handles.map(handle => handle.close().catch(() => {})));
    throw fail();
  }
}

export async function createHarnessRetention() {
  if (resolve(process.cwd()) !== resolve(walletRoot)) throw fail();
  return createLiveRetention({ walletCwd: walletRoot });
}
