import { createPartnerRuntime } from './runtime.ts';
const port = Number(process.env.PARTNER_PORT ?? 4002);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PARTNER_PORT');
const runtime = createPartnerRuntime();
runtime.server.listen(port, process.env.PARTNER_HOST ?? '127.0.0.1', () => {
  console.log(`MOCK partner service listening on port ${port}; chain ${runtime.chainId}. Plain local guardian storage is a MOCK HSM.`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  runtime.server.close(() => { runtime.store.close(); });
});
