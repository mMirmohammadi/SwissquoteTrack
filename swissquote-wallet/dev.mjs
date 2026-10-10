// Always own a fresh v3 chain; --chain is retained as a compatibility alias.
import { launchLocal } from './scripts/v3-local.mjs';
if (process.argv.slice(2).some(arg => arg !== '--chain')) throw new Error('Unsupported local supervisor argument');
try { await launchLocal(); } catch (error) { console.error(error.message); process.exitCode = 1; }
