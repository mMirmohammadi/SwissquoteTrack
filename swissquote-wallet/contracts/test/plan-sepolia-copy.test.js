// Plan review (technical lens): checks §5–§7 of Docs/plans/swissquote-wallet-build-plan.md against a faithful
// local copy of the Sepolia contracts. Local Hardhat chain only. Runtime code comes from the read-only
// eth_getCode fixture contracts/plan/sepolia-code.json (fetched from ethereum-sepolia-rpc.publicnode.com).
const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const FX = require("../contracts/plan/sepolia-code.json");
const { decodeRevert } = require("./helpers"); // read-only reuse of the harness's revert decoder

const ART = "@safe-global/safe-contracts/build/artifacts/contracts/";
const SafeL2Abi = require(ART + "SafeL2.sol/SafeL2.json").abi;
const FactoryAbi = require(ART + "proxies/SafeProxyFactory.sol/SafeProxyFactory.json").abi;
const HandlerAbi = require(ART + "handler/CompatibilityFallbackHandler.sol/CompatibilityFallbackHandler.json").abi;
const canon = (n) => require(`@safe-global/safe-deployments/dist/assets/v1.4.1/${n}.json`).deployments.canonical.codeHash;

const A_ADDR = FX.contracts.CandideRecovery3min.address;
const SENTINEL = "0x0000000000000000000000000000000000000001";
const ZERO = ethers.ZeroAddress;
const coder = ethers.AbiCoder.defaultAbiCoder();
const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const FALLBACK_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";
const IMMUTABLE_OFFSET = 11180; // recoveryPeriod (from the harness build-info immutableReferences)
const ev = (s) => console.log("      evidence: " + s);

const key = (n) => new ethers.Wallet(ethers.id("plan-review-technical/" + n), ethers.provider);
const K = { owner: key("owner"), R: key("R"), P: key("P"), SQ: key("SQ"), N: key("newOwner"), relayer: key("relayer"), out: key("outsider") };
const byAddr = (a, b) => (BigInt(a.signer) < BigInt(b.signer) ? -1 : 1);

async function outcome(fn) {
  try { const r = await fn(); if (r && r.wait) await r.wait(); return null; } catch (e) { return decodeRevert(e); }
}
async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }
async function increase(s) { await network.provider.send("evm_increaseTime", [Number(s)]); await network.provider.send("evm_mine"); }

