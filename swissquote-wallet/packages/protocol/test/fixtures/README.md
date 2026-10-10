# Public contract fixture

These are public runtime bytes, not private keys. Tests use a protocol-local copy so they do not depend on another lane's installed contracts package.

Safe contracts, Module A and SafeModuleSetup were copied from the existing plan verification fixture, fetched from Sepolia. Module B was copied from its separate three-day Sepolia fixture. Proxy creation/runtime bytecode comes from the installed Safe v1.4.1 artifact. Unit tests compare all bytes against the hashes pinned in the shared constants.

These fixture bytes are test data only. Wallet verification reads actual RPC bytecode and compares its hash; it does not substitute the fixture.
