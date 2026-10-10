// Local-only Hardhat config. No public networks are configured on purpose.
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

module.exports = {
  // Same compiler settings as Safe's release of this module
  // (safe-modules tag recovery/v0.1.0, modules/recovery/hardhat.config.ts).
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 1_000_000 }, viaIR: true },
  },
  networks: { hardhat: { chainId: 31337 } },
  mocha: { timeout: 30 * 60 * 1000 },
};