const SAFE_TX_TYPES = { SafeTx: [
  { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" },
  { name: "operation", type: "uint8" }, { name: "safeTxGas", type: "uint256" }, { name: "baseGas", type: "uint256" },
  { name: "gasPrice", type: "uint256" }, { name: "gasToken", type: "address" }, { name: "refundReceiver", type: "address" },
  { name: "nonce", type: "uint256" } ] };
const RECOVERY_TYPES = { ExecuteRecovery: [
  { name: "wallet", type: "address" }, { name: "newOwners", type: "address[]" },
  { name: "newThreshold", type: "uint256" }, { name: "nonce", type: "uint256" } ] };
const SAFE_MSG_TYPES = { SafeMessage: [{ name: "message", type: "bytes" }] };

let C; // world
async function chainId() { return (await ethers.provider.getNetwork()).chainId; }

// Owner signs a Safe transaction off-chain (EIP-712, as viem signTypedData would); relayer submits.
async function safeTx(wallet, signer, fields, { submit = true, sender = K.relayer, mutate } = {}) {
  const tx = { to: fields.to, value: fields.value ?? 0n, data: fields.data ?? "0x", operation: fields.operation ?? 0,
    safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: ZERO, refundReceiver: ZERO, nonce: fields.nonce ?? (await wallet.nonce()) };
  const sig = await signer.signTypedData({ chainId: await chainId(), verifyingContract: wallet.target }, SAFE_TX_TYPES, tx);
  const sent = mutate ? { ...tx, ...mutate } : tx;
  if (!submit) return { tx, sig };
  return wallet.connect(sender).execTransaction(sent.to, sent.value, sent.data, sent.operation, sent.safeTxGas, sent.baseGas,
    sent.gasPrice, sent.gasToken, sent.refundReceiver, sig);
}

function multiSendPayload(calls) {
  return ethers.concat(calls.map((c) => ethers.solidityPacked(["uint8", "address", "uint256", "uint256", "bytes"],
    [c.operation ?? 0, c.to, c.value ?? 0n, ethers.dataLength(c.data), c.data])));
}

describe("Plan review: faithful local copy of the Sepolia contracts (checks 1-7)", function () {
  before(async function () {
    // ---------- Check 1: place the fetched Sepolia runtime code at the same addresses ----------
    for (const [name, c] of Object.entries(FX.contracts)) {
      await network.provider.send("hardhat_setCode", [c.address, c.code]);
      // Constructor-written storage is not part of runtime code: copy the non-zero slots we fetched (SafeL2 slot 4 = threshold 1).
      for (const [slot, v] of Object.entries(c.nonZeroStorage0to8))
        await network.provider.send("hardhat_setStorageAt", [c.address, ethers.toQuantity(Number(slot)), v]);
    }
    for (const w of Object.values(K)) await network.provider.send("hardhat_setBalance", [w.address, ethers.toQuantity(ethers.parseEther("100"))]);
    const p = ethers.provider;
    C = {
      singleton: new ethers.Contract(FX.contracts.SafeL2.address, SafeL2Abi, p),
      factory: new ethers.Contract(FX.contracts.SafeProxyFactory.address, FactoryAbi, p),
      handler: new ethers.Contract(FX.contracts.CompatibilityFallbackHandler.address, HandlerAbi, p),
      msco: FX.contracts.MultiSendCallOnly.address, ms: FX.contracts.MultiSend.address, sms: FX.contracts.SafeModuleSetup.address,
    };
    const modArt = await ethers.getContractFactory("SocialRecoveryModule");
    C.A = modArt.attach(A_ADDR).connect(p);
    // ---------- Check 2 prerequisite / check 5: module B = the harness's v0.0.1 build, 5-minute wait ----------
    const dep = await modArt.connect(K.relayer).deploy(300);
    const rcpt = await dep.deploymentTransaction().wait();
    C.B = dep.connect(p);
    C.Bdeploy = { gasUsed: rcpt.gasUsed, initcode: dep.deploymentTransaction().data };
  });

  it("C1: local code at each Sepolia address equals the fetched code; Safe hashes are canonical v1.4.1", async function () {
    console.log(`      fixture: Sepolia chainId ${BigInt(FX.chainId)}, block ${BigInt(FX.blockNumber)}, hardfork ${network.config.hardfork}`);
    for (const [name, c] of Object.entries(FX.contracts)) {
      const local = await ethers.provider.getCode(c.address);
      expect(local).to.equal(c.code);
      ev(`${name} ${c.address}: ${c.codeSize} bytes, keccak ${ethers.keccak256(local).slice(0, 18)}…, non-zero slots 0-8 ${JSON.stringify(c.nonZeroStorage0to8)}`);
    }
    for (const [name, n] of [["SafeL2", "safe_l2"], ["SafeProxyFactory", "safe_proxy_factory"], ["CompatibilityFallbackHandler", "compatibility_fallback_handler"], ["MultiSendCallOnly", "multi_send_call_only"], ["MultiSend", "multi_send"]])
      expect(FX.contracts[name].codeHash, name).to.equal(canon(n));
    ev("SafeL2, factory, handler, MultiSendCallOnly, MultiSend code hashes == safe-deployments v1.4.1 canonical codeHash");
    expect(await C.singleton.VERSION()).to.equal("1.4.1");
    expect(await C.A.VERSION()).to.equal("0.0.1");
    const st = await outcome(() => C.singleton.connect(K.out).setup([K.out.address], 1, ZERO, "0x", ZERO, ZERO, 0, ZERO));
    ev(`singleton.setup by outsider (constructor slot 4 copied) -> ${st}`);
    expect(st).to.equal("GS200");
  });

  it("C2: creation exactly as §7.1 steps 6-7; CREATE2 prediction matches; A and B enabled", async function () {
    const smsIface = new ethers.Interface(["function enableModules(address[] modules)"]);
    const init = C.singleton.interface.encodeFunctionData("setup", [[K.owner.address], 1, C.sms,
      smsIface.encodeFunctionData("enableModules", [[C.A.target, C.B.target]]), C.handler.target, ZERO, 0, ZERO]);
    const saltNonce = 20261010n;
    const salt = ethers.keccak256(ethers.solidityPacked(["bytes32", "uint256"], [ethers.keccak256(init), saltNonce]));
    const creation = await C.factory.proxyCreationCode();
    const initCodeHash = ethers.keccak256(ethers.concat([creation, coder.encode(["uint256"], [C.singleton.target])]));
    const predicted = ethers.getCreate2Address(C.factory.target, salt, initCodeHash);
    const rc = await (await C.factory.connect(K.relayer).createProxyWithNonce(C.singleton.target, init, saltNonce)).wait();
    const log = rc.logs.map((l) => { try { return C.factory.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "ProxyCreation");
    ev(`predicted ${predicted}; ProxyCreation.proxy ${log.args.proxy}; createProxyWithNonce gasUsed ${rc.gasUsed}`);
    expect(log.args.proxy).to.equal(predicted);
    C.W = new ethers.Contract(predicted, SafeL2Abi, ethers.provider);
    const [mods] = await C.W.getModulesPaginated(SENTINEL, 10);
    ev(`getOwners ${JSON.stringify(await C.W.getOwners())} threshold ${await C.W.getThreshold()} modules ${JSON.stringify(mods)}`);
    expect(await C.W.isModuleEnabled(C.A.target)).to.equal(true);
    expect(await C.W.isModuleEnabled(C.B.target)).to.equal(true);
    const guard = await ethers.provider.getStorage(predicted, GUARD_SLOT);
    const fb = await ethers.provider.getStorage(predicted, FALLBACK_SLOT);
    ev(`guard slot ${guard === ethers.ZeroHash ? "0 (none)" : guard}; fallback slot -> ${ethers.getAddress("0x" + fb.slice(26))}`);
    expect(ethers.getAddress("0x" + fb.slice(26))).to.equal(C.handler.target);
    // Tampered initializer (extra owner) gives a different address, so the plan's address comparison catches it.
    const bad = C.singleton.interface.encodeFunctionData("setup", [[K.owner.address, K.out.address], 1, C.sms,
      smsIface.encodeFunctionData("enableModules", [[C.A.target, C.B.target]]), C.handler.target, ZERO, 0, ZERO]);
    const badAddr = await C.factory.connect(K.relayer).createProxyWithNonce.staticCall(C.singleton.target, bad, saltNonce);
    ev(`tampered initializer (extra owner) would deploy at ${badAddr} != ${predicted}`);
    expect(badAddr).to.not.equal(predicted);
    await network.provider.send("hardhat_setBalance", [predicted, ethers.toQuantity(ethers.parseEther("5"))]);
  });

  it("C3: guardian setup in ONE Safe tx via MultiSendCallOnly (operation 1); plan's 3-argument call fails", async function () {
    const mi = C.A.interface;
    // Plan text: A.addGuardianWithThreshold(wallet, R, 1) – a 3-argument function that v0.0.1 does not have.
    const planIface = new ethers.Interface(["function addGuardianWithThreshold(address wallet, address guardian, uint256 threshold)"]);
    const planCalls = [[C.A, K.R, 1], [C.A, K.P, 2], [C.B, K.R, 1], [C.B, K.SQ, 2]].map(([m, g, t]) => ({ to: m.target, data: planIface.encodeFunctionData("addGuardianWithThreshold", [C.W.target, g.address, t]) }));
    const r0 = await outcome(() => safeTx(C.W, K.owner, { to: C.msco, data: new ethers.Interface(["function multiSend(bytes)"]).encodeFunctionData("multiSend", [multiSendPayload(planCalls)]), operation: 1 }));
    ev(`plan's literal 3-arg addGuardianWithThreshold(wallet, g, t) batch -> ${r0} (selector ${planIface.getFunction("addGuardianWithThreshold").selector} not in module code)`);
    expect(r0).to.equal("GS013");
    // Wrong order: threshold 2 on the first guardian.
    const wrong = [{ to: C.A.target, data: mi.encodeFunctionData("addGuardianWithThreshold", [K.P.address, 2]) }];
    const msIface = new ethers.Interface(["function multiSend(bytes)"]);
    const inner = await outcome(() => ethers.provider.call({ from: C.W.target, to: C.A.target, data: wrong[0].data }));
    ev(`addGuardianWithThreshold(P, 2) as first guardian (eth_call from W) -> ${inner}`);
    // Operation 0 (CALL) instead of DELEGATECALL: msg.sender at the module is MultiSendCallOnly, not W.
    const good = [[C.A, K.R, 1], [C.A, K.P, 2], [C.B, K.R, 1], [C.B, K.SQ, 2]].map(([m, g, t]) => ({ to: m.target, data: mi.encodeFunctionData("addGuardianWithThreshold", [g.address, t]) }));
    const payload = msIface.encodeFunctionData("multiSend", [multiSendPayload(good)]);
    const rCall = await outcome(() => safeTx(C.W, K.owner, { to: C.msco, data: payload, operation: 0 }));
    ev(`same batch with operation 0 (CALL) -> ${rCall}`);
    expect(rCall).to.equal("GS013");
    // Correct: v0.0.1 signature addGuardianWithThreshold(guardian, threshold), msg.sender = wallet, operation 1.
    const rc = await (await safeTx(C.W, K.owner, { to: C.msco, data: payload, operation: 1 })).wait();
    const thr = rc.logs.filter((l) => [C.A.target, C.B.target].includes(l.address)).map((l) => { const p = C.A.interface.parseLog(l); return p ? `${l.address === C.A.target ? "A" : "B"}.${p.name}(${p.args.map(String).slice(1).join(",")})` : null; });
    ev(`correct batch (operation 1) succeeded, gasUsed ${rc.gasUsed}; events: ${thr.join(" ")}`);
    const gA = await C.A.getGuardians(C.W.target), gB = await C.B.getGuardians(C.W.target);
    ev(`A guardians ${JSON.stringify(gA)} threshold ${await C.A.threshold(C.W.target)}; B guardians ${JSON.stringify(gB)} threshold ${await C.B.threshold(C.W.target)}`);
    expect([...gA]).to.have.members([K.R.address, K.P.address]);
    expect([...gB]).to.have.members([K.R.address, K.SQ.address]);
    expect(await C.A.threshold(C.W.target)).to.equal(2n);
    expect(await C.B.threshold(C.W.target)).to.equal(2n);
    expect(inner).to.equal("GS: threshold must be lower or equal to guardians count");
  });

  it("C4: recovery with off-chain EIP-712 guardian signatures, relayed; finalize; old owner GS026; cancel", async function () {
    const cid = await chainId();
    const n0 = await C.A.nonce(C.W.target);
    const domain = { name: "Social Recovery Module", version: "0.0.1", chainId: cid, verifyingContract: C.A.target };
    const value = { wallet: C.W.target, newOwners: [K.N.address], newThreshold: 1n, nonce: n0 };
    const local = ethers.TypedDataEncoder.hash(domain, RECOVERY_TYPES, value);
    const onchain = await C.A.getRecoveryHash(C.W.target, [K.N.address], 1, n0);
    ev(`local EIP-712 hash ${local} == module getRecoveryHash ${onchain} (chainId ${cid}, nonce ${n0})`);
    expect(local).to.equal(onchain);
    expect(ethers.TypedDataEncoder.hashDomain(domain)).to.equal(await C.A.domainSeparator());
    // Same formula against the LIVE Sepolia module (read-only eth_call stored in the fixture).
    const s = FX.calls.getRecoveryHash.args;
    const live = ethers.TypedDataEncoder.hash({ ...domain, chainId: 11155111n, verifyingContract: A_ADDR }, RECOVERY_TYPES, { wallet: s[0], newOwners: s[1], newThreshold: s[2], nonce: s[3] });
    ev(`Sepolia eth_call getRecoveryHash ${FX.calls.getRecoveryHash.result[0]} == local (chainId 11155111) ${live}`);
    expect(live).to.equal(FX.calls.getRecoveryHash.result[0]);

    const sigR = await K.R.signTypedData(domain, RECOVERY_TYPES, value);
    const sigP = await K.P.signTypedData(domain, RECOVERY_TYPES, value);
    const sorted = [{ signer: K.R.address, signature: sigR }, { signer: K.P.address, signature: sigP }].sort(byAddr);
    const desc = [...sorted].reverse();
    const A = C.A.connect(K.relayer);
    ev(`signature length ${ethers.dataLength(sigR)} bytes (r,s,v; v=${parseInt(sigR.slice(-2), 16)})`);
    const rDesc = await outcome(() => A.multiConfirmRecovery.staticCall(C.W.target, [K.N.address], 1, desc, true));
    ev(`descending signer order -> ${rDesc}`);
    expect(rDesc).to.equal("SM: duplicate signers/invalid ordering");
    const pers = await K.R.signMessage(ethers.getBytes(local)); // personal_sign over the hash: wrong
    const rPers = await outcome(() => A.multiConfirmRecovery.staticCall(C.W.target, [K.N.address], 1, [{ signer: K.R.address, signature: pers }], false));
    ev(`R signs the hash with personal_sign (EIP-191 prefix) -> ${rPers}`);
    expect(rPers).to.equal("SM: Invalid guardian signature");
    const rawSig = K.R.signingKey.sign(local).serialized; // raw digest signing (viem account.sign({hash})) is equivalent
    expect(rawSig).to.equal(sigR);

    const snapBefore = await network.provider.send("evm_snapshot");
    const rc = await (await A.multiConfirmRecovery(C.W.target, [K.N.address], 1, sorted, true)).wait();
    const t0 = (await ethers.provider.getBlock(rc.blockNumber)).timestamp;
    const exRaw = rc.logs.find((l) => l.address === C.A.target && l.topics[0] === C.A.interface.getEvent("RecoveryExecuted").topicHash);
    const exLog = { args: C.A.interface.parseLog(exRaw).args, topics: exRaw.topics };
    const ownersTopic = ethers.keccak256(ethers.concat([ethers.zeroPadValue(K.N.address, 32)]));
    const req = await C.A.getRecoveryRequest(C.W.target);
    ev(`relayer multiConfirmRecovery(execute=true) gasUsed ${rc.gasUsed}; getRecoveryRequest = {guardiansApprovalCount ${req.guardiansApprovalCount}, newThreshold ${req.newThreshold}, executeAfter ${req.executeAfter} (= block time + ${BigInt(req.executeAfter) - BigInt(t0)} s), newOwners ${JSON.stringify(req.newOwners)}}; nonce now ${await C.A.nonce(C.W.target)}`);
    ev(`RecoveryExecuted topics[2] (indexed address[] newOwners) = ${exLog.topics[2].slice(0, 18)}… = keccak of the list, not the list (keccak(abi.encode-in-place of [N]) = ${ownersTopic.slice(0, 18)}…, equal: ${exLog.topics[2] === ownersTopic}); data has newThreshold ${exLog.args.newThreshold}, nonce ${exLog.args.nonce}, executeAfter ${exLog.args.executeAfter}, approvals ${exLog.args.guardiansApprovalCount}`);
    expect(BigInt(req.executeAfter) - BigInt(t0)).to.equal(180n);
    const snapPending = await network.provider.send("evm_snapshot");
    const early = await outcome(() => A.finalizeRecovery(C.W.target));
    ev(`finalizeRecovery right away -> ${early}`);
    expect(early).to.equal("SM: recovery period still pending");
    await increase(180);
    const fin = await (await C.A.connect(K.out).finalizeRecovery(C.W.target)).wait();
    ev(`finalizeRecovery by an unrelated account after 180 s -> success, gasUsed ${fin.gasUsed}; owners ${JSON.stringify(await C.W.getOwners())}`);
    expect(await C.W.getOwners()).to.deep.equal([K.N.address]);
    const old = await outcome(() => safeTx(C.W, K.owner, { to: K.out.address, value: 1n }));
    ev(`transfer signed by the old owner -> ${old}`);
    expect(old).to.equal("GS026");
    const nw = await outcome(() => safeTx(C.W, K.N, { to: K.out.address, value: 1n }));
    expect(nw).to.equal(null);
    // Cancel path: back to the pending state, old owner cancels through a Safe transaction.
    await network.provider.send("evm_revert", [snapPending]);
    await (await safeTx(C.W, K.owner, { to: C.A.target, data: C.A.interface.encodeFunctionData("cancelRecovery") })).wait();
    const req2 = await C.A.getRecoveryRequest(C.W.target);
    ev(`old owner's Safe tx calling A.cancelRecovery() -> success; request {approvals ${req2.guardiansApprovalCount}, executeAfter ${req2.executeAfter}}; nonce ${await C.A.nonce(C.W.target)}`);
    await increase(200);
    const after = await outcome(() => A.finalizeRecovery(C.W.target));
    ev(`finalizeRecovery after cancel -> ${after}`);
    expect(after).to.equal("SM: no ongoing recovery");
    const replay = await outcome(() => A.multiConfirmRecovery.staticCall(C.W.target, [K.N.address], 1, sorted, true));
    ev(`replaying the same R+P signatures after cancel (nonce moved on) -> ${replay}`);
    expect(replay).to.equal("SM: Invalid guardian signature");
    await network.provider.send("evm_revert", [snapBefore]);
  });

  it("C5: module B = Sepolia module A byte-for-byte except the 32-byte wait and the metadata hash; deploy gas", async function () {
    const a = ethers.getBytes(FX.contracts.CandideRecovery3min.code), b = ethers.getBytes(await ethers.provider.getCode(C.B.target));
    expect(b.length).to.equal(a.length);
    const metaLen = ((a[a.length - 2] << 8) | a[a.length - 1]) + 2;
    const diffs = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(i);
    const outside = diffs.filter((i) => !(i >= IMMUTABLE_OFFSET && i < IMMUTABLE_OFFSET + 32) && !(i >= a.length - metaLen));
    ev(`runtime ${a.length} bytes; differing bytes ${diffs.length}, all inside [${IMMUTABLE_OFFSET},${IMMUTABLE_OFFSET + 32}) (wait) or the last ${metaLen} bytes (CBOR metadata): ${outside.length === 0}`);
    expect(outside.length).to.equal(0);
    const waitA = BigInt(ethers.hexlify(a.slice(IMMUTABLE_OFFSET, IMMUTABLE_OFFSET + 32))), waitB = BigInt(ethers.hexlify(b.slice(IMMUTABLE_OFFSET, IMMUTABLE_OFFSET + 32)));
    ev(`wait in code: A ${waitA} s, B ${waitB} s`);
    expect(waitA).to.equal(180n); expect(waitB).to.equal(300n);
    const ic = ethers.getBytes(C.Bdeploy.initcode); const z = ic.filter((x) => x === 0).length; const nz = ic.length - z;
    ev(`module B deployment: initcode ${ic.length} bytes (${nz} non-zero), gasUsed ${C.Bdeploy.gasUsed} on hardfork ${network.config.hardfork}; EIP-7623 floor = 21000 + 10*(${z} + 4*${nz}) = ${21000 + 10 * (z + 4 * nz)}`);
  });

  it("C6: relayer submits an owner-signed Safe tx (gasPrice 0, refundReceiver 0); any changed field -> GS026", async function () {
    const base = { to: K.out.address, value: ethers.parseEther("0.01"), data: "0x", operation: 0 };
    const mutations = { to: { to: K.relayer.address }, value: { value: ethers.parseEther("1") }, data: { data: "0x1234" }, operation: { operation: 1 },
      safeTxGas: { safeTxGas: 1n }, baseGas: { baseGas: 1n }, gasPrice: { gasPrice: 1n }, gasToken: { gasToken: K.relayer.address },
      refundReceiver: { refundReceiver: K.relayer.address } };
    const res = [];
    for (const [f, m] of Object.entries(mutations)) res.push(`${f}:${await outcome(() => safeTx(C.W, K.owner, base, { mutate: m }))}`);
    const n = await C.W.nonce();
    res.push(`nonce+1:${await outcome(() => safeTx(C.W, K.owner, { ...base, nonce: n + 1n }))}`);
    ev(`relayer changes one field -> ${res.join(" ")}`);
    for (const r of res) expect(r.split(":")[1]).to.equal("GS026");
    const bal0 = await ethers.provider.getBalance(K.out.address);
    const rc = await (await safeTx(C.W, K.owner, base)).wait();
    ev(`unchanged, submitted by relayer ${K.relayer.address.slice(0, 10)}… -> success, gasUsed ${rc.gasUsed}; recipient +${ethers.formatEther((await ethers.provider.getBalance(K.out.address)) - bal0)} ETH; relayer paid gas, Safe paid 0 refund`);
    const again = await outcome(() => safeTx(C.W, K.owner, { ...base, nonce: n }));
    ev(`replay of the same signed tx -> ${again}`);
    expect(again).to.equal("GS026");
  });

  it("C7: EIP-1271 for personal_sign and eth_signTypedData_v4 via CompatibilityFallbackHandler", async function () {
    const W1271 = new ethers.Contract(C.W.target, HandlerAbi, ethers.provider);
    const cid = await chainId();
    const safeDomain = { chainId: cid, verifyingContract: C.W.target };
    // personal_sign("Hello dApp"): dApp verifies isValidSignature(hashMessage(m), sig)
    const m = "Hello dApp";
    const h1 = ethers.hashMessage(m);
    const sig1 = await K.owner.signTypedData(safeDomain, SAFE_MSG_TYPES, { message: h1 });
    const safeMsgHash = ethers.TypedDataEncoder.hash(safeDomain, SAFE_MSG_TYPES, { message: h1 });
    expect(await W1271.getMessageHash(h1)).to.equal(safeMsgHash);
    const v1 = await W1271["isValidSignature(bytes32,bytes)"](h1, sig1);
    ev(`personal_sign: owner signs SafeMessage{message: hashMessage(m)} = ${safeMsgHash.slice(0, 18)}… ; W.isValidSignature(bytes32) -> ${v1}`);
    expect(v1).to.equal("0x1626ba7e");
    // eth_signTypedData_v4: dApp hashes its typed data, wallet signs SafeMessage{message: thatHash}
    const td = { domain: { name: "Demo dApp", version: "1", chainId: cid, verifyingContract: K.out.address },
      types: { Order: [{ name: "maker", type: "address" }, { name: "amount", type: "uint256" }] }, value: { maker: C.W.target, amount: 5n } };
    const h2 = ethers.TypedDataEncoder.hash(td.domain, td.types, td.value);
    const sig2 = await K.owner.signTypedData(safeDomain, SAFE_MSG_TYPES, { message: h2 });
    const v2 = await W1271["isValidSignature(bytes32,bytes)"](h2, sig2);
    ev(`eth_signTypedData_v4: W.isValidSignature(bytes32 typedDataHash) -> ${v2}`);
    expect(v2).to.equal("0x1626ba7e");
    // legacy bytes variant: message = raw bytes, returns 0x20c13b0b
    const raw = ethers.toUtf8Bytes(m);
    const sig3 = await K.owner.signTypedData(safeDomain, SAFE_MSG_TYPES, { message: raw });
    const v3 = await W1271["isValidSignature(bytes,bytes)"](raw, sig3);
    ev(`legacy isValidSignature(bytes data, bytes sig) with SafeMessage{message: data} -> ${v3}`);
    expect(v3).to.equal("0x20c13b0b");
    // Pitfalls: an EOA-style signature of the dApp hash is not accepted; ecrecover never yields the wallet address.
    const eoa = await K.owner.signMessage(m);
    const bad = await outcome(() => W1271["isValidSignature(bytes32,bytes)"](h1, eoa));
    ev(`owner's plain personal_sign signature checked via W.isValidSignature -> ${bad}; ecrecover gives ${ethers.verifyMessage(m, eoa).slice(0, 10)}… (owner EOA), never W`);
    expect(bad).to.equal("GS026");
  });

  it("Extra: one-transaction creation with guardians inside setup (MultiSend v1.4.1 delegatecall) commits guardians to the address", async function () {
    const smsIface = new ethers.Interface(["function enableModules(address[] modules)"]);
    const msIface = new ethers.Interface(["function multiSend(bytes)"]);
    const mi = C.A.interface;
    const calls = [{ operation: 1, to: C.sms, data: smsIface.encodeFunctionData("enableModules", [[C.A.target, C.B.target]]) },
      ...[[C.A, K.R, 1], [C.A, K.P, 2], [C.B, K.R, 1], [C.B, K.SQ, 2]].map(([m, g, t]) => ({ to: m.target, data: mi.encodeFunctionData("addGuardianWithThreshold", [g.address, t]) }))];
    const mk = (cs) => C.singleton.interface.encodeFunctionData("setup", [[K.owner.address], 1, C.ms, msIface.encodeFunctionData("multiSend", [multiSendPayload(cs)]), C.handler.target, ZERO, 0, ZERO]);
    const init = mk(calls);
    const addr = await C.factory.createProxyWithNonce.staticCall(C.singleton.target, init, 7n);
    const rc = await (await C.factory.connect(K.relayer).createProxyWithNonce(C.singleton.target, init, 7n)).wait();
    ev(`createProxyWithNonce with setup(to=MultiSend, delegatecall) gasUsed ${rc.gasUsed}; wallet ${addr}`);
    expect([...(await C.A.getGuardians(addr))]).to.have.members([K.R.address, K.P.address]);
    expect([...(await C.B.getGuardians(addr))]).to.have.members([K.R.address, K.SQ.address]);
    expect(await C.A.threshold(addr)).to.equal(2n); expect(await C.B.threshold(addr)).to.equal(2n);
    const weak = [...calls]; weak[2] = { to: C.A.target, data: mi.encodeFunctionData("addGuardianWithThreshold", [K.P.address, 1]) };
    const weakAddr = await C.factory.createProxyWithNonce.staticCall(C.singleton.target, mk(weak), 7n);
    ev(`guardians {R,P} 2-of-2 on A and {R,SQ} on B set at creation; a weak variant (A threshold 1) lands at ${weakAddr} != ${addr}`);
    expect(weakAddr).to.not.equal(addr);
    const viaCallOnly = await outcome(() => C.factory.createProxyWithNonce.staticCall(C.singleton.target,
      C.singleton.interface.encodeFunctionData("setup", [[K.owner.address], 1, C.msco, msIface.encodeFunctionData("multiSend", [multiSendPayload(calls)]), C.handler.target, ZERO, 0, ZERO]), 8n));
    ev(`same with MultiSendCallOnly (cannot delegatecall SafeModuleSetup) -> ${viaCallOnly}`);
  });

  it("C8: abstractionkit SocialRecoveryModule helper matches v0.0.1 (selectors, EIP-712 data, signer sorting) end-to-end", async function () {
    const path = require("path"), fs = require("fs");
    const AK = path.resolve(__dirname, "../vendor/abstractionkit/package/dist/index.cjs");
    if (!fs.existsSync(AK)) { console.log("      abstractionkit tarball not unpacked; skipped"); this.skip(); }
    const ak = require(AK);
    const pkg = require(path.resolve(AK, "../../package.json"));
    const src = fs.readFileSync(AK, "utf8");
    const region = src.slice(src.indexOf("var SocialRecoveryModule = class"), src.indexOf("const EXECUTE_RECOVERY_PRIMARY_TYPE"));
    const sels = [...new Set([...region.matchAll(/(?:createCallData\(|data: )"(0x[0-9a-f]{8})"/g)].map((x) => x[1]))];
    const names = sels.map((sl) => { const f = C.A.interface.getFunction(sl); return f ? f.name : "MISSING:" + sl; });
    ev(`abstractionkit ${pkg.version}: ${sels.length} selectors used by SocialRecoveryModule -> ${names.join(",")}`);
    expect(names.filter((n) => n.startsWith("MISSING")).length).to.equal(0);
    ev(`default module address ${ak.SocialRecoveryModule.DEFAULT_SOCIAL_RECOVERY_ADDRESS} (3 days); After3Minutes = ${ak.SocialRecoveryModuleGracePeriodSelector.After3Minutes}`);
    expect(ak.SocialRecoveryModuleGracePeriodSelector.After3Minutes).to.equal(A_ADDR);
    const m = new ak.SocialRecoveryModule(C.A.target);
    expect(m.createAddGuardianWithThresholdMetaTransaction(K.R.address, 1n).data).to.equal(C.A.interface.encodeFunctionData("addGuardianWithThreshold", [K.R.address, 1]));
    const snap = await network.provider.send("evm_snapshot");
    const n0 = await C.A.nonce(C.W.target);
    const td = await m.getRecoveryRequestEip712Data("http://unused.invalid", await chainId(), C.W.target, [K.N.address], 1n, { recoveryNonce: n0 });
    const h = ethers.TypedDataEncoder.hash(td.domain, td.types, td.messageValue);
    expect(h).to.equal(await C.A.getRecoveryHash(C.W.target, [K.N.address], 1, n0));
    const pairs = [];
    for (const g of [K.R, K.P]) pairs.push({ signer: g.address, signature: await g.signTypedData(td.domain, td.types, td.messageValue) });
    const desc = pairs.sort(byAddr).reverse(); // deliberately wrong order; the helper sorts by BigInt(signer)
    const mt = m.createMultiConfirmRecoveryMetaTransaction(C.W.target, [K.N.address], 1n, desc, true);
    const rc = await (await K.relayer.sendTransaction({ to: mt.to, data: mt.data })).wait();
    const req = await C.A.getRecoveryRequest(C.W.target);
    ev(`helper EIP-712 data hash == getRecoveryHash; helper-built multiConfirmRecovery (signers passed descending) -> success gasUsed ${rc.gasUsed}, executeAfter ${req.executeAfter}`);
    expect(req.executeAfter).to.be.gt(0n);
    await network.provider.send("evm_revert", [snap]);
  });

  it("C9: §7.5 attack P+SQ via eth_call; execute=false is harmless; §7.4 T10 nonce bump / disableModule keep the request", async function () {
    const cid = await chainId();
    const sign = async (mod, signers) => {
      const n = await mod.nonce(C.W.target);
      const d = { name: "Social Recovery Module", version: "0.0.1", chainId: cid, verifyingContract: mod.target };
      const v = { wallet: C.W.target, newOwners: [K.N.address], newThreshold: 1n, nonce: n };
      const out = [];
      for (const sg of signers) out.push({ signer: sg.address, signature: await sg.signTypedData(d, RECOVERY_TYPES, v) });
      return out.sort(byAddr);
    };
    for (const [name, mod] of [["A", C.A], ["B", C.B]]) {
      const sigs = await sign(mod, [K.P, K.SQ]);
      const r = await outcome(() => mod.connect(K.relayer).multiConfirmRecovery.staticCall(C.W.target, [K.N.address], 1, sigs, true));
      ev(`attack on module ${name}: P+SQ multiConfirmRecovery as eth_call -> ${r}`);
      expect(r).to.equal("SM: Signer not a guardian");
    }
    const snap = await network.provider.send("evm_snapshot");
    const sigsRP = await sign(C.A, [K.R, K.P]);
    await (await C.A.connect(K.relayer).multiConfirmRecovery(C.W.target, [K.N.address], 1, sigsRP, false)).wait();
    const r0 = await C.A.getRecoveryRequest(C.W.target);
    await (await C.A.connect(K.out).executeRecovery(C.W.target, [K.N.address], 1)).wait();
    const r1 = await C.A.getRecoveryRequest(C.W.target);
    ev(`relayer sends execute=false -> executeAfter ${r0.executeAfter}; then any account calls executeRecovery -> executeAfter ${r1.executeAfter} (flag not signed, but harmless)`);
    expect(r1.executeAfter).to.be.gt(0n);
    await (await safeTx(C.W, K.owner, { to: C.A.target, data: C.A.interface.encodeFunctionData("invalidateNonce") })).wait();
    const rN = await C.A.getRecoveryRequest(C.W.target);
    ev(`owner's invalidateNonce() -> nonce ${await C.A.nonce(C.W.target)}, request executeAfter ${rN.executeAfter} (still pending)`);
    expect(rN.executeAfter).to.equal(r1.executeAfter);
    const [mods] = await C.W.getModulesPaginated(SENTINEL, 10);
    const prev = mods.indexOf(C.A.target) === 0 ? SENTINEL : mods[mods.indexOf(C.A.target) - 1];
    await (await safeTx(C.W, K.owner, { to: C.W.target, data: C.W.interface.encodeFunctionData("disableModule", [prev, C.A.target]) })).wait();
    await increase(181);
    const dis = await outcome(() => C.A.connect(K.out).finalizeRecovery(C.W.target));
    ev(`module A disabled, wait over: finalizeRecovery -> ${dis}; request executeAfter still ${(await C.A.getRecoveryRequest(C.W.target)).executeAfter}`);
    expect(dis).to.not.equal(null);
    await (await safeTx(C.W, K.owner, { to: C.W.target, data: C.W.interface.encodeFunctionData("enableModule", [C.A.target]) })).wait();
    await (await C.A.connect(K.out).finalizeRecovery(C.W.target)).wait();
    ev(`module A re-enabled -> the old request finalizes: owners ${JSON.stringify(await C.W.getOwners())}`);
    expect(await C.W.getOwners()).to.deep.equal([K.N.address]);
    await network.provider.send("evm_revert", [snap]);
  });
});
