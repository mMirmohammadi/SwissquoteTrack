// T7 (optional): creation tamper test.
// The whole Candidate B configuration (owner Ph, recovery module, guardians {R, X}, guardian threshold 2) is
// put into the Safe's creation initializer, so the Safe address commits to it: CREATE2 over
// keccak256(initializer) and saltNonce (SafeProxyFactory v1.4.1). The phone predicts the address offline from
// the honest initializer and, after creation, reads the configuration back. Each tampered initializer
// (extra owner, extra module, weaker guardian threshold) must be caught by BOTH checks. Each tamper's
// consequence is also demonstrated, to show what the checks protect against.
const { ethers } = require("hardhat");
const { expect } = require("chai");
const h = require("./helpers");

const GUARD_SLOT = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));
const HANDLER_SLOT = ethers.keccak256(ethers.toUtf8Bytes("fallback_manager.handler.address"));
const SALT = 7n;
const addrFromSlot = (v) => ethers.getAddress("0x" + v.slice(-40));

async function setupWorld() {
  const ctx = await h.loadWorld();
  const fixture = await (await (await ethers.getContractFactory("SetupFixture", ctx.k.relayer)).deploy()).waitForDeployment();
  const honest = { owners: [ctx.k.Ph.address], modules: [ctx.module.target], guardians: [ctx.k.R.address, ctx.X.target], gThreshold: 2 };
  const init = (cfg) =>
    h.setupData(cfg.owners, 1, ctx.handler.target, fixture.target,
      fixture.interface.encodeFunctionData("configure", [cfg.modules, ctx.module.target, cfg.guardians, cfg.gThreshold]));
  const expected = {
    proxyCodeHash: ethers.keccak256(await ethers.provider.getCode(ctx.W.target)), // every SafeProxy has this runtime code
    singleton: ctx.singleton.target, owners: honest.owners, threshold: 1n, modules: honest.modules,
    handler: ctx.handler.target, guardians: honest.guardians, guardianThreshold: 2n,
  };
  const predictedHonest = await h.predictSafeAddress(ctx, init(honest), SALT); // what the phone computes offline
  return { ctx, honest, init, expected, predictedHonest };
}

async function deploy(ctx, initializer, sender) {
  const addr = await ctx.factory.createProxyWithNonce.staticCall(ctx.singleton.target, initializer, SALT);
  await (await ctx.factory.connect(sender).createProxyWithNonce(ctx.singleton.target, initializer, SALT)).wait();
  return h.safeAt(addr);
}

// Read-back check the app would run against the chain. Returns the list of discrepancies.
async function audit(ctx, wallet, ex) {
  const p = ethers.provider;
  const d = [];
  if (ethers.keccak256(await p.getCode(wallet.target)) !== ex.proxyCodeHash) d.push("proxy code differs");
  const singleton = addrFromSlot(await p.getStorage(wallet.target, 0));
  if (singleton !== ex.singleton) d.push(`singleton ${singleton}`);
  const owners = [...(await wallet.getOwners())];
  if (JSON.stringify(owners) !== JSON.stringify(ex.owners)) d.push(`owners [${owners.join(",")}]`);
  const thr = await wallet.getThreshold();
  if (thr !== ex.threshold) d.push(`owner threshold ${thr}`);
  const [mods, next] = await wallet.getModulesPaginated(h.SENTINEL, 50);
  if (JSON.stringify([...mods]) !== JSON.stringify(ex.modules) || next !== h.SENTINEL) d.push(`modules [${[...mods].join(",")}]`);
  const guard = addrFromSlot(await p.getStorage(wallet.target, GUARD_SLOT));
  if (guard !== ethers.ZeroAddress) d.push(`guard ${guard}`);
  const handler = addrFromSlot(await p.getStorage(wallet.target, HANDLER_SLOT));
  if (handler !== ex.handler) d.push(`fallback handler ${handler}`);
  const guardians = [...(await ctx.module.getGuardians(wallet.target))];
  if (!h.sameSet(guardians, ex.guardians)) d.push(`guardians [${guardians.join(",")}]`);
  const gThr = await ctx.module.threshold(wallet.target);
  if (gThr !== ex.guardianThreshold) d.push(`guardian threshold ${gThr}`);
  if ((await ctx.module.getRecoveryRequest(wallet.target)).executeAfter !== 0n) d.push("recovery already pending");
  if ((await ctx.module.nonce(wallet.target)) !== 0n) d.push("recovery nonce not fresh");
  return d;
}

