// Local demo process supervisor. Does not submit public-chain transactions.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const cwd = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(cwd, '.env'))) process.loadEnvFile(path.join(cwd, '.env'));
const args = new Set(process.argv.slice(2));
const processes = [];
const commands = [
  ['Swissquote', 'pnpm', ['--filter', '@sq/swissquote', 'dev']],
  ['Partner', 'pnpm', ['--filter', '@sq/partner', 'dev']],
  ['Wallet', 'pnpm', ['--filter', '@sq/wallet', 'dev']],
  ['Recovery tool', 'pnpm', ['--filter', '@sq/recovery-tool', 'dev']],
];
if (args.has('--chain')) commands.unshift(['Local chain', 'npm', ['--prefix', 'contracts', 'run', 'node']]);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) child.kill('SIGTERM');
}
for (const [label, command, commandArgs] of commands) {
  console.log(`Starting ${label}`);
  const child = spawn(command, commandArgs, { cwd, env: process.env, stdio: 'inherit' });
  processes.push(child);
  child.on('error', (error) => { console.error(`${label} failed: ${error.message}`); stop(1); });
  child.on('exit', (code, signal) => {
    if (!stopping) { console.error(`${label} stopped (${signal ?? code}); stopping remaining demo services.`); stop(code || 1); }
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
