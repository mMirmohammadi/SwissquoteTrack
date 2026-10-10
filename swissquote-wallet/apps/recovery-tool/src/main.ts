import './style.css';
import { createCard, checkWallet, reviewRecovery, approveRecovery, openEmergencyKit, checkKitCurrentOwner, checkWalletRules, type RecoveryReview, type ToolConfig } from './core.js';

import { decodeSetupCode } from './protocol.js';
import { validateCodeInput } from './validation.js';

const config: ToolConfig = { chainId: import.meta.env.VITE_CHAIN === 'local' ? 31337 : 11155111, rpcUrls: import.meta.env.VITE_RPC_URLS };
const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id); if (!node) throw new Error(`Missing UI element ${id}`); return node as T;
};
const value = (id: string) => el<HTMLInputElement | HTMLTextAreaElement>(id).value;
let card: ReturnType<typeof createCard> | undefined;
let review: RecoveryReview | undefined;
let generation = 0;
let busy = false;
let openedKit: Awaited<ReturnType<typeof openEmergencyKit>> | undefined;
function status(message: string, state = 'info') { const node = el('status'); node.hidden = false; node.textContent = message; node.dataset.state = state; }
function invalidateReview() { review = undefined; el('review').hidden = true; el<HTMLInputElement>('confirm').checked = false; el<HTMLButtonElement>('sign-button').disabled = true; el('approval-result').hidden = true; el<HTMLTextAreaElement>('approval').value = ''; }
async function run(action: (ticket: number) => Promise<void>) {
  if (busy) return; busy = true; const ticket = generation;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('section button')];
  const disabled = buttons.map(button => button.disabled); buttons.forEach(button => button.disabled = true);
  status('Working locally or checking both public nodes…');
  try { await action(ticket); } catch (error) { if (generation === ticket) status(error instanceof Error ? error.message : 'Action failed. Nothing was approved.', 'error'); }
  finally { busy = false; if (generation === ticket) buttons.forEach((button, index) => button.disabled = disabled[index] ?? false); el<HTMLButtonElement>('sign-button').disabled = !review || !el<HTMLInputElement>('confirm').checked; el<HTMLButtonElement>('check-kit-owner').disabled = !openedKit; }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) button.addEventListener('click', () => {
  for (const section of document.querySelectorAll<HTMLElement>('main > section')) section.hidden = section.id !== button.dataset.tab;
  for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', String(tab === button));
  el('status').hidden = true;
});
el('audit-button').onclick = () => void run(async ticket => {
  const wallet = value('audit-wallet');
  const report = await checkWalletRules(wallet, config);
  if (ticket !== generation || wallet !== value('audit-wallet')) return;
  el('audit-result').textContent = [report.facts.verified ? 'Recognised rules at the pinned block — not an app audit.' : 'Rules unconfirmed.', ...report.answers.map(a => `${a.question} ${a.answer.toUpperCase()}: ${a.explanation}`), 'Observed facts:', ...Object.entries(report.facts).map(([key, v]) => `${key}: ${v}`), 'Limits and warnings:', ...report.warnings].join('\n\n');
  el('audit-result').hidden = false;
  status(report.facts.verified ? 'Read-only rules check complete. Read the limits below.' : 'Rules could not be confirmed.', report.facts.verified ? 'info' : 'error');
});
el('audit-wallet').addEventListener('input', () => { el('audit-result').hidden = true; el('audit-result').textContent = ''; });
// Fragment data is public and is never sent to the server. It opens the no-secret rules pane only.
if (location.hash.startsWith('#check=')) {
  try {
    const setup = decodeSetupCode(validateCodeInput(decodeURIComponent(location.hash.slice(7))));
    el<HTMLInputElement>('audit-wallet').value = setup.wallet;
    document.querySelector<HTMLButtonElement>('[data-tab="check"]')?.click();
  } catch { status('Invalid public check fragment. No secret input was opened.', 'error'); }
}
el('generate').onclick = () => {
  if (card && !window.confirm('Replace this card? The old words will be cleared from this page.')) return;
  card = createCard(); el('words').replaceChildren(...card.words.split(' ').map(word => { const item = document.createElement('li'); item.textContent = word; return item; }));
  el('guardian').textContent = card.guardian; el('card-result').hidden = false; status('Write down or print the words now. They are not saved.');
};
async function copy(text: string) { try { await navigator.clipboard.writeText(text); status('Copied. Clear your clipboard after use.'); } catch { status('Clipboard unavailable. Select and copy the text manually.', 'error'); } }
el('copy-guardian').onclick = () => { if (card) void copy(card.guardian); };
el('print').onclick = () => window.print();
el('check-button').onclick = () => void run(async ticket => {
  const code = value('setup'), words = value('check-words'), currentOwner = value('check-current-owner');
  const result = await checkWallet(code, words, config, undefined, currentOwner);
  if (ticket !== generation || code !== value('setup') || words !== value('check-words') || currentOwner !== value('check-current-owner')) return;
  el<HTMLTextAreaElement>('check-words').value = '';
  status(result.ok ? `Verified: ${result.wallet}. Both RPC checks passed at the recorded state. Original initializer and independently expected current owner were checked separately. Card required on both recovery paths.` : `Not verified: ${result.reasons.join(' ')}`, result.ok ? 'success' : 'error');
});
for (const id of ['setup', 'check-words', 'check-current-owner']) el(id).addEventListener('input', () => { el('status').hidden = true; });
for (const id of ['request', 'approve-words']) el(id).addEventListener('input', invalidateReview);
el('review-button').onclick = () => void run(async ticket => {
  invalidateReview(); const code = value('request'), words = value('approve-words');
  const checked = await reviewRecovery(code, words, config);
  if (ticket !== generation || code !== value('request') || words !== value('approve-words')) return;
  review = checked; el('review-wallet').textContent = checked.request.wallet; el('review-owner').textContent = checked.request.newOwner;
  el('fingerprint').textContent = checked.fingerprint; el('review-module').textContent = checked.request.module; el('review').hidden = false;
  status('Both nodes verified the request hash, current nonce and card guardian. Compare before signing.');
});
el('confirm').onchange = () => { el<HTMLButtonElement>('sign-button').disabled = !review || !el<HTMLInputElement>('confirm').checked; el<HTMLButtonElement>('check-kit-owner').disabled = !openedKit; };
el('sign-button').onclick = () => void run(async ticket => {
  if (!review || !el<HTMLInputElement>('confirm').checked) throw new Error('Review and confirm the fingerprint first.');
  const code = value('request'), words = value('approve-words');
  const approval = await approveRecovery(code, words, config, review);
  if (ticket !== generation || code !== value('request') || words !== value('approve-words')) return;
  el<HTMLTextAreaElement>('approval').value = approval; el('approval-result').hidden = false;
  el<HTMLTextAreaElement>('approve-words').value = ''; review = undefined;
  el('review').hidden = true; status('Card approval signed. No transaction was sent.');
});
el('copy-approval').onclick = () => void copy(value('approval'));
el('open-kit').onclick = () => void run(async ticket => {
  openedKit = undefined; el<HTMLButtonElement>('check-kit-owner').disabled = true;
  el('kit-result').hidden = true; el('seed').textContent = ''; el('kit-owner').textContent = ''; el('kit-state').textContent = 'Decrypted offline. Current ownership is unverified.';
  const file = el<HTMLInputElement>('kit-file').files?.[0]; if (!file || file.size > 100_000) throw new Error('Choose a kit JSON file under 100 KB.');
  const kitCode = value('kit-code');
  const result = await openEmergencyKit(await file.text(), kitCode);
  if (ticket !== generation || file !== el<HTMLInputElement>('kit-file').files?.[0] || kitCode !== value('kit-code')) return;
  openedKit = result; el('seed').textContent = result.mnemonic; el('kit-owner').textContent = result.owner; el('kit-result').hidden = false;
  el<HTMLInputElement>('kit-code').value = ''; status('Kit decrypted offline. Current on-chain ownership was not checked.');
});
el('check-kit-owner').onclick = () => void run(async ticket => {
  if (!openedKit) throw new Error('Decrypt a kit first.');
  const kit = openedKit;
  try {
    const result = await checkKitCurrentOwner(kit, config);
    if (ticket !== generation || openedKit !== kit) return;
    el('kit-state').textContent = `Recorded owner is current at block ${result.blockNumber}. This is an ownership check, not a full wallet-rule audit.`;
    status('Both nodes confirm this kit owner at the same block. Ownership may change later.', 'success');
  } catch (error) {
    if (ticket === generation && openedKit === kit) { el('kit-state').textContent = 'Current ownership NOT confirmed. Do not rely on this seed to send or cancel.'; el('seed').textContent = ''; }
    throw error;
  }
});
for (const id of ['kit-file', 'kit-code']) el(id).addEventListener('input', () => { openedKit = undefined; el('kit-result').hidden = true; el('seed').textContent = ''; el('kit-owner').textContent = ''; el<HTMLButtonElement>('check-kit-owner').disabled = true; });
el('reset').onclick = () => {
  generation++; card = undefined; openedKit = undefined; invalidateReview();
  for (const node of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')) { node.value = ''; if (node instanceof HTMLInputElement && node.type === 'checkbox') node.checked = false; }
  for (const id of ['audit-result','guardian','seed','kit-owner','kit-state','review-wallet','review-owner','fingerprint','review-module']) el(id).textContent = '';
  el('words').replaceChildren(); for (const id of ['card-result','kit-result','audit-result']) el(id).hidden = true;
  for (const button of document.querySelectorAll<HTMLButtonElement>('section button')) button.disabled = false;
  el<HTMLButtonElement>('sign-button').disabled = true; el<HTMLButtonElement>('check-kit-owner').disabled = true; status('Secrets cleared from the page. Printed copies and your clipboard are not cleared.');
};
el('save').onclick = () => {
  if (import.meta.env.DEV) { status('Portable download is available from the built preview, not the Vite development page.', 'error'); return; }
  // Reset the cloned DOM, never serialize secrets or file inputs into the download.
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  for (const node of clone.querySelectorAll('textarea,input')) { node.removeAttribute('value'); node.removeAttribute('checked'); node.textContent = ''; }
  for (const id of ['words','audit-result','guardian','seed','kit-owner','kit-state','review-wallet','review-owner','fingerprint','review-module','status']) { const node = clone.querySelector(`#${id}`); if (node) node.textContent = ''; }
  for (const id of ['card-result','kit-result','audit-result','review','approval-result','status']) clone.querySelector(`#${id}`)?.setAttribute('hidden','');
  for (const section of clone.querySelectorAll<HTMLElement>('main > section')) section.hidden = section.id !== 'card';
  for (const tab of clone.querySelectorAll<HTMLElement>('[data-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === 'card'));
  for (const button of clone.querySelectorAll<HTMLButtonElement>('section button')) button.disabled = ['sign-button', 'check-kit-owner'].includes(button.id);
  const blob = new Blob(['<!doctype html>\n' + clone.outerHTML], { type: 'text/html' }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'swissquote-emergency-tool.html'; link.click(); URL.revokeObjectURL(url);
  status('Saved the tool only—no seed, card words, or kit code. Keep your encrypted kit file separately.');
};
el('network').textContent = config.chainId === 31337 ? 'LOCAL DEVNET · both loopback URLs share one node (not independent operators)' : 'SEPOLIA · two pinned public nodes';
