# Recovery tool integration (lane D)

Package: `@sq/recovery-tool`. Commands: `dev` on port 5174, `build`, `typecheck`, `test`. Production build writes `dist/index.html`: a portable HTML with scripts/styles inline, no remote assets. HTTP dev and preview servers emit `Content-Security-Policy: frame-ancestors 'none'`; this directive cannot be enforced by a meta tag for saved files.

Flows: generate/print a 12-word card; verify setup code by deriving card guardian locally and rebuilding CREATE2; verify request hash against chain before signing a card approval; open encrypted emergency kit offline. No service endpoints or helper private keys.

Consumes `@sq/protocol` via `src/protocol.ts`, an explicit integration adapter. The adapter now follows the published [EXPORTS.md](../../packages/protocol/EXPORTS.md) signatures. Tool public exports live in `src/core.ts`: input validation and checked flows. Code formats follow build-plan §7, bigint fields are decimal strings.

Two public RPC checks must both succeed and agree. Local development may pin two distinct loopback URLs via VITE_RPC_URLS; production pins Sepolia providers. No network calls during card creation or emergency-kit opening. Approval requires review followed by explicit confirmation.

MOCK caveat: independent publisher is a demo arrangement, not an audited or content-addressed production publisher. Secrets remain in page memory only and are cleared by reset/reload; no storage or telemetry.
