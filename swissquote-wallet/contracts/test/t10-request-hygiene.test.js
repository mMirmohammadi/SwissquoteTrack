// T10: red-team row 3.3 ("only cancelRecovery clears a request; re-enabling the module lets anyone finalize").
// Standard world (helpers.buildWorld): W owner Ph, module (60 s) guardians {R, X}, threshold 2.
// A full 2-approval request (R + X signed by P) is executed, then W (signed by Ph) calls, in order:
//   1. module.invalidateNonce(), 2. W.disableModule(module), 3. W.enableModule(module) (same module).
// After each step we read the stored request and try finalizeRecovery after the delay (probes after steps 1
// and 2 run in an EVM snapshot that is reverted, so the main sequence continues unchanged).
// T10b: re-enabling BEFORE the delay ends does not restart the wait. T10c: cancelRecovery works while the
// module is disabled, and then the re-enabled module has nothing to finalize.
const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const h = require("./helpers");

async function pendingRequest(ctx) {
  const { k, W, X, module } = ctx;
  const mi = module.interface;
  const owners = [k.N.address];
  await h.expectSuccess("R calls confirmRecovery(W,[newKey],1,false)", () => module.connect(k.R).confirmRecovery(W.target, owners, 1, false));
  await h.expectSuccess("X.execTransaction[signed P] -> confirmRecovery(W,[newKey],1,false)", () =>
    h.execSafe(X, [k.P], module.target, mi.encodeFunctionData("confirmRecovery", [W.target, owners, 1, false])));
  await h.expectSuccess("executeRecovery(W,[newKey],1) by relayer", () => module.connect(k.relayer).executeRecovery(W.target, owners, 1));
  const req = await module.getRecoveryRequest(W.target);
  expect(req.guardiansApprovalCount).to.equal(2n);
  expect([...req.newOwners]).to.deep.equal(owners);
  return { owners, req };
}

const fmtReq = (r) => `{approvals ${r.guardiansApprovalCount}, newThreshold ${r.newThreshold}, executeAfter ${r.executeAfter}, newOwners [${[...r.newOwners].join(",")}]}`;
const sameReq = (a, b) => fmtReq(a) === fmtReq(b);
const now = async () => BigInt((await ethers.provider.getBlock("latest")).timestamp);

async function wTx(ctx, label, to, data) {
  await h.expectSuccess(label, () => h.execSafe(ctx.W, [ctx.k.Ph], to, data, { sender: ctx.k.relayer }));
}

