// Public fixture keys only; never attach to or reset an existing demo.
import { launchLocal } from './scripts/v3-local.mjs';
if (process.argv.length > 2) throw new Error('The isolated local demo accepts no arguments');
try { await launchLocal(); } catch (error) { console.error(error.message); process.exitCode = 1; }
