// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// TEST FIXTURE ONLY. Not part of the system under test and not audited.
//
// Safe.setup(...) delegatecalls its `to`/`data` hook, so inside `configure` the code runs as the new Safe:
// - calling the Safe from itself passes Safe's `authorized` check (enableModule), and
// - calling the recovery module from the Safe passes GuardianStorage's "module enabled" check.
// This puts the whole Candidate B configuration (module, guardians, guardian threshold) into the creation
// initializer, and therefore into the CREATE2 address. T7 uses it for an honest creation and to model
// tampered initializers (extra module, weaker guardian threshold).

interface ISafeSelf {
    function enableModule(address module) external;
}

interface IRecoveryModuleAdmin {
    function addGuardianWithThreshold(address guardian, uint256 threshold) external;
}

contract SetupFixture {
    function configure(
        address[] calldata modules,
        address recoveryModule,
        address[] calldata guardians,
        uint256 guardianThreshold
    ) external {
        for (uint256 i = 0; i < modules.length; i++) {
            ISafeSelf(address(this)).enableModule(modules[i]);
        }
        for (uint256 i = 0; i < guardians.length; i++) {
            uint256 t = i + 1 == guardians.length ? guardianThreshold : 1;
            IRecoveryModuleAdmin(recoveryModule).addGuardianWithThreshold(guardians[i], t);
        }
    }
}
