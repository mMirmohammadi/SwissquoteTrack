// T0-T5: deterministic scenario tests for Candidate B.
// Setup (see helpers.buildWorld): W = Safe{owner Ph, threshold 1}; module guardians {R, X}, threshold 2;
// X = Safe{owners P, SQ, threshold 1}; recovery period 60 s. WA = same user, Candidate A guardians {P, SQ}.
const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const h = require("./helpers");

const MSG_THRESHOLD = "SM: confirmed signatures less than threshold";

describe("Candidate B on a local chain (Safe v1.4.1 + Candide SocialRecoveryModule)", function () {
  let ctx, k, W, X, WA, module, mi;
  beforeEach(async function () {
    ctx = await h.loadWorld();
    ({ k, W, X, WA, module } = ctx);
    mi = module.interface;
  });

  // Encodes a call to the module made BY Safe X (X's own transaction, signed by one of X's owners).
  const xCalls = (fn, args) => mi.encodeFunctionData(fn, args);

  it("T0 setup: canonical Safe v1.4.1 bytecode; W, X and WA configured as described", async function () {
    for (const [name, v] of Object.entries(ctx.codeHashes)) {
      console.log(`      evidence: ${name} runtime keccak256 ${v.got} canonical ${v.canonical} -> ${v.match ? "MATCH" : "DIFF"}`);
      expect(v.match, name).to.equal(true);
    }
    expect(await W.getOwners()).to.deep.equal([k.Ph.address]);
    expect(await W.getThreshold()).to.equal(1n);
    expect(await W.isModuleEnabled(module.target)).to.equal(true);
    expect(h.sameSet(await module.getGuardians(W.target), [k.R.address, X.target])).to.equal(true);
    expect(await module.threshold(W.target)).to.equal(2n);
    expect(h.sameSet(await X.getOwners(), [k.P.address, k.SQ.address])).to.equal(true);
    expect(await X.getThreshold()).to.equal(1n);
    expect(h.sameSet(await module.getGuardians(WA.target), [k.P.address, k.SQ.address])).to.equal(true);
    // The recovery hash the module computes equals a standard EIP-712 hash, so an app can compute it offline.
    const n = await module.nonce(W.target);
    const offline = ethers.TypedDataEncoder.hash(
      { name: "Social Recovery Module", version: "0.0.1", chainId: 31337, verifyingContract: module.target },
      { ExecuteRecovery: [{ name: "wallet", type: "address" }, { name: "newOwners", type: "address[]" }, { name: "newThreshold", type: "uint256" }, { name: "nonce", type: "uint256" }] },
      { wallet: W.target, newOwners: [k.N.address], newThreshold: 1, nonce: n }
    );
    expect(offline).to.equal(await module.getRecoveryHash(W.target, [k.N.address], 1, n));
    console.log(`      evidence: offline EIP-712 recovery hash == module.getRecoveryHash -> ${offline}`);
  });

  describe("T1 P and SQ collude (every non-user party) -> recovery impossible", function () {
    it("T1a X confirms through its own execTransaction (signed by P, then by SQ); executeRecovery still reverts", async function () {
      const owners = [k.A.address];
      await h.expectSuccess("X.execTransaction[signed P] -> module.confirmRecovery(W,[attacker],1,false)", () =>
        h.execSafe(X, [k.P], module.target, xCalls("confirmRecovery", [W.target, owners, 1, false])));
      await h.expectSuccess("X.execTransaction[signed SQ] -> module.confirmRecovery(W,[attacker],1,false)", () =>
        h.execSafe(X, [k.SQ], module.target, xCalls("confirmRecovery", [W.target, owners, 1, false])));
      await h.expectSuccess("X.execTransaction[signed P+SQ] -> module.confirmRecovery(W,[attacker],1,false)", () =>
        h.execSafe(X, [k.P, k.SQ], module.target, xCalls("confirmRecovery", [W.target, owners, 1, false])));
      expect(await module.hasGuardianApproved(W.target, X.target, owners, 1)).to.equal(true);
      expect(await module.getRecoveryApprovals(W.target, owners, 1)).to.equal(1n);
      console.log("      evidence: getRecoveryApprovals(W,[attacker],1) = 1 (threshold 2)");
      // With _execute=true the module reverts inside X's transaction; Safe surfaces it as GS013.
      await h.expectRevert("X.execTransaction[signed P+SQ] -> confirmRecovery(...,execute=true)", () =>
        h.execSafe(X, [k.P, k.SQ], module.target, xCalls("confirmRecovery", [W.target, owners, 1, true])), "GS013");
      // The inner reason, shown by simulating the same call with msg.sender = X:
      await h.expectRevert("eth_call from X: confirmRecovery(W,[attacker],1,true)", () =>
        module.connect(ethers.provider).confirmRecovery.staticCall(W.target, owners, 1, true, { from: X.target }), MSG_THRESHOLD);
      for (const sender of [k.A, k.P, k.SQ, k.relayer]) {
        await h.expectRevert(`executeRecovery(W,[attacker],1) sent by ${sender === k.A ? "attacker" : sender === k.P ? "P" : sender === k.SQ ? "SQ" : "relayer"}`, () =>
          module.connect(sender).executeRecovery(W.target, owners, 1), MSG_THRESHOLD);
      }
      expect(await W.getOwners()).to.deep.equal([k.Ph.address]);
    });

    it("T1b X confirms through an EIP-1271 signature in multiConfirmRecovery (P-signed or SQ-signed); still reverts", async function () {
      const owners = [k.A.address];
      const hash = await h.recoveryHash(ctx, W.target, owners, 1);
      const sigXbyP = await h.safe1271Sig(ctx, X.target, k.P, hash);
      const sigXbySQ = await h.safe1271Sig(ctx, X.target, k.SQ, hash);
      // The signatures are genuinely valid EIP-1271 signatures of X (so the rejection below is about vote counting).
      const x1271 = new ethers.Contract(X.target, ["function isValidSignature(bytes32,bytes) view returns (bytes4)"], ethers.provider);
      expect(await x1271.isValidSignature(hash, sigXbyP)).to.equal("0x1626ba7e");
      expect(await x1271.isValidSignature(hash, sigXbySQ)).to.equal("0x1626ba7e");
      await module.validateGuardianSignature(W.target, hash, X.target, sigXbyP); // does not revert
      console.log("      evidence: X.isValidSignature(recoveryHash, sig by P / by SQ) = 0x1626ba7e (valid EIP-1271)");
      await h.expectRevert("multiConfirmRecovery(W,[attacker],1,[X:sig by P],execute=true)", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: X.target, signature: sigXbyP }], true), MSG_THRESHOLD);
      await h.expectRevert("multiConfirmRecovery(W,[attacker],1,[X:sig by SQ],execute=true)", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: X.target, signature: sigXbySQ }], true), MSG_THRESHOLD);
      await h.expectSuccess("multiConfirmRecovery(W,[attacker],1,[X:sig by P],execute=false)", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: X.target, signature: sigXbyP }], false));
      await h.expectSuccess("multiConfirmRecovery(W,[attacker],1,[X:sig by SQ],execute=false)", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: X.target, signature: sigXbySQ }], false));
      // X also confirms on-chain; the count stays 1 because approvals are one boolean per guardian address.
      await h.expectSuccess("X.execTransaction[signed SQ] -> confirmRecovery(W,[attacker],1,false)", () =>
        h.execSafe(X, [k.SQ], module.target, xCalls("confirmRecovery", [W.target, owners, 1, false])));
      expect(await module.getRecoveryApprovals(W.target, owners, 1)).to.equal(1n);
      console.log("      evidence: getRecoveryApprovals(W,[attacker],1) = 1 after X confirmed by signature (x2) and on-chain");
      await h.expectRevert("executeRecovery(W,[attacker],1)", () => module.connect(k.A).executeRecovery(W.target, owners, 1), MSG_THRESHOLD);
      expect(await W.getOwners()).to.deep.equal([k.Ph.address]);
    });

    it("T1c P and SQ act directly as EOAs -> rejected as non-guardians", async function () {
      const owners = [k.A.address];
      const hash = await h.recoveryHash(ctx, W.target, owners, 1);
      await h.expectRevert("P calls confirmRecovery(W,[attacker],1,false)", () =>
        module.connect(k.P).confirmRecovery(W.target, owners, 1, false), "SM: sender not a guardian");
      await h.expectRevert("SQ calls confirmRecovery(W,[attacker],1,true)", () =>
        module.connect(k.SQ).confirmRecovery(W.target, owners, 1, true), "SM: sender not a guardian");
      await h.expectRevert("multiConfirmRecovery([P: P's EOA signature])", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: k.P.address, signature: h.eoaSig(k.P, hash) }], true), "SM: Signer not a guardian");
      await h.expectRevert("multiConfirmRecovery([SQ: SQ's EOA signature])", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: k.SQ.address, signature: h.eoaSig(k.SQ, hash) }], true), "SM: Signer not a guardian");
      const both = h.sortByAddr([{ signer: k.P.address, signature: h.eoaSig(k.P, hash) }, { signer: k.SQ.address, signature: h.eoaSig(k.SQ, hash) }], (x) => x.signer);
      await h.expectRevert("multiConfirmRecovery([P, SQ] EOA signatures, sorted)", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, both, true), "SM: Signer not a guardian");
      const withX = h.sortByAddr([...both, { signer: X.target, signature: await h.safe1271Sig(ctx, X.target, k.P, hash) }], (x) => x.signer);
      await h.expectRevert("multiConfirmRecovery([X(P), P, SQ], sorted)", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, withX, true), "SM: Signer not a guardian");
      // Claim to be R or X with an empty signature: only allowed when msg.sender is that guardian.
      await h.expectRevert("P sends multiConfirmRecovery([R, empty signature])", () =>
        module.connect(k.P).multiConfirmRecovery(W.target, owners, 1, [{ signer: k.R.address, signature: "0x" }], true), "SM: sender not a guardian");
      // Forge R: SQ signs and claims the signature is R's.
      await h.expectRevert("multiConfirmRecovery([R: signature made by SQ])", () =>
        module.connect(k.SQ).multiConfirmRecovery(W.target, owners, 1, [{ signer: k.R.address, signature: h.eoaSig(k.SQ, hash) }], true), "SM: Invalid guardian signature");
      expect(await module.getRecoveryApprovals(W.target, owners, 1)).to.equal(0n);
      await h.expectRevert("executeRecovery(W,[attacker],1)", () => module.connect(k.A).executeRecovery(W.target, owners, 1), MSG_THRESHOLD);
      expect(await W.getOwners()).to.deep.equal([k.Ph.address]);
    });

    it("T1d X's signature submitted twice -> duplicate/ordering check rejects it", async function () {
      const owners = [k.A.address];
      const hash = await h.recoveryHash(ctx, W.target, owners, 1);
      const sigXbyP = await h.safe1271Sig(ctx, X.target, k.P, hash);
      const sigXbySQ = await h.safe1271Sig(ctx, X.target, k.SQ, hash);
      await h.expectRevert("multiConfirmRecovery([X:sig by P, X:sig by SQ])", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: X.target, signature: sigXbyP }, { signer: X.target, signature: sigXbySQ }], true), "SM: duplicate signers/invalid ordering");
      await h.expectRevert("multiConfirmRecovery([X:sig by P, X:sig by P])", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [{ signer: X.target, signature: sigXbyP }, { signer: X.target, signature: sigXbyP }], false), "SM: duplicate signers/invalid ordering");
      // Wrong order with a genuine pair (R's real signature is NOT available to the coalition; this only
      // checks the ordering rule using a valid R signature produced by the test itself).
      const sigR = h.eoaSig(k.R, hash);
      const sorted = h.sortByAddr([{ signer: X.target, signature: sigXbyP }, { signer: k.R.address, signature: sigR }], (x) => x.signer);
      await h.expectRevert("multiConfirmRecovery([R, X] in descending address order)", () =>
        module.connect(k.A).multiConfirmRecovery(W.target, owners, 1, [sorted[1], sorted[0]], true), "SM: duplicate signers/invalid ordering");
      expect(await module.getRecoveryApprovals(W.target, owners, 1)).to.equal(0n);
      expect(await W.getOwners()).to.deep.equal([k.Ph.address]);
    });
  });

  // ---------- T2 / T3: legitimate recovery by R + X, X approved by only one of its owners ----------
  for (const [tid, viaName] of [["T2", "P"], ["T3", "SQ"]]) {
    for (const path of ["signatures", "on-chain confirmations"]) {
      it(`${tid} R + X(${viaName} only) via ${path}: execute -> wait -> finalize -> W owned by newKey only`, async function () {
        const via = k[viaName];
        const owners = [k.N.address];
        const addrBefore = W.target;
        const balBefore = await ethers.provider.getBalance(W.target);
        if (path === "signatures") {
          const hash = await h.recoveryHash(ctx, W.target, owners, 1);
          const sigs = h.sortByAddr([
            { signer: k.R.address, signature: h.eoaSig(k.R, hash) },
            { signer: X.target, signature: await h.safe1271Sig(ctx, X.target, via, hash) },
          ], (x) => x.signer);
          await h.expectSuccess(`multiConfirmRecovery(W,[newKey],1,[R sig, X sig by ${viaName}],execute=false) by relayer`, () =>
            module.connect(k.relayer).multiConfirmRecovery(W.target, owners, 1, sigs, false));
        } else {
          await h.expectSuccess("R calls confirmRecovery(W,[newKey],1,false)", () =>
            module.connect(k.R).confirmRecovery(W.target, owners, 1, false));
          await h.expectSuccess(`X.execTransaction[signed ${viaName}] -> confirmRecovery(W,[newKey],1,false)`, () =>
            h.execSafe(X, [via], module.target, xCalls("confirmRecovery", [W.target, owners, 1, false])));
        }
        expect(await module.getRecoveryApprovals(W.target, owners, 1)).to.equal(2n);
        await h.expectSuccess("executeRecovery(W,[newKey],1) by relayer", () => module.connect(k.relayer).executeRecovery(W.target, owners, 1));
        const req = await module.getRecoveryRequest(W.target);
        const executeAfter = req.executeAfter;
        expect(req.newOwners).to.deep.equal(owners);
        await h.expectRevert("finalizeRecovery(W) right after execute", () =>
          module.connect(k.relayer).finalizeRecovery(W.target, { gasLimit: 1_000_000 }), "SM: recovery period still pending");
        await network.provider.send("evm_setNextBlockTimestamp", [Number(executeAfter) - 1]);
        await h.expectRevert(`finalizeRecovery(W) at executeAfter-1 (t=${Number(executeAfter) - 1})`, () =>
          module.connect(k.relayer).finalizeRecovery(W.target, { gasLimit: 1_000_000 }), "SM: recovery period still pending");
        expect(await W.getOwners()).to.deep.equal([k.Ph.address]); // still the old owner during the wait
        await network.provider.send("evm_setNextBlockTimestamp", [Number(executeAfter)]);
        await h.expectSuccess(`finalizeRecovery(W) at executeAfter (t=${Number(executeAfter)}) by an unrelated relayer`, () =>
          module.connect(k.O).finalizeRecovery(W.target, { gasLimit: 1_000_000 }));
        expect(await W.getOwners()).to.deep.equal([k.N.address]);
        expect(await W.getThreshold()).to.equal(1n);
        console.log(`      evidence: W.getOwners() = [newKey ${k.N.address}], threshold 1, address unchanged ${W.target === addrBefore}`);
        expect(W.target).to.equal(addrBefore);
        expect(await ethers.provider.getBalance(W.target)).to.equal(balBefore);
        await h.expectRevert("W.execTransaction signed by OLD Ph (send 1 ETH)", () =>
          h.execSafe(W, [k.Ph], k.Ph.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }), "GS026");
        const before = await ethers.provider.getBalance(k.O.address);
        await h.expectSuccess("W.execTransaction signed by newKey (send 1 ETH)", () =>
          h.execSafe(W, [k.N], k.O.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }));
        expect(await ethers.provider.getBalance(k.O.address)).to.equal(before + ethers.parseEther("1"));
      });
    }
  }

  it("T4 owner cancels during the wait -> finalizeRecovery reverts 'SM: no ongoing recovery'", async function () {
    const owners = [k.N.address];
    await (await module.connect(k.R).confirmRecovery(W.target, owners, 1, false)).wait();
    await (await h.execSafe(X, [k.P], module.target, xCalls("confirmRecovery", [W.target, owners, 1, false]))).wait();
    await h.expectSuccess("executeRecovery(W,[newKey],1)", () => module.connect(k.relayer).executeRecovery(W.target, owners, 1));
    // Nobody but W itself can cancel W's recovery: cancelRecovery acts on msg.sender's own entry.
    for (const [n, s] of [["P", k.P], ["SQ", k.SQ], ["R", k.R]]) {
      await h.expectRevert(`${n} calls cancelRecovery() directly`, () => module.connect(s).cancelRecovery(), "SM: no ongoing recovery");
    }
    await h.expectRevert("X.execTransaction[signed P] -> cancelRecovery()", () =>
      h.execSafe(X, [k.P], module.target, xCalls("cancelRecovery", [])), "GS013");
    expect((await module.getRecoveryRequest(W.target)).executeAfter).to.not.equal(0n);
    await h.increaseTime(10);
    await h.expectSuccess("W.execTransaction[signed Ph] -> module.cancelRecovery() during the wait", () =>
      h.execSafe(W, [k.Ph], module.target, xCalls("cancelRecovery", []), { sender: k.relayer }));
    expect((await module.getRecoveryRequest(W.target)).executeAfter).to.equal(0n);
    await h.increaseTime(Number(h.RECOVERY_PERIOD) + 5);
    await h.expectRevert("finalizeRecovery(W) after the period", () => module.connect(k.relayer).finalizeRecovery(W.target), "SM: no ongoing recovery");
    // The confirmations were bound to the old nonce, so they cannot be replayed to restart recovery.
    await h.expectRevert("executeRecovery(W,[newKey],1) again with the old confirmations", () =>
      module.connect(k.relayer).executeRecovery(W.target, owners, 1), MSG_THRESHOLD);
    expect(await W.getOwners()).to.deep.equal([k.Ph.address]);
  });

  it("T5 A -> B at the same address: owner swaps guardians {P,SQ} -> {R,X}, invalidates nonce; A-style approvals die", async function () {
    const owners = [k.A.address];
    const addr = WA.target;
    const codeBefore = await ethers.provider.getCode(addr);
    const singletonSlot = await ethers.provider.getStorage(addr, 0);
    // Control: under Candidate A, P + SQ CAN take over (run in a throw-away snapshot).
    const snap = await network.provider.send("evm_snapshot");
    {
      const hash = await h.recoveryHash(ctx, addr, owners, 1);
      const sigs = h.sortByAddr([{ signer: k.P.address, signature: h.eoaSig(k.P, hash) }, { signer: k.SQ.address, signature: h.eoaSig(k.SQ, hash) }], (x) => x.signer);
      await h.expectSuccess("[control, Candidate A] multiConfirmRecovery(WA,[attacker],1,[P,SQ],execute=true)", () =>
        module.connect(k.A).multiConfirmRecovery(addr, owners, 1, sigs, true));
      await h.increaseTime(Number(h.RECOVERY_PERIOD) + 1);
      await h.expectSuccess("[control, Candidate A] finalizeRecovery(WA)", () => module.connect(k.A).finalizeRecovery(addr));
      expect(await WA.getOwners()).to.deep.equal([k.A.address]);
      console.log("      evidence: [control] under Candidate A, P+SQ replaced the owner: WA.getOwners() = [attacker]");
    }
    await network.provider.send("evm_revert", [snap]);
    expect(await WA.getOwners()).to.deep.equal([k.Ph.address]);

    // Old A-style approvals collected before the switch: P confirms on-chain; SQ signs off-chain.
    const nonceA = await module.nonce(addr);
    const oldHash = await h.recoveryHash(ctx, addr, owners, 1);
    await (await module.connect(k.P).confirmRecovery(addr, owners, 1, false)).wait();
    const oldSigSQ = h.eoaSig(k.SQ, oldHash);
    expect(await module.hasGuardianApproved(addr, k.P.address, owners, 1)).to.equal(true);

    // The owner (Ph) switches the guardian set with ordinary Safe transactions.
    const steps = [
      ["addGuardianWithThreshold(R,2)", () => mi.encodeFunctionData("addGuardianWithThreshold", [k.R.address, 2])],
      ["addGuardianWithThreshold(X,2)", () => mi.encodeFunctionData("addGuardianWithThreshold", [X.target, 2])],
      ["revokeGuardianWithThreshold(prev,P,2)", async () => mi.encodeFunctionData("revokeGuardianWithThreshold", [await h.prevGuardian(ctx, addr, k.P.address), k.P.address, 2])],
      ["revokeGuardianWithThreshold(prev,SQ,2)", async () => mi.encodeFunctionData("revokeGuardianWithThreshold", [await h.prevGuardian(ctx, addr, k.SQ.address), k.SQ.address, 2])],
      ["invalidateNonce()", () => mi.encodeFunctionData("invalidateNonce", [])],
    ];
    for (const [label, enc] of steps) {
      const data = await enc();
      await h.expectSuccess(`WA.execTransaction[signed Ph] -> module.${label}`, () => h.execSafe(WA, [k.Ph], module.target, data, { sender: k.relayer }));
    }
    expect(WA.target).to.equal(addr);
    expect(await ethers.provider.getCode(addr)).to.equal(codeBefore);
    expect(await ethers.provider.getStorage(addr, 0)).to.equal(singletonSlot);
    expect(await WA.getOwners()).to.deep.equal([k.Ph.address]);
    const guardians = await module.getGuardians(addr);
    expect(h.sameSet(guardians, [k.R.address, X.target])).to.equal(true);
    expect(await module.threshold(addr)).to.equal(2n);
    expect(await module.nonce(addr)).to.equal(nonceA + 1n);
    console.log(`      evidence: same address ${addr}, same code and singleton; guardians now {R, X}, threshold 2, nonce ${nonceA} -> ${nonceA + 1n}`);

    // invalidateNonce alone kills P's earlier on-chain approval (hasGuardianApproved ignores guardian status).
    expect(await module.hasGuardianApproved(addr, k.P.address, owners, 1)).to.equal(false);
    await h.expectRevert("executeRecovery(WA,[attacker],1) relying on P's pre-switch approval", () =>
      module.connect(k.A).executeRecovery(addr, owners, 1), MSG_THRESHOLD);
    await h.expectRevert("multiConfirmRecovery(WA,[attacker],1,[SQ's pre-switch signature])", () =>
      module.connect(k.A).multiConfirmRecovery(addr, owners, 1, [{ signer: k.SQ.address, signature: oldSigSQ }], true), "SM: Signer not a guardian");
    const newHash = await h.recoveryHash(ctx, addr, owners, 1);
    expect(newHash).to.not.equal(oldHash);
    const fresh = h.sortByAddr([{ signer: k.P.address, signature: h.eoaSig(k.P, newHash) }, { signer: k.SQ.address, signature: h.eoaSig(k.SQ, newHash) }], (x) => x.signer);
    await h.expectRevert("multiConfirmRecovery(WA,[attacker],1,[P,SQ] fresh signatures at the new nonce)", () =>
      module.connect(k.A).multiConfirmRecovery(addr, owners, 1, fresh, true), "SM: Signer not a guardian");
    await h.expectRevert("P calls confirmRecovery(WA,...) directly", () => module.connect(k.P).confirmRecovery(addr, owners, 1, false), "SM: sender not a guardian");
    // P + SQ through X now count as one vote, as in T1.
    await (await h.execSafe(X, [k.P, k.SQ], module.target, xCalls("confirmRecovery", [addr, owners, 1, false]))).wait();
    await h.expectRevert("executeRecovery(WA,[attacker],1) after X(P+SQ) confirmed", () => module.connect(k.A).executeRecovery(addr, owners, 1), MSG_THRESHOLD);
    // And the new B rules work at the same address: R + X(SQ) recover to newKey.
    const nOwners = [k.N.address];
    await (await module.connect(k.R).confirmRecovery(addr, nOwners, 1, false)).wait();
    await (await h.execSafe(X, [k.SQ], module.target, xCalls("confirmRecovery", [addr, nOwners, 1, false]))).wait();
    await h.expectSuccess("executeRecovery(WA,[newKey],1) with R + X(SQ)", () => module.connect(k.relayer).executeRecovery(addr, nOwners, 1));
    await h.increaseTime(Number(h.RECOVERY_PERIOD) + 1);
    await h.expectSuccess("finalizeRecovery(WA)", () => module.connect(k.relayer).finalizeRecovery(addr));
    expect(await WA.getOwners()).to.deep.equal([k.N.address]);
    expect(WA.target).to.equal(addr);
  });
});
