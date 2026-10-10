// T8: red-team "Required changes" item 3, an untested composition. X is replaced by TWO SocialRecoveryModule
// instances enabled on the same user Safe (owner Ph, threshold 1), built fresh in every test:
//   instance A: recoveryPeriod  60 s, guardians {R, P},  guardian threshold 2
//   instance B: recoveryPeriod 120 s, guardians {R, SQ}, guardian threshold 2
// Intended policy: R AND (P OR SQ), owner can cancel during the wait.
// Names: k.A is the ATTACKER key from helpers; the module instances are called mA and mB here.
const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const h = require("./helpers");

const PERIOD_A = 60n;
const PERIOD_B = 120n;
const SALT = 8n;
const MSG_THRESHOLD = "SM: confirmed signatures less than threshold";
const RUNS = Number(process.env.T8_RUNS || 100);
const STEPS = Number(process.env.T8_STEPS || 40);
const SEED = Number(process.env.T8_SEED || 20261010);
const CONTROL_RUNS = Number(process.env.T8_CONTROL_RUNS || 50);
const GUARD_SLOT = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));
const HANDLER_SLOT = ethers.keccak256(ethers.toUtf8Bytes("fallback_manager.handler.address"));

// guardiansA(k) lets the property-test control use a weak instance A.
async function build({ guardiansA } = {}) {
  const ctx = await h.loadWorld();
  const { k } = ctx;
  const F = await ethers.getContractFactory("SocialRecoveryModule", k.relayer);
  const mA = await (await F.deploy(PERIOD_A)).waitForDeployment();
  const mB = await (await F.deploy(PERIOD_B)).waitForDeployment();
  const W = await h.createSafe(ctx, [k.Ph.address], 1, SALT);
  const gA = guardiansA ? guardiansA(k) : [k.R.address, k.P.address];
  const gB = [k.R.address, k.SQ.address];
  for (const [m, g] of [[mA, gA], [mB, gB]]) {
    await (await h.execSafe(W, [k.Ph], W.target, W.interface.encodeFunctionData("enableModule", [m.target]))).wait();
    await (await h.execSafe(W, [k.Ph], m.target, m.interface.encodeFunctionData("addGuardianWithThreshold", [g[0], 1]))).wait();
    await (await h.execSafe(W, [k.Ph], m.target, m.interface.encodeFunctionData("addGuardianWithThreshold", [g[1], 2]))).wait();
  }
  await h.fund(W.target, "10");
  return { ctx, k, W, mA, mB };
}

const eoaEntry = (key, hash) => ({ signer: key.address, signature: h.eoaSig(key, hash) });
const hashFor = async (m, W, owners, thr = 1) => m.getRecoveryHash(W.target, owners, thr, await m.nonce(W.target));
async function approve(m, W, keys, owners, sender, execute) {
  const hash = await hashFor(m, W, owners);
  const entries = h.sortByAddr(keys.map((kk) => eoaEntry(kk, hash)), (e) => e.signer);
  return m.connect(sender).multiConfirmRecovery(W.target, owners, 1, entries, execute);
}
const multi = (m, W, owners, entries, sender, execute = true) =>
  m.connect(sender).multiConfirmRecovery(W.target, owners, 1, h.sortByAddr(entries, (e) => e.signer), execute);
async function prevG(m, W, g) {
  const list = await m.getGuardians(W.target);
  const i = list.findIndex((x) => x.toLowerCase() === g.toLowerCase());
  return i === 0 ? h.SENTINEL : list[i - 1];
}
const fmtReq = (r) => `{approvals ${r.guardiansApprovalCount}, executeAfter ${r.executeAfter}, newOwners [${[...r.newOwners].join(",")}]}`;
const owners = async (W) => [...(await W.getOwners())];
const fin = (m, W, sender) => m.connect(sender).finalizeRecovery(W.target, { gasLimit: 1_000_000 });
const cancelData = (m) => m.interface.encodeFunctionData("cancelRecovery", []);

