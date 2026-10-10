// Shared fixture and helpers for the Candidate B verification tests.
// Safe v1.4.1 contracts are deployed from the npm package's own build artifacts
// (@safe-global/safe-contracts@1.4.1-2); the fixture checks that their runtime code hash
// equals the canonical v1.4.1 code hash published in @safe-global/safe-deployments.
const { ethers, network } = require("hardhat");
const { expect } = require("chai");

const ART = "@safe-global/safe-contracts/build/artifacts/contracts/";
const SafeArtifact = require(ART + "Safe.sol/Safe.json");
const FactoryArtifact = require(ART + "proxies/SafeProxyFactory.sol/SafeProxyFactory.json");
const HandlerArtifact = require(ART + "handler/CompatibilityFallbackHandler.sol/CompatibilityFallbackHandler.json");
const canonicalCodeHash = (name) =>
  require(`@safe-global/safe-deployments/dist/assets/v1.4.1/${name}.json`).deployments.canonical.codeHash;

const RECOVERY_PERIOD = 60n; // seconds; production would use 3-14 days
const SENTINEL = "0x0000000000000000000000000000000000000001";
const ZERO = ethers.ZeroAddress;
const coder = ethers.AbiCoder.defaultAbiCoder();

// Deterministic test keys (never used anywhere else).
const key = (name) => new ethers.Wallet(ethers.id("candidate-b-verify/" + name), ethers.provider);

const sortByAddr = (arr, f = (x) => x.address) =>
  [...arr].sort((a, b) => (BigInt(f(a)) < BigInt(f(b)) ? -1 : BigInt(f(a)) > BigInt(f(b)) ? 1 : 0));

async function fund(addr, eth = "100") {
  await network.provider.send("hardhat_setBalance", [addr, ethers.toQuantity(ethers.parseEther(eth))]);
}

// ---------- revert decoding ----------
function decodeRevert(e) {
  const seen = new Set();
  const datas = [];
  const msgs = [];
  const stack = [e];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    if (typeof cur.data === "string" && cur.data.startsWith("0x")) datas.push(cur.data);
    if (cur.data && typeof cur.data === "object" && typeof cur.data.data === "string") datas.push(cur.data.data);
    if (typeof cur.message === "string") msgs.push(cur.message);
    if (typeof cur.shortMessage === "string") msgs.push(cur.shortMessage);
    for (const k of ["error", "cause", "info", "parent"]) if (cur[k]) stack.push(cur[k]);
  }
  for (const d of datas) {
    if (d.startsWith("0x08c379a0")) return coder.decode(["string"], "0x" + d.slice(10))[0];
    if (d.startsWith("0x4e487b71")) return "panic " + coder.decode(["uint256"], "0x" + d.slice(10))[0];
  }
  for (const m of msgs) {
    const r = m.match(/reverted with reason string '([^']*)'/);
    if (r) return r[1];
  }
  for (const m of msgs) {
    if (/without a reason|non-contract account|returned data|custom error|reverted/i.test(m)) return "revert without reason";
  }
  return "UNDECODED: " + (msgs[0] || String(e)).slice(0, 300);
}

// Returns null if the transaction/call succeeded, otherwise the decoded revert reason.
async function outcome(fn) {
  try {
    const r = await fn();
    if (r && typeof r.wait === "function") await r.wait();
    return null;
  } catch (e) {
    return decodeRevert(e);
  }
}

async function expectRevert(label, fn, expected) {
  const got = await outcome(fn);
  console.log(`      evidence: ${label} -> ${got === null ? "SUCCEEDED" : `reverted "${got}"`}`);
  expect(got, label).to.equal(expected);
  return got;
}
async function expectSuccess(label, fn) {
  const got = await outcome(fn);
  console.log(`      evidence: ${label} -> ${got === null ? "succeeded" : `REVERTED "${got}"`}`);
  expect(got, label).to.equal(null);
}

// ---------- Safe helpers ----------
const safeAt = (addr) => new ethers.Contract(addr, SafeArtifact.abi, ethers.provider);

async function safeTxSignatures(safe, signerKeys, to, data, value = 0n, operation = 0) {
  const nonce = await safe.nonce();
  const hash = await safe.getTransactionHash(to, value, data, operation, 0, 0, 0, ZERO, ZERO, nonce);
  return ethers.concat(sortByAddr(signerKeys).map((k) => k.signingKey.sign(hash).serialized));
}

// Owner-signed Safe transaction, relayed by `sender` (anyone may relay).
async function execSafe(safe, signerKeys, to, data, { value = 0n, operation = 0, sender, gasLimit } = {}) {
  const sigs = await safeTxSignatures(safe, signerKeys, to, data, value, operation);
  const relayer = sender || signerKeys[0];
  const opts = gasLimit ? { gasLimit } : {};
  return safe.connect(relayer).execTransaction(to, value, data, operation, 0, 0, 0, ZERO, ZERO, sigs, opts);
}

function setupData(owners, threshold, handler, to = ZERO, data = "0x") {
  return new ethers.Interface(SafeArtifact.abi).encodeFunctionData("setup", [
    owners, threshold, to, data, handler, ZERO, 0, ZERO,
  ]);
}

// Address the phone can compute offline from the initializer (SafeProxyFactory v1.4.1 deployProxy).
async function predictSafeAddress(ctx, initializer, saltNonce) {
  const salt = ethers.keccak256(ethers.solidityPacked(["bytes32", "uint256"], [ethers.keccak256(initializer), saltNonce]));
  const creationCode = await ctx.factory.proxyCreationCode();
  const initCodeHash = ethers.keccak256(ethers.concat([creationCode, coder.encode(["uint256"], [ctx.singleton.target])]));
  return ethers.getCreate2Address(ctx.factory.target, salt, initCodeHash);
}

