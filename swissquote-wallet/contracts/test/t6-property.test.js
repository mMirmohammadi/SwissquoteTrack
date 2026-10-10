// T6: randomised property test. A coalition WITHOUT R and WITHOUT Ph (P, SQ, X controlled by P/SQ,
// the attacker key, a fresh random outsider, anyone relaying, time jumps) performs random action
// sequences. Property: W's owner set never changes (and no recovery for W ever becomes pending).
// Control: the same generator against WA (Candidate A, guardians {P, SQ}) must find an owner change,
// which shows the generator is strong enough to detect a takeover when one is possible.
const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const h = require("./helpers");

const RUNS = Number(process.env.T6_RUNS || 100);
const STEPS = Number(process.env.T6_STEPS || 40);
const SEED = Number(process.env.T6_SEED || 20261010);
const CONTROL_RUNS = Number(process.env.T6_CONTROL_RUNS || 50);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GUARD_SLOT = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));
const HANDLER_SLOT = ethers.keccak256(ethers.toUtf8Bytes("fallback_manager.handler.address"));

async function campaign(ctx, target, runs, label, seed) {
  const { k, X, module } = ctx;
  const mi = module.interface;
  const stats = { runs: 0, steps: 0, actions: {}, reasons: {}, xApprovedSteps: 0, violations: [] };
  for (let run = 0; run < runs; run++) {
    const c = await h.loadWorld();
    const W = target === "B" ? c.W : c.WA;
    const rnd = mulberry32(seed + run * 7919);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const O = new ethers.Wallet(ethers.hexlify(ethers.randomBytes(32)), ethers.provider); // fresh random outsider
    await h.fund(O.address);
    const eoas = [k.P, k.SQ, k.A, O, k.relayer];
    const ownerPool = [[k.A.address], [k.A.address, k.P.address], [k.SQ.address], [O.address], [X.target]];
    const xSign = () => pick([[k.P], [k.SQ], [k.P, k.SQ]]);
    const choose = () => {
      const owners = pick(ownerPool);
      const thr = rnd() < 0.85 ? 1 : pick([0, 2, 3]);
      return { owners, thr };
    };
    const modulesBefore = await W.getModulesPaginated(h.SENTINEL, 10);
    const guardiansBefore = await module.getGuardians(W.target);
    const gThrBefore = await module.threshold(W.target);
    const guardBefore = await ethers.provider.getStorage(W.target, GUARD_SLOT);
    const handlerBefore = await ethers.provider.getStorage(W.target, HANDLER_SLOT);

    const sigEntry = async (owners, thr) => {
      const hash = await module.getRecoveryHash(W.target, owners, thr, await module.nonce(W.target));
      const other = await module.getRecoveryHash(W.target, [O.address, k.P.address], 1, await module.nonce(W.target));
      // Weighted towards entries that are valid for SOME configuration (X via P/SQ, P, SQ), so that
      // multi-signature calls often contain only "best effort" entries the coalition can really make.
      const kind = pick(["X/P", "X/SQ", "P", "SQ", "X/P", "X/SQ", "P", "SQ", "X/P", "X/SQ", "P", "SQ",
        "X/garbage", "X/empty", "X/P-staleHash", "O", "A", "R-forgedBy", "R/empty"]);
      switch (kind) {
        case "X/P": return { signer: X.target, signature: await h.safe1271Sig(c, X.target, k.P, hash) };
        case "X/SQ": return { signer: X.target, signature: await h.safe1271Sig(c, X.target, k.SQ, hash) };
        case "X/garbage": return { signer: X.target, signature: ethers.hexlify(ethers.randomBytes(65)) };
        case "X/empty": return { signer: X.target, signature: "0x" };
        case "X/P-staleHash": return { signer: X.target, signature: await h.safe1271Sig(c, X.target, k.P, other) };
        case "P": return { signer: k.P.address, signature: h.eoaSig(k.P, hash) };
        case "SQ": return { signer: k.SQ.address, signature: h.eoaSig(k.SQ, hash) };
        case "O": return { signer: O.address, signature: h.eoaSig(O, hash) };
        case "A": return { signer: k.A.address, signature: h.eoaSig(k.A, hash) };
        case "R-forgedBy": return { signer: k.R.address, signature: h.eoaSig(pick([k.P, k.SQ, O]), hash) };
        case "R/empty": return { signer: k.R.address, signature: "0x" };
      }
    };

    const actions = [
      [3, "X.exec confirmRecovery", async () => {
        const { owners, thr } = choose();
        return h.execSafe(X, xSign(), module.target, mi.encodeFunctionData("confirmRecovery", [W.target, owners, thr, rnd() < 0.5]), { sender: pick(eoas) });
      }],
      [1, "X.exec multiConfirm(null sig as X)", async () => {
        const { owners, thr } = choose();
        return h.execSafe(X, xSign(), module.target, mi.encodeFunctionData("multiConfirmRecovery", [W.target, owners, thr, [{ signer: X.target, signature: "0x" }], rnd() < 0.5]), { sender: pick(eoas) });
      }],
      [4, "multiConfirmRecovery", async () => {
        const { owners, thr } = choose();
        const n = rnd() < 0.6 ? 2 : rnd() < 0.5 ? 1 : 3;
        let entries = [];
        for (let i = 0; i < n; i++) entries.push(await sigEntry(owners, thr));
        if (rnd() < 0.7) entries = h.sortByAddr(entries, (e) => e.signer);
        return module.connect(pick(eoas)).multiConfirmRecovery(W.target, owners, thr, entries, rnd() < 0.5);
      }],
      [1, "EOA confirmRecovery", async () => {
        const { owners, thr } = choose();
        return module.connect(pick([k.P, k.SQ, k.P, k.SQ, k.A, O])).confirmRecovery(W.target, owners, thr, rnd() < 0.5);
      }],
      [2, "executeRecovery", async () => {
        const { owners, thr } = choose();
        return module.connect(pick(eoas)).executeRecovery(W.target, owners, thr);
      }],
      [2, "finalizeRecovery", async () => module.connect(pick(eoas)).finalizeRecovery(W.target)],
      [0.5, "EOA cancelRecovery/invalidateNonce", async () =>
        rnd() < 0.5 ? module.connect(pick(eoas)).cancelRecovery() : module.connect(pick(eoas)).invalidateNonce()],
      [0.5, "EOA guardian admin", async () => {
        const s = pick(eoas);
        const r = rnd();
        if (r < 0.34) return module.connect(s).addGuardianWithThreshold(pick([k.P.address, k.SQ.address, O.address]), 1);
        if (r < 0.67) return module.connect(s).revokeGuardianWithThreshold(h.SENTINEL, pick([k.R.address, X.target]), 1);
        return module.connect(s).changeThreshold(1);
      }],
      [1, "X.exec admin on X / module", async () => {
        const r = rnd();
        let to, data;
        if (r < 0.2) { to = X.target; data = X.interface.encodeFunctionData("addOwnerWithThreshold", [O.address, 1]); }
        else if (r < 0.4) { to = X.target; data = X.interface.encodeFunctionData("enableModule", [module.target]); }
        else if (r < 0.6) { to = module.target; data = mi.encodeFunctionData("addGuardianWithThreshold", [pick([k.P.address, k.R.address, O.address]), 1]); }
        else if (r < 0.7) { to = module.target; data = mi.encodeFunctionData("invalidateNonce", []); }
        else if (r < 0.8) { to = module.target; data = mi.encodeFunctionData("cancelRecovery", []); }
        else if (r < 0.9) { to = module.target; data = mi.encodeFunctionData("revokeGuardianWithThreshold", [h.SENTINEL, pick([k.R.address, X.target]), 1]); }
        else { to = W.target; data = W.interface.encodeFunctionData("swapOwner", [h.SENTINEL, k.Ph.address, k.A.address]); }
        return h.execSafe(X, xSign(), to, data, { sender: pick(eoas) });
      }],
      [1, "direct attack on W", async () => {
        const r = rnd();
        const swap = W.interface.encodeFunctionData("swapOwner", [h.SENTINEL, k.Ph.address, k.A.address]);
        if (r < 0.3) return h.execSafe(W, [pick([k.P, k.SQ, k.A, O])], W.target, swap, { sender: pick(eoas) });
        if (r < 0.45) return h.execSafe(W, [pick([k.P, k.SQ, k.A, O])], W.target, W.interface.encodeFunctionData("enableModule", [O.address]), { sender: pick(eoas) });
        if (r < 0.6) return W.connect(pick(eoas)).swapOwner(h.SENTINEL, k.Ph.address, k.A.address);
        if (r < 0.75) return W.connect(pick(eoas)).execTransactionFromModule(W.target, 0, swap, 0);
        if (r < 0.9) return h.execSafe(W, [pick([k.P, k.SQ, k.A, O])], module.target, mi.encodeFunctionData("revokeGuardianWithThreshold", [h.SENTINEL, k.R.address, 1]), { sender: pick(eoas) });
        return W.connect(pick(eoas)).approveHash(ethers.hexlify(ethers.randomBytes(32)));
      }],
      [2, "time jump", async () => {
        const r = rnd();
        const s = r < 0.5 ? 1 + Math.floor(rnd() * 30) : r < 0.8 ? 55 + Math.floor(rnd() * 11) : 61 + Math.floor(rnd() * 10000);
        await h.increaseTime(s);
        return null;
      }],
    ];
    const total = actions.reduce((a, x) => a + x[0], 0);
    const drawAction = () => {
      let r = rnd() * total;
      for (const a of actions) { if ((r -= a[0]) < 0) return a; }
      return actions[actions.length - 1];
    };

    stats.runs++;
    for (let step = 0; step < STEPS; step++) {
      const [, name] = (() => { const a = drawAction(); stats._cur = a; return a; })();
      const reason = await h.outcome(stats._cur[2]);
      stats.steps++;
      const a = (stats.actions[name] = stats.actions[name] || { ok: 0, reverted: 0 });
      if (reason === null) a.ok++; else { a.reverted++; stats.reasons[reason] = (stats.reasons[reason] || 0) + 1; }
      // ---- invariants ----
      const owners = await W.getOwners();
      const ownersOk = owners.length === 1 && owners[0] === k.Ph.address && (await W.getThreshold()) === 1n;
      if (target === "B") {
        let xApproved = false;
        for (const o of ownerPool) {
          const n = await module.getRecoveryApprovals(W.target, o, 1);
          if (n > 1n) stats.violations.push({ run, step, what: "approvals>1", owners: o });
          if (n === 1n) xApproved = true;
        }
        if (xApproved) stats.xApprovedSteps++;
        const pending = (await module.getRecoveryRequest(W.target)).executeAfter !== 0n;
        const same =
          JSON.stringify(await W.getModulesPaginated(h.SENTINEL, 10)) === JSON.stringify(modulesBefore) &&
          JSON.stringify(await module.getGuardians(W.target)) === JSON.stringify(guardiansBefore) &&
          (await module.threshold(W.target)) === gThrBefore &&
          (await ethers.provider.getStorage(W.target, GUARD_SLOT)) === guardBefore &&
          (await ethers.provider.getStorage(W.target, HANDLER_SLOT)) === handlerBefore;
        if (!ownersOk || pending || !same) {
          stats.violations.push({ run, step, action: name, ownersOk, pending, same, owners });
          break;
        }
      } else if (!ownersOk) {
        stats.violations.push({ run, step, action: name, owners });
        break; // control: count the run as "takeover found" and move on
      }
    }
  }
  delete stats._cur;
  return stats;
}

