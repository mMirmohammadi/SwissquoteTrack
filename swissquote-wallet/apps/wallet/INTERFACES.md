# Wallet integration hints

Wallet package: `@sq/wallet`, React 19 + Vite 7, port 5173. Scope: this directory only. No install or shared configuration edits.

Browser environment: `VITE_CHAIN=local|sepolia`, `VITE_RPC_URLS` comma-separated, `VITE_SQ_URL` (default http://localhost:4001), `VITE_PARTNER_URL` (default http://localhost:4002). Service JSON uses decimal strings for bigint and Bearer session tokens. Errors surface as errors, never transaction success.

Adapters now consume the actual `@sq/protocol` exports and service JSON contracts. Owner signing uses `signSafeTx`, `hashSafeTx`, `safeTxToWire`; recovery uses request/approval code codecs and helper signatures; setup uses `computeWalletAddress`, `buildWalletInitializer`, one-use `/wallets/challenge`, then `/wallets`. Sign ownership proof text with a lowercase wallet address: the service canonicalizes its registration address before rebuilding the proof text. Services require authenticated passkey enrollment, so Create with a passkey first creates the password account and then enrolls the browser credential. No MOCK transaction-success fallback exists.

The wallet accepts only the card's public address. It never has a card-word input, derivation function, or card seed storage. Independent tool address is plain text, not a navigation link. Private owner material is AES-GCM encrypted in IndexedDB with PBKDF2-SHA256 (600000 iterations); passphrase unlock is distinct from service login.

Please publish exact contracts early. The first checkpoint is a runnable shell; integrated chain actions follow without fake fallback success.