async function createSafe(ctx, owners, threshold, saltNonce, { to = ZERO, data = "0x" } = {}) {
  const init = setupData(owners, threshold, ctx.handler.target, to, data);
  const addr = await ctx.factory.createProxyWithNonce.staticCall(ctx.singleton.target, init, saltNonce);
  await (await ctx.factory.connect(ctx.k.relayer).createProxyWithNonce(ctx.singleton.target, init, saltNonce)).wait();
  return safeAt(addr);
}

// ---------- recovery helpers ----------
async function recoveryHash(ctx, wallet, owners, thr) {
  const n = await ctx.module.nonce(wallet);
  return ctx.module.getRecoveryHash(wallet, owners, thr, n);
}
// EOA guardian signature: plain ECDSA over the EIP-712 recovery hash.
const eoaSig = (k, hash) => k.signingKey.sign(hash).serialized;
// Signature by an owner of Safe `safeAddr` that makes safeAddr.isValidSignature(hash) succeed (EIP-1271).
async function safe1271Sig(ctx, safeAddr, ownerKey, hash) {
  const msgHash = await ctx.handler.getMessageHashForSafe(safeAddr, coder.encode(["bytes32"], [hash]));
  return ownerKey.signingKey.sign(msgHash).serialized;
}

async function prevGuardian(ctx, wallet, g) {
  const list = await ctx.module.getGuardians(wallet);
  const i = list.findIndex((x) => x.toLowerCase() === g.toLowerCase());
  if (i < 0) throw new Error("not a guardian");
  return i === 0 ? SENTINEL : list[i - 1];
}

const lower = (arr) => arr.map((a) => a.toLowerCase());
const sameSet = (a, b) => JSON.stringify(lower(a).sort()) === JSON.stringify(lower(b).sort());

// ---------- world fixture (one EVM snapshot, reverted before every test) ----------
let WORLD = null;

async function buildWorld() {
  const k = {
    Ph: key("Ph"), R: key("R"), P: key("P"), SQ: key("SQ"), N: key("newKey"),
    A: key("attacker"), O: key("outsider"), relayer: key("relayer"),
  };
  for (const w of Object.values(k)) await fund(w.address);
  const dep = k.relayer;
  const singleton = await (await new ethers.ContractFactory(SafeArtifact.abi, SafeArtifact.bytecode, dep).deploy()).waitForDeployment();
  const factory = await (await new ethers.ContractFactory(FactoryArtifact.abi, FactoryArtifact.bytecode, dep).deploy()).waitForDeployment();
  const handler = await (await new ethers.ContractFactory(HandlerArtifact.abi, HandlerArtifact.bytecode, dep).deploy()).waitForDeployment();
  const module = await (await (await ethers.getContractFactory("SocialRecoveryModule", dep)).deploy(RECOVERY_PERIOD)).waitForDeployment();

  const codeHashes = {};
  for (const [name, c] of [["safe", singleton], ["safe_proxy_factory", factory], ["compatibility_fallback_handler", handler]]) {
    const got = ethers.keccak256(await ethers.provider.getCode(c.target));
    codeHashes[name] = { got, canonical: canonicalCodeHash(name), match: got === canonicalCodeHash(name) };
  }
  const ctx = { k, singleton, factory, handler, module, codeHashes };

  // X = 1-of-2 Safe owned by the partner key P and the Swissquote key SQ.
  ctx.X = await createSafe(ctx, [k.P.address, k.SQ.address], 1, 1n);
  // W = user's Safe, owner Ph, threshold 1, module enabled, guardians {R, X}, guardian threshold 2 (Candidate B).
  ctx.W = await createSafe(ctx, [k.Ph.address], 1, 2n);
  // WA = a second user Safe configured as Candidate A: guardians {P, SQ}, threshold 2 (used by T5 and the T6 control).
  ctx.WA = await createSafe(ctx, [k.Ph.address], 1, 3n);
  const mi = ctx.module.interface;
  for (const [wallet, guardians] of [[ctx.W, [k.R.address, ctx.X.target]], [ctx.WA, [k.P.address, k.SQ.address]]]) {
    await (await execSafe(wallet, [k.Ph], wallet.target, wallet.interface.encodeFunctionData("enableModule", [module.target]))).wait();
    await (await execSafe(wallet, [k.Ph], module.target, mi.encodeFunctionData("addGuardianWithThreshold", [guardians[0], 1]))).wait();
    await (await execSafe(wallet, [k.Ph], module.target, mi.encodeFunctionData("addGuardianWithThreshold", [guardians[1], 2]))).wait();
    await fund(wallet.target, "10");
  }
  return ctx;
}

async function loadWorld() {
  if (!WORLD) {
    const ctx = await buildWorld();
    WORLD = { ctx, snap: await network.provider.send("evm_snapshot") };
  } else {
    await network.provider.send("evm_revert", [WORLD.snap]);
    WORLD.snap = await network.provider.send("evm_snapshot");
  }
  return WORLD.ctx;
}

async function increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [Number(seconds)]);
  await network.provider.send("evm_mine");
}

module.exports = {
  RECOVERY_PERIOD, SENTINEL, ZERO, coder, key, fund, sortByAddr, decodeRevert, outcome, expectRevert,
  expectSuccess, safeAt, execSafe, safeTxSignatures, setupData, predictSafeAddress, createSafe, recoveryHash,
  eoaSig, safe1271Sig, prevGuardian, sameSet, lower, loadWorld, increaseTime, SafeArtifact,
};