function report(label, s) {
  console.log(`      ${label}: runs=${s.runs} actions=${s.steps}`);
  for (const [n, v] of Object.entries(s.actions)) console.log(`        ${n.padEnd(36)} ok=${v.ok} reverted=${v.reverted}`);
  const top = Object.entries(s.reasons).sort((a, b) => b[1] - a[1]);
  console.log("        revert reasons:");
  for (const [r, c] of top) console.log(`          ${String(c).padStart(5)}  ${r}`);
}

describe("T6 randomised property: a coalition without R and without Ph never changes W's owners", function () {
  it(`T6 Candidate B: ${RUNS} random runs x ${STEPS} actions (seed ${SEED}) -> owners of W never change`, async function () {
    const ctx = await h.loadWorld();
    const t0 = Date.now();
    const s = await campaign(ctx, "B", RUNS, "B", SEED);
    report(`T6 result (seed ${SEED}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`, s);
    console.log(`      evidence: steps where X's single approval existed for some proposed owner set: ${s.xApprovedSteps}`);
    console.log(`      evidence: invariant violations: ${s.violations.length}`);
    if (s.violations.length) console.log(JSON.stringify(s.violations.slice(0, 5), null, 2));
    expect(s.violations).to.deep.equal([]);
    expect(s.runs).to.equal(RUNS);
    expect(s.xApprovedSteps).to.be.greaterThan(0); // the coalition did get X's vote recorded
  });

  it(`T6-control Candidate A: same generator, ${CONTROL_RUNS} runs -> must find an owner change (test has teeth)`, async function () {
    const ctx = await h.loadWorld();
    const s = await campaign(ctx, "A", CONTROL_RUNS, "A", SEED);
    report("T6-control result", s);
    console.log(`      evidence: runs in which P+SQ replaced WA's owner: ${s.violations.length}/${s.runs}`);
    expect(s.violations.length).to.be.greaterThan(0);
  });
});