describe("T7 creation tamper test (optional): the address and a config read-back both catch a tampered setup", function () {
  it("T7a honest one-transaction creation: predicted address matches and read-back is clean, even if an attacker submits it", async function () {
    const { ctx, honest, init, expected, predictedHonest } = await setupWorld();
    const W2 = await deploy(ctx, init(honest), ctx.k.A); // the attacker relays the creation transaction
    console.log(`      evidence: predicted ${predictedHonest} deployed ${W2.target} -> ${W2.target === predictedHonest ? "MATCH" : "MISMATCH"}`);
    const d = await audit(ctx, W2, expected);
    console.log(`      evidence: read-back discrepancies: ${d.length ? d.join("; ") : "none"} (owners [Ph], threshold 1, modules [recovery module], no guard, guardians {R, X}, guardian threshold 2)`);
    expect(W2.target).to.equal(predictedHonest);
    expect(d).to.deep.equal([]);
  });

  const tampers = [
    { name: "extra owner (attacker) at setup", cfg: (k, hon) => ({ ...hon, owners: [k.Ph.address, k.A.address] }), expectIn: "owners" },
    { name: "extra module (attacker key) at setup", cfg: (k, hon) => ({ ...hon, modules: [hon.modules[0], k.A.address] }), expectIn: "modules" },
    { name: "guardian threshold 1 instead of 2", cfg: (k, hon) => ({ ...hon, gThreshold: 1 }), expectIn: "guardian threshold 1" },
  ];
  for (const [i, t] of tampers.entries()) {
    it(`T7${"bcd"[i]} tampered initializer: ${t.name} -> address mismatch AND read-back flags it; consequence shown`, async function () {
      const { ctx, honest, init, expected, predictedHonest } = await setupWorld();
      const { k, module, X } = ctx;
      const bad = init(t.cfg(k, honest));
      const Wt = await deploy(ctx, bad, k.relayer);
      await h.fund(Wt.target, "10");
      const predictedBad = await h.predictSafeAddress(ctx, bad, SALT);
      console.log(`      evidence: phone predicted ${predictedHonest}, tampered Safe is at ${Wt.target} -> ${Wt.target === predictedHonest ? "MATCH (NOT DETECTED)" : "MISMATCH (detected)"}`);
      const d = await audit(ctx, Wt, expected);
      console.log(`      evidence: read-back discrepancies: ${d.join("; ") || "none (NOT DETECTED)"}`);
      expect(Wt.target).to.not.equal(predictedHonest);
      expect(Wt.target).to.equal(predictedBad);
      expect(d.join("; ")).to.contain(t.expectIn);

      // Consequence if the tamper went unnoticed.
      if (i === 0) {
        await h.expectSuccess("attacker alone signs a transaction from the tampered Safe (send 1 ETH to attacker)",
          () => h.execSafe(Wt, [k.A], k.A.address, "0x", { value: ethers.parseEther("1") }));
      } else if (i === 1) {
        const swap = Wt.interface.encodeFunctionData("swapOwner", [h.SENTINEL, k.Ph.address, k.A.address]);
        await h.expectSuccess("attacker key, as an enabled module, calls execTransactionFromModule(swapOwner Ph -> attacker)",
          () => Wt.connect(k.A).execTransactionFromModule(Wt.target, 0, swap, 0));
        const owners = await Wt.getOwners();
        console.log(`      evidence: tampered Safe owners now [${owners.join(",")}] (attacker)`);
        expect([...owners]).to.deep.equal([k.A.address]);
      } else {
        const hash = await h.recoveryHash(ctx, Wt.target, [k.A.address], 1);
        await h.expectSuccess("X alone (signed by P) confirms and executes a recovery to the attacker",
          async () => module.connect(k.relayer).multiConfirmRecovery(Wt.target, [k.A.address], 1,
            [{ signer: X.target, signature: await h.safe1271Sig(ctx, X.target, k.P, hash) }], true));
        await h.increaseTime(h.RECOVERY_PERIOD);
        await h.expectSuccess("finalizeRecovery after the period", () => module.connect(k.relayer).finalizeRecovery(Wt.target));
        const owners = await Wt.getOwners();
        console.log(`      evidence: tampered Safe owners now [${owners.join(",")}] (attacker)`);
        expect([...owners]).to.deep.equal([k.A.address]);
      }
    });
  }
});