// Request on A whose newOwners = [P]; P is a guardian of A, so finalize always reverts and the request stays.
async function makeStuck(t) {
  const { k, W, mA } = t;
  await h.expectSuccess("A: multiConfirmRecovery(W,[P],1,[R sig, P sig],execute=true) by relayer", () =>
    approve(mA, W, [k.R, k.P], [k.P.address], k.relayer, true));
  const req = await mA.getRecoveryRequest(W.target);
  expect(req.guardiansApprovalCount).to.equal(2n);
  await network.provider.send("evm_setNextBlockTimestamp", [Number(req.executeAfter)]);
  await h.expectRevert("A: finalizeRecovery(W) at executeAfter, by an outsider", () => fin(mA, W, k.O), "SM: new owner cannot be guardian");
  return req;
}

describe("T8 two module instances instead of X: A {R,P} 60 s and B {R,SQ} 120 s (red-team change 3)", function () {
  it("T8a P + SQ (plus attacker/outsider/relayer) cannot recover on either instance", async function () {
    const { k, W, mA, mB } = await build();
    console.log(`      evidence: setup: W owners [${await owners(W)}]; modules [${[...(await W.getModulesPaginated(h.SENTINEL, 10))[0]]}]; A guardians [${[...(await mA.getGuardians(W.target))]}] thr ${await mA.threshold(W.target)}; B guardians [${[...(await mB.getGuardians(W.target))]}] thr ${await mB.threshold(W.target)}`);
    expect(h.sameSet(await mA.getGuardians(W.target), [k.R.address, k.P.address])).to.equal(true);
    expect(h.sameSet(await mB.getGuardians(W.target), [k.R.address, k.SQ.address])).to.equal(true);
    const o = [k.A.address];
    const hA = await hashFor(mA, W, o);
    const hB = await hashFor(mB, W, o);
    await h.expectSuccess("A: P confirmRecovery(W,[attacker],1,false)", () => mA.connect(k.P).confirmRecovery(W.target, o, 1, false));
    await h.expectSuccess("B: SQ confirmRecovery(W,[attacker],1,false)", () => mB.connect(k.SQ).confirmRecovery(W.target, o, 1, false));
    // Instance A (guardians R, P)
    await h.expectRevert("A: SQ confirmRecovery(W,[attacker],1,true)", () => mA.connect(k.SQ).confirmRecovery(W.target, o, 1, true), "SM: sender not a guardian");
    await h.expectRevert("A: executeRecovery(W,[attacker],1) by SQ after P's approval", () => mA.connect(k.SQ).executeRecovery(W.target, o, 1), MSG_THRESHOLD);
    await h.expectRevert("A: P confirmRecovery(W,[attacker],1,true)", () => mA.connect(k.P).confirmRecovery(W.target, o, 1, true), MSG_THRESHOLD);
    await h.expectRevert("A: multiConfirmRecovery([P sig, SQ sig], execute=true)", () =>
      multi(mA, W, o, [eoaEntry(k.P, hA), eoaEntry(k.SQ, hA)], k.A), "SM: Signer not a guardian");
    await h.expectRevert("A: multiConfirmRecovery([P sig, 'R' sig made by SQ], execute=true)", () =>
      multi(mA, W, o, [eoaEntry(k.P, hA), { signer: k.R.address, signature: h.eoaSig(k.SQ, hA) }], k.A), "SM: Invalid guardian signature");
    await h.expectRevert("A: multiConfirmRecovery([P sig, R entry with empty signature]) sent by P", () =>
      multi(mA, W, o, [eoaEntry(k.P, hA), { signer: k.R.address, signature: "0x" }], k.P), "SM: null signature should have the signer as the sender");
    await h.expectRevert("A: P's signature made for B's recovery hash, submitted to A", () =>
      multi(mA, W, o, [eoaEntry(k.P, hB)], k.A), "SM: Invalid guardian signature");
    // Instance B (guardians R, SQ)
    await h.expectRevert("B: P confirmRecovery(W,[attacker],1,true)", () => mB.connect(k.P).confirmRecovery(W.target, o, 1, true), "SM: sender not a guardian");
    await h.expectRevert("B: executeRecovery(W,[attacker],1) by P after SQ's approval", () => mB.connect(k.P).executeRecovery(W.target, o, 1), MSG_THRESHOLD);
    await h.expectRevert("B: SQ confirmRecovery(W,[attacker],1,true)", () => mB.connect(k.SQ).confirmRecovery(W.target, o, 1, true), MSG_THRESHOLD);
    await h.expectRevert("B: multiConfirmRecovery([P sig, SQ sig], execute=true)", () =>
      multi(mB, W, o, [eoaEntry(k.P, hB), eoaEntry(k.SQ, hB)], k.A), "SM: Signer not a guardian");
    await h.expectRevert("B: multiConfirmRecovery([SQ sig, 'R' sig made by P], execute=true)", () =>
      multi(mB, W, o, [eoaEntry(k.SQ, hB), { signer: k.R.address, signature: h.eoaSig(k.P, hB) }], k.A), "SM: Invalid guardian signature");
    await h.expectRevert("B: SQ's signature made for A's recovery hash, submitted to B", () =>
      multi(mB, W, o, [eoaEntry(k.SQ, hA)], k.A), "SM: Invalid guardian signature");
    // Changing the guardian set needs W itself.
    await h.expectRevert("A: P calls addGuardianWithThreshold(SQ,1) directly", () => mA.connect(k.P).addGuardianWithThreshold(k.SQ.address, 1), "revert without reason");
    await h.expectRevert("W.execTransaction signed by P + SQ -> A.addGuardianWithThreshold(SQ,1)", () =>
      h.execSafe(W, [k.P, k.SQ], mA.target, mA.interface.encodeFunctionData("addGuardianWithThreshold", [k.SQ.address, 1]), { sender: k.relayer }), "GS026");
    await h.expectRevert("A: finalizeRecovery(W)", () => fin(mA, W, k.SQ), "SM: no ongoing recovery");
    await h.expectRevert("B: finalizeRecovery(W)", () => fin(mB, W, k.P), "SM: no ongoing recovery");
    const nA = await mA.getRecoveryApprovals(W.target, o, 1);
    const nB = await mB.getRecoveryApprovals(W.target, o, 1);
    console.log(`      evidence: approvals for [attacker]: A ${nA} of 2, B ${nB} of 2; W owners [${await owners(W)}]`);
    expect([nA, nB]).to.deep.equal([1n, 1n]);
    expect(await owners(W)).to.deep.equal([k.Ph.address]);
  });

  for (const route of [{ inst: "A", g2: "P", period: PERIOD_A }, { inst: "B", g2: "SQ", period: PERIOD_B }]) {
    it(`T8b R + ${route.g2} recover on instance ${route.inst}: owner changes only after ${route.period} s; old Ph -> GS026`, async function () {
      const { k, W, mA, mB } = await build();
      const m = route.inst === "A" ? mA : mB;
      const other = route.inst === "A" ? mB : mA;
      const o = [k.N.address];
      await h.expectSuccess(`${route.inst}: multiConfirmRecovery(W,[newKey],1,[R sig, ${route.g2} sig],execute=false) by relayer`, () =>
        approve(m, W, [k.R, k[route.g2]], o, k.relayer, false));
      expect(await m.getRecoveryApprovals(W.target, o, 1)).to.equal(2n);
      await h.expectSuccess(`${route.inst}: executeRecovery(W,[newKey],1) by relayer`, () => m.connect(k.relayer).executeRecovery(W.target, o, 1));
      const t0 = BigInt((await ethers.provider.getBlock("latest")).timestamp);
      const req = await m.getRecoveryRequest(W.target);
      console.log(`      evidence: ${route.inst}: executeAfter - execute block time = ${req.executeAfter - t0} s`);
      expect(req.executeAfter - t0).to.equal(route.period);
      await network.provider.send("evm_setNextBlockTimestamp", [Number(req.executeAfter) - 1]);
      await h.expectRevert(`${route.inst}: finalizeRecovery(W) at executeAfter-1`, () => fin(m, W, k.relayer), "SM: recovery period still pending");
      expect(await owners(W)).to.deep.equal([k.Ph.address]);
      await network.provider.send("evm_setNextBlockTimestamp", [Number(req.executeAfter)]);
      await h.expectSuccess(`${route.inst}: finalizeRecovery(W) at executeAfter by an unrelated outsider`, () => fin(m, W, k.O));
      console.log(`      evidence: W.getOwners() = [${await owners(W)}] (newKey ${k.N.address}), threshold ${await W.getThreshold()}`);
      expect(await owners(W)).to.deep.equal(o);
      expect(await W.getThreshold()).to.equal(1n);
      await h.expectRevert("W.execTransaction signed by OLD Ph (send 1 ETH)", () =>
        h.execSafe(W, [k.Ph], k.Ph.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }), "GS026");
      await h.expectSuccess("W.execTransaction signed by newKey (send 1 ETH)", () =>
        h.execSafe(W, [k.N], k.O.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }));
      console.log(`      evidence: other instance still enabled: ${await W.isModuleEnabled(other.target)}, pending request there: ${(await other.getRecoveryRequest(W.target)).executeAfter !== 0n}`);
    });
  }

  it("T8c stuck request on A (newOwners = [P], a guardian of A): finalize reverts; A cannot replace it with 2 approvals", async function () {
    const t = await build();
    const { k, W, mA } = t;
    const req = await makeStuck(t);
    const still = await mA.getRecoveryRequest(W.target);
    console.log(`      evidence: A request still stored after the failed finalize: ${fmtReq(still)}`);
    expect(still.executeAfter).to.equal(req.executeAfter);
    const good = [k.N.address];
    await h.expectSuccess("A: R + P confirm the corrected request [newKey] at A's new nonce (execute=false)", () =>
      approve(mA, W, [k.R, k.P], good, k.relayer, false));
    console.log(`      evidence: A approvals for [newKey] = ${await mA.getRecoveryApprovals(W.target, good, 1)} (A has only 2 guardians)`);
    await h.expectRevert("A: executeRecovery(W,[newKey],1) to replace the stuck request", () =>
      mA.connect(k.relayer).executeRecovery(W.target, good, 1), "SM: not enough approvals for replacement");
    await h.expectRevert("A: multiConfirmRecovery(W,[newKey],1,[R,P],execute=true) to replace it", () =>
      approve(mA, W, [k.R, k.P], good, k.relayer, true), "SM: not enough approvals for replacement");
    await h.increaseTime(7 * 24 * 3600);
    await h.expectRevert("A: finalizeRecovery(W) one week later", () => fin(mA, W, k.O), "SM: new owner cannot be guardian");
    expect(await owners(W)).to.deep.equal([k.Ph.address]);
  });

  it("T8d rescue via B: R + SQ recover on B to newKey; newKey cancels A's stuck request through W (and why cancel, not guardian removal)", async function () {
    const t = await build();
    const { k, W, mA, mB } = t;
    await makeStuck(t);
    const o = [k.N.address];
    await h.expectSuccess("B: multiConfirmRecovery(W,[newKey],1,[R sig, SQ sig],execute=true)", () => approve(mB, W, [k.R, k.SQ], o, k.relayer, true));
    const rB = await mB.getRecoveryRequest(W.target);
    await network.provider.send("evm_setNextBlockTimestamp", [Number(rB.executeAfter)]);
    await h.expectSuccess("B: finalizeRecovery(W) at executeAfter by an outsider", () => fin(mB, W, k.O));
    expect(await owners(W)).to.deep.equal(o);
    const rA = await mA.getRecoveryRequest(W.target);
    console.log(`      evidence: after the rescue W owners [${await owners(W)}]; A's stale request ${fmtReq(rA)}`);
    expect(rA.executeAfter).to.not.equal(0n);
    await h.expectRevert("A: finalizeRecovery(W) after the rescue, before any cancel", () => fin(mA, W, k.O), "SM: new owner cannot be guardian");

    // Hazard check (snapshot, reverted): removing P from A's guardians instead of cancelling un-sticks the request.
    const snap = await network.provider.send("evm_snapshot");
    await h.expectSuccess("hazard: W[signed newKey] -> A.revokeGuardianWithThreshold(prev, P, 1) WITHOUT cancelling first", async () =>
      h.execSafe(W, [k.N], mA.target, mA.interface.encodeFunctionData("revokeGuardianWithThreshold", [await prevG(mA, W, k.P.address), k.P.address, 1]), { sender: k.relayer }));
    await h.expectSuccess("hazard: outsider calls A.finalizeRecovery(W)", () => fin(mA, W, k.O));
    console.log(`      evidence: hazard: W owners now [${await owners(W)}] (P = ${k.P.address})`);
    expect(await owners(W)).to.deep.equal([k.P.address]);
    await network.provider.send("evm_revert", [snap]);
    expect(await owners(W)).to.deep.equal(o);

    await h.expectSuccess("W.execTransaction[signed newKey] -> A.cancelRecovery()", () =>
      h.execSafe(W, [k.N], mA.target, cancelData(mA), { sender: k.relayer }));
    const rA2 = await mA.getRecoveryRequest(W.target);
    console.log(`      evidence: A.getRecoveryRequest(W) after cancel: ${fmtReq(rA2)}`);
    expect(rA2.executeAfter).to.equal(0n);
    expect(rA2.guardiansApprovalCount).to.equal(0n);
    expect([...rA2.newOwners]).to.deep.equal([]);
    await h.expectRevert("A: finalizeRecovery(W) after cancel", () => fin(mA, W, k.O), "SM: no ongoing recovery");
    expect(await owners(W)).to.deep.equal(o);
  });

  it("T8e race, same start: A's request (60 s) finalizes first, but B's (120 s) still finalizes later and overwrites it unless A's new owner cancels B", async function () {
    const { k, W, mA, mB } = await build();
    const NA = k.N;
    const NB = h.key("t8/newKeyB");
    await h.fund(NB.address);
    await h.expectSuccess("A: R + P confirm [NA] (execute=false)", () => approve(mA, W, [k.R, k.P], [NA.address], k.relayer, false));
    await h.expectSuccess("B: R + SQ confirm [NB] (execute=false)", () => approve(mB, W, [k.R, k.SQ], [NB.address], k.relayer, false));
    await h.expectSuccess("A: executeRecovery(W,[NA],1)", () => mA.connect(k.relayer).executeRecovery(W.target, [NA.address], 1));
    await h.expectSuccess("B: executeRecovery(W,[NB],1) (next block)", () => mB.connect(k.relayer).executeRecovery(W.target, [NB.address], 1));
    const rA = await mA.getRecoveryRequest(W.target);
    const rB = await mB.getRecoveryRequest(W.target);
    console.log(`      evidence: pending: A ${fmtReq(rA)}; B ${fmtReq(rB)}`);
    expect(rA.executeAfter < rB.executeAfter).to.equal(true);
    await h.expectRevert("NA signs W -> B.cancelRecovery() before A is finalized (NA is not an owner yet)", () =>
      h.execSafe(W, [NA], mB.target, cancelData(mB), { sender: k.relayer }), "GS026");
    await network.provider.send("evm_setNextBlockTimestamp", [Number(rA.executeAfter)]);
    await h.expectSuccess("A: finalizeRecovery(W) at A's executeAfter", () => fin(mA, W, k.O));
    expect(await owners(W)).to.deep.equal([NA.address]);
    await h.expectRevert("B: finalizeRecovery(W) right after A's finalize", () => fin(mB, W, k.O), "SM: recovery period still pending");

    const snap = await network.provider.send("evm_snapshot");
    // (e1) NA does nothing.
    await network.provider.send("evm_setNextBlockTimestamp", [Number(rB.executeAfter)]);
    await h.expectSuccess("e1 (NA does nothing): B: finalizeRecovery(W) at B's executeAfter by an outsider", () => fin(mB, W, k.O));
    console.log(`      evidence: e1: W owners [${await owners(W)}] (NB = ${NB.address}, NA = ${NA.address})`);
    expect(await owners(W)).to.deep.equal([NB.address]);
    await h.expectRevert("e1: NA signs a transfer", () =>
      h.execSafe(W, [NA], NA.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }), "GS026");
    await network.provider.send("evm_revert", [snap]);

    // (e2) NA cancels B's request during B's wait.
    const tNow = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    console.log(`      evidence: e2: chain time after revert ${tNow} < B executeAfter ${rB.executeAfter}: ${tNow < rB.executeAfter}`);
    await h.expectSuccess("e2: W.execTransaction[signed NA] -> B.cancelRecovery() during B's wait", () =>
      h.execSafe(W, [NA], mB.target, cancelData(mB), { sender: k.relayer }));
    await network.provider.send("evm_setNextBlockTimestamp", [Number(rB.executeAfter) + 1]);
    await h.expectRevert("e2: B: finalizeRecovery(W) after B's executeAfter", () => fin(mB, W, k.O), "SM: no ongoing recovery");
    expect(await owners(W)).to.deep.equal([NA.address]);
  });

  it("T8e2 race, B started 70 s earlier: B matures first (t+120 < t+130); A then finalizes and overwrites unless B's new owner cancels A", async function () {
    const { k, W, mA, mB } = await build();
    const NA = k.N;
    const NB = h.key("t8/newKeyB");
    await h.fund(NB.address);
    await h.expectSuccess("B: R + SQ confirm and execute [NB]", () => approve(mB, W, [k.R, k.SQ], [NB.address], k.relayer, true));
    await h.increaseTime(70);
    await h.expectSuccess("A: R + P confirm and execute [NA], 70 s later", () => approve(mA, W, [k.R, k.P], [NA.address], k.relayer, true));
    const rA = await mA.getRecoveryRequest(W.target);
    const rB = await mB.getRecoveryRequest(W.target);
    console.log(`      evidence: executeAfter: B ${rB.executeAfter} < A ${rA.executeAfter}: ${rB.executeAfter < rA.executeAfter}`);
    expect(rB.executeAfter < rA.executeAfter).to.equal(true);
    await network.provider.send("evm_setNextBlockTimestamp", [Number(rB.executeAfter)]);
    await h.expectSuccess("B: finalizeRecovery(W) at B's executeAfter", () => fin(mB, W, k.O));
    expect(await owners(W)).to.deep.equal([NB.address]);
    await h.expectRevert("A: finalizeRecovery(W) at that moment", () => fin(mA, W, k.O), "SM: recovery period still pending");
    await network.provider.send("evm_setNextBlockTimestamp", [Number(rA.executeAfter)]);
    await h.expectSuccess("A: finalizeRecovery(W) at A's executeAfter (nobody cancelled)", () => fin(mA, W, k.O));
    console.log(`      evidence: W owners [${await owners(W)}] (NA = ${NA.address}): the request finalized LAST decides`);
    expect(await owners(W)).to.deep.equal([NA.address]);
  });

  // ---------- (f) randomised property test ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function campaign(kind, runs, seed) {
    const t = await build(kind === "control" ? { guardiansA: (k) => [k.P.address, k.SQ.address] } : {});
    const { k, W, mA, mB } = t;
    const mods = [mA, mB];
    const p = ethers.provider;
    const snapshotOf = async () => JSON.stringify({
      modules: [...(await W.getModulesPaginated(h.SENTINEL, 10))[0]],
      gA: [...(await mA.getGuardians(W.target))], gB: [...(await mB.getGuardians(W.target))],
      tA: String(await mA.threshold(W.target)), tB: String(await mB.threshold(W.target)),
      guard: await p.getStorage(W.target, GUARD_SLOT), handler: await p.getStorage(W.target, HANDLER_SLOT),
    });
    const configBefore = await snapshotOf();
    let snap = await network.provider.send("evm_snapshot");
    const stats = { runs: 0, steps: 0, actions: {}, reasons: {}, singleApprovalSteps: { A: 0, B: 0 }, violations: [] };
    for (let run = 0; run < runs; run++) {
      if (run > 0) {
        await network.provider.send("evm_revert", [snap]);
        snap = await network.provider.send("evm_snapshot");
      }
      const rnd = mulberry32(seed + run * 7919);
      const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
      const O = new ethers.Wallet(ethers.id(`t8-outsider/${seed}/${run}`), p); // fresh outsider per run, reproducible
      await h.fund(O.address);
      const eoas = [k.P, k.SQ, k.A, O, k.relayer];
      const ownerPool = [[k.A.address], [k.A.address, k.P.address], [k.SQ.address], [k.P.address], [O.address]];
      const choose = () => ({ owners: pick(ownerPool), thr: rnd() < 0.85 ? 1 : pick([0, 2, 3]) });
      const pickM = () => (rnd() < 0.5 ? 0 : 1);
      const bytes = (n) => ethers.hexlify(Uint8Array.from({ length: n }, () => Math.floor(rnd() * 256)));
      const sigEntry = async (mi, o, thr) => {
        const m = mods[mi];
        const other = mods[1 - mi];
        const hash = await m.getRecoveryHash(W.target, o, thr, await m.nonce(W.target));
        const kind2 = pick(["P", "SQ", "P", "SQ", "P", "SQ", "O", "A", "R-forgedBy", "R/empty", "P-otherInstance", "SQ-otherInstance", "P-futureNonce", "garbage"]);
        switch (kind2) {
          case "P": return eoaEntry(k.P, hash);
          case "SQ": return eoaEntry(k.SQ, hash);
          case "O": return eoaEntry(O, hash);
          case "A": return eoaEntry(k.A, hash);
          case "R-forgedBy": return { signer: k.R.address, signature: h.eoaSig(pick([k.P, k.SQ, O]), hash) };
          case "R/empty": return { signer: k.R.address, signature: "0x" };
          case "P-otherInstance":
          case "SQ-otherInstance": {
            const oh = await other.getRecoveryHash(W.target, o, thr, await other.nonce(W.target));
            return eoaEntry(kind2[0] === "P" ? k.P : k.SQ, oh);
          }
          case "P-futureNonce": {
            const fh = await m.getRecoveryHash(W.target, o, thr, (await m.nonce(W.target)) + 1n);
            return eoaEntry(k.P, fh);
          }
          default: return { signer: pick([k.P.address, k.SQ.address]), signature: bytes(65) };
        }
      };
      const actions = [
        [3, "EOA confirmRecovery", async () => {
          const { owners: o, thr } = choose();
          return mods[pickM()].connect(pick([k.P, k.SQ, k.P, k.SQ, k.A, O])).confirmRecovery(W.target, o, thr, rnd() < 0.5);
        }],
        [4, "multiConfirmRecovery", async () => {
          const mi = pickM();
          const { owners: o, thr } = choose();
          const n = rnd() < 0.6 ? 2 : rnd() < 0.5 ? 1 : 3;
          let entries = [];
          for (let i = 0; i < n; i++) entries.push(await sigEntry(mi, o, thr));
          if (rnd() < 0.7) entries = h.sortByAddr(entries, (e) => e.signer);
          return mods[mi].connect(pick(eoas)).multiConfirmRecovery(W.target, o, thr, entries, rnd() < 0.5);
        }],
        [2, "executeRecovery", async () => {
          const { owners: o, thr } = choose();
          return mods[pickM()].connect(pick(eoas)).executeRecovery(W.target, o, thr);
        }],
        [2, "finalizeRecovery (anyone)", async () => mods[pickM()].connect(pick(eoas)).finalizeRecovery(W.target)],
        [0.5, "EOA cancelRecovery/invalidateNonce", async () => {
          const m = mods[pickM()];
          return rnd() < 0.5 ? m.connect(pick(eoas)).cancelRecovery() : m.connect(pick(eoas)).invalidateNonce();
        }],
        [0.5, "EOA guardian admin", async () => {
          const m = mods[pickM()];
          const s = pick(eoas);
          const r = rnd();
          if (r < 0.34) return m.connect(s).addGuardianWithThreshold(pick([k.P.address, k.SQ.address, O.address, k.A.address]), 1);
          if (r < 0.67) return m.connect(s).revokeGuardianWithThreshold(h.SENTINEL, pick([k.R.address, k.P.address, k.SQ.address]), 1);
          return m.connect(s).changeThreshold(1);
        }],
        [1.5, "attack on W (non-owner sig / direct)", async () => {
          const m = mods[pickM()];
          const r = rnd();
          const signer = [pick([k.P, k.SQ, k.A, O])];
          const swap = W.interface.encodeFunctionData("swapOwner", [h.SENTINEL, k.Ph.address, k.A.address]);
          const mi2 = m.interface;
          if (r < 0.2) return h.execSafe(W, signer, W.target, swap, { sender: pick(eoas) });
          if (r < 0.3) return h.execSafe(W, signer, W.target, W.interface.encodeFunctionData("enableModule", [O.address]), { sender: pick(eoas) });
          if (r < 0.4) return h.execSafe(W, signer, m.target, mi2.encodeFunctionData("revokeGuardianWithThreshold", [h.SENTINEL, k.R.address, 1]), { sender: pick(eoas) });
          if (r < 0.5) return h.execSafe(W, signer, m.target, mi2.encodeFunctionData("addGuardianWithThreshold", [pick([k.SQ.address, k.P.address, O.address]), 1]), { sender: pick(eoas) });
          if (r < 0.6) return h.execSafe(W, signer, m.target, mi2.encodeFunctionData("changeThreshold", [1]), { sender: pick(eoas) });
          if (r < 0.7) return W.connect(pick(eoas)).swapOwner(h.SENTINEL, k.Ph.address, k.A.address);
          if (r < 0.85) return W.connect(pick(eoas)).execTransactionFromModule(W.target, 0, swap, 0);
          return W.connect(pick(eoas)).approveHash(ethers.id(`t8/${seed}/${run}/${rnd()}`));
        }],
        [2, "time jump", async () => {
          const r = rnd();
          const s = r < 0.35 ? 1 + Math.floor(rnd() * 30) : r < 0.55 ? 55 + Math.floor(rnd() * 11)
            : r < 0.75 ? 115 + Math.floor(rnd() * 11) : 121 + Math.floor(rnd() * 10000);
          await h.increaseTime(s);
          return null;
        }],
      ];
      const total = actions.reduce((a, x) => a + x[0], 0);
      const draw = () => {
        let r = rnd() * total;
        for (const a of actions) if ((r -= a[0]) < 0) return a;
        return actions[actions.length - 1];
      };
      stats.runs++;
      for (let step = 0; step < STEPS; step++) {
        const [, name, fn] = draw();
        const reason = await h.outcome(fn);
        stats.steps++;
        const a = (stats.actions[name] = stats.actions[name] || { ok: 0, reverted: 0 });
        if (reason === null) a.ok++;
        else { a.reverted++; stats.reasons[reason] = (stats.reasons[reason] || 0) + 1; }
        const ow = await W.getOwners();
        const ownersOk = ow.length === 1 && ow[0] === k.Ph.address && (await W.getThreshold()) === 1n;
        if (kind === "real") {
          for (const [mi, nm] of [[0, "A"], [1, "B"]]) {
            let single = false;
            for (const o of ownerPool) {
              const n = await mods[mi].getRecoveryApprovals(W.target, o, 1);
              if (n > 1n) stats.violations.push({ run, step, what: `approvals>1 on ${nm}`, owners: o });
              if (n === 1n) single = true;
            }
            if (single) stats.singleApprovalSteps[nm]++;
          }
          const pendingA = (await mA.getRecoveryRequest(W.target)).executeAfter !== 0n;
          const pendingB = (await mB.getRecoveryRequest(W.target)).executeAfter !== 0n;
          const same = (await snapshotOf()) === configBefore;
          if (!ownersOk || pendingA || pendingB || !same) {
            stats.violations.push({ run, step, action: name, ownersOk, pendingA, pendingB, same, owners: [...ow] });
            break;
          }
        } else if (!ownersOk) {
          stats.violations.push({ run, step, action: name, owners: [...ow] });
          break;
        }
      }
    }
    return stats;
  }

  function report(label, s) {
    console.log(`      ${label}: runs=${s.runs} actions=${s.steps}`);
    for (const [n, v] of Object.entries(s.actions)) console.log(`        ${n.padEnd(38)} ok=${v.ok} reverted=${v.reverted}`);
    console.log("        revert reasons:");
    for (const [r, c] of Object.entries(s.reasons).sort((a, b) => b[1] - a[1])) console.log(`          ${String(c).padStart(5)}  ${r}`);
  }

  it(`T8f random coalition without R and Ph: ${RUNS} runs x ${STEPS} actions (seed ${SEED}) -> W's owners never change`, async function () {
    const t0 = Date.now();
    const s = await campaign("real", RUNS, SEED);
    report(`T8f result (seed ${SEED}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`, s);
    console.log(`      evidence: steps where a single coalition approval was recorded: A (P) ${s.singleApprovalSteps.A}, B (SQ) ${s.singleApprovalSteps.B}`);
    console.log(`      evidence: invariant violations: ${s.violations.length}`);
    if (s.violations.length) console.log(JSON.stringify(s.violations.slice(0, 5), null, 2));
    expect(s.violations).to.deep.equal([]);
    expect(s.runs).to.equal(RUNS);
    expect(s.singleApprovalSteps.A).to.be.greaterThan(0);
    expect(s.singleApprovalSteps.B).to.be.greaterThan(0);
  });

  it(`T8f-control same generator with a weak A (guardians {P, SQ}), ${CONTROL_RUNS} runs -> must find an owner change`, async function () {
    const s = await campaign("control", CONTROL_RUNS, SEED);
    report("T8f-control result", s);
    console.log(`      evidence: runs in which the coalition replaced W's owner: ${s.violations.length}/${s.runs}`);
    if (s.violations.length) console.log(`      evidence: first takeover: ${JSON.stringify(s.violations[0])}`);
    expect(s.violations.length).to.be.greaterThan(0);
  });
});
