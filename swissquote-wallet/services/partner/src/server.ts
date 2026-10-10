import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { PartnerError, type PartnerService } from './service.ts';

export interface PartnerServerOptions {
  service: PartnerService;
  allowedOrigins?: readonly string[];
  bodyLimit?: number;
}
async function readBody(req: IncomingMessage, limit: number): Promise<unknown> {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new PartnerError(415, 'Content-Type must be application/json');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > limit) throw new PartnerError(413, 'Request body too large');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new PartnerError(400, 'Invalid JSON body'); }
}
function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
/** Creates the server without listening, reading env, opening storage, or making RPC calls. */
export function createPartnerServer(options: PartnerServerOptions): Server {
  const origins = options.allowedOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const server = createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      if (origin) {
        if (!origins.includes(origin)) throw new PartnerError(403, 'Origin not allowed');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (req.method === 'GET' && req.url === '/health') { send(res, 200, { service: 'partner', mock: true, status: 'ok' }); return; }
      if (req.method !== 'POST' || !['/enroll', '/recovery/approve', '/demo/fooled'].includes(req.url ?? '')) throw new PartnerError(404, 'Endpoint not found');
      const body = await readBody(req, options.bodyLimit ?? 16_384);
      const value = req.url === '/enroll' ? options.service.enroll(body)
        : req.url === '/recovery/approve' ? await options.service.approve(body)
        : options.service.setDemoFooled(body);
      send(res, 200, value);
    } catch (error) {
      send(res, error instanceof PartnerError ? error.status : 500, { error: error instanceof PartnerError ? error.message : 'Partner service failure' });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}
