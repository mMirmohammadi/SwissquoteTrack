# Sepolia story evidence

`scripts/story-sepolia.ts` writes one JSON file here per live run: `<mode>-<UTC timestamp>.json`
(`full-…` or `b-pending-…`). Each file lists every step with its status, transaction hash,
`https://sepolia.etherscan.io/tx/<hash>` link, block number and key values. A run passed when the
file's `status` is `success` and every step is `success`.

These files hold no secrets and are safe to commit. The throwaway keys of each run are stored
separately in `swissquote-wallet/.sepolia-runs/` (mode 600, git-ignored); never copy them here.

A `b-pending` file proves that a recovery through module B (3-day delay) was started and is still
pending. It does not show a finished recovery; anyone can finalize it after the `executeAfter` time
recorded in the file.