describe("T10 request hygiene (red-team row 3.3): invalidateNonce, disableModule, re-enable", function () {
  it("T10a pending 2-approval request survives invalidateNonce and disableModule; after re-enable anyone finalizes at once", async function () {
    const ctx = await h.loadWorld();
    const { k, W, module } = ctx;
    const mi = module.interface;
    const { owners, req: req0 } = await pendingRequest(ctx);
    console.log(`      evidence: step 0 (executed): request ${fmtReq(req0)}; module nonce ${await module.nonce(W.target)}; now ${await now()}`);

    // Step 1: invalidateNonce through W.
    const n0 = await module.nonce(W.target);
    await wTx(ctx, "step 1: W.execTransaction[signed Ph] -> module.invalidateNonce()", module.target, mi.encodeFunctionData("invalidateNonce", []));
    const req1 = await module.getRecoveryRequest(W.target);
    console.log(`      evidence: step 1: module nonce ${n0} -> ${await module.nonce(W.target)}; request ${fmtReq(req1)}; unchanged: ${sameReq(req0, req1)}`);
    expect(sameReq(req0, req1)).to.equal(true);
    let snap = await network.provider.send("evm_snapshot");
    await network.provider.send("evm_setNextBlockTimestamp", [Number(req0.executeAfter)]);
    await h.expectSuccess("probe after step 1 (snapshot): finalizeRecovery(W) at executeAfter by an outsider", () =>
      module.connect(k.O).finalizeRecovery(W.target, { gasLimit: 1_000_000 }));
    console.log(`      evidence: probe after step 1: W.getOwners() = [${[...(await W.getOwners())].join(",")}] (newKey ${k.N.address})`);
    expect([...(await W.getOwners())]).to.deep.equal(owners);
    await network.provider.send("evm_revert", [snap]);
    expect([...(await W.getOwners())]).to.deep.equal([k.Ph.address]);

    // Step 2: disableModule through W.
    await wTx(ctx, "step 2: W.execTransaction[signed Ph] -> W.disableModule(SENTINEL, module)", W.target,
      W.interface.encodeFunctionData("disableModule", [h.SENTINEL, module.target]));
    const req2 = await module.getRecoveryRequest(W.target);
    console.log(`      evidence: step 2: isModuleEnabled(module) = ${await W.isModuleEnabled(module.target)}; modules [${[...(await W.getModulesPaginated(h.SENTINEL, 10))[0]].join(",")}]; request ${fmtReq(req2)}; unchanged: ${sameReq(req0, req2)}; guardians still [${[...(await module.getGuardians(W.target))].join(",")}]`);
    expect(await W.isModuleEnabled(module.target)).to.equal(false);
    expect(sameReq(req0, req2)).to.equal(true);
    await network.provider.send("evm_setNextBlockTimestamp", [Number(req0.executeAfter) + 5]);
    await h.expectRevert("step 2 probe: finalizeRecovery(W) 5 s after executeAfter, module disabled", () =>
      module.connect(k.O).finalizeRecovery(W.target, { gasLimit: 1_000_000 }), "GS104");
    expect([...(await W.getOwners())]).to.deep.equal([k.Ph.address]);
    const req2b = await module.getRecoveryRequest(W.target);
    console.log(`      evidence: after the failed finalize the request is still stored: ${fmtReq(req2b)}`);
    expect(sameReq(req0, req2b)).to.equal(true);

    // Step 3: re-enable the same module through W (the delay has already passed).
    await h.increaseTime(3600);
    await wTx(ctx, "step 3: W.execTransaction[signed Ph] -> W.enableModule(module) (1 h after executeAfter)", W.target,
      W.interface.encodeFunctionData("enableModule", [module.target]));
    const req3 = await module.getRecoveryRequest(W.target);
    console.log(`      evidence: step 3: isModuleEnabled = ${await W.isModuleEnabled(module.target)}; request ${fmtReq(req3)}; unchanged: ${sameReq(req0, req3)}; now ${await now()} >= executeAfter ${req0.executeAfter}`);
    expect(sameReq(req0, req3)).to.equal(true);
    await h.expectSuccess("step 3 probe: finalizeRecovery(W) by an unrelated outsider in the very next block (no new wait)", () =>
      module.connect(k.O).finalizeRecovery(W.target, { gasLimit: 1_000_000 }));
    console.log(`      evidence: W.getOwners() = [${[...(await W.getOwners())].join(",")}] (newKey ${k.N.address})`);
    expect([...(await W.getOwners())]).to.deep.equal(owners);
    await h.expectRevert("old Ph signs a transfer", () =>
      h.execSafe(W, [k.Ph], k.Ph.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }), "GS026");
  });

  it("T10b re-enabling before the delay ends does not restart the wait (original executeAfter still applies)", async function () {
    const ctx = await h.loadWorld();
    const { k, W, module } = ctx;
    const { owners, req: req0 } = await pendingRequest(ctx);
    await wTx(ctx, "W disables the module", W.target, W.interface.encodeFunctionData("disableModule", [h.SENTINEL, module.target]));
    await h.increaseTime(20);
    await wTx(ctx, "W re-enables the module 20 s later", W.target, W.interface.encodeFunctionData("enableModule", [module.target]));
    await network.provider.send("evm_setNextBlockTimestamp", [Number(req0.executeAfter) - 1]);
    await h.expectRevert("finalizeRecovery(W) at the ORIGINAL executeAfter - 1", () =>
      module.connect(k.O).finalizeRecovery(W.target, { gasLimit: 1_000_000 }), "SM: recovery period still pending");
    await network.provider.send("evm_setNextBlockTimestamp", [Number(req0.executeAfter)]);
    await h.expectSuccess("finalizeRecovery(W) at the ORIGINAL executeAfter", () =>
      module.connect(k.O).finalizeRecovery(W.target, { gasLimit: 1_000_000 }));
    expect([...(await W.getOwners())]).to.deep.equal(owners);
  });

  it("T10c control: cancelRecovery works while the module is disabled; after re-enable there is nothing to finalize", async function () {
    const ctx = await h.loadWorld();
    const { k, W, module } = ctx;
    const mi = module.interface;
    const { req: req0 } = await pendingRequest(ctx);
    await wTx(ctx, "W disables the module", W.target, W.interface.encodeFunctionData("disableModule", [h.SENTINEL, module.target]));
    await wTx(ctx, "W (module disabled) -> module.cancelRecovery()", module.target, mi.encodeFunctionData("cancelRecovery", []));
    const r = await module.getRecoveryRequest(W.target);
    console.log(`      evidence: request after cancel: ${fmtReq(r)}`);
    expect(r.executeAfter).to.equal(0n);
    await wTx(ctx, "W re-enables the module", W.target, W.interface.encodeFunctionData("enableModule", [module.target]));
    await network.provider.send("evm_setNextBlockTimestamp", [Number(req0.executeAfter) + 5]);
    await h.expectRevert("finalizeRecovery(W) after the delay", () =>
      module.connect(k.O).finalizeRecovery(W.target, { gasLimit: 1_000_000 }), "SM: no ongoing recovery");
    expect([...(await W.getOwners())]).to.deep.equal([k.Ph.address]);
  });
});
