// Server HTTP: la pagina web (file statici) e l'API REST per il frontend, senza autenticazione.
//
//   GET  /api/state[?since=n]  vista della partita + eventi con seq > n
//   POST /api/tools/:name      chiama un tool, body JSON con gli argomenti
//   POST /api/reset            nuova partita

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const MAX_BODY = 64 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createHttpServer(engine, { publicDir }) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) await api(engine, req, res, url);
      else await serveStatic(publicDir, req, res, url);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) json(res, status, { ok: false, error: status === 500 ? 'Errore interno.' : e.message });
      else res.end();
    }
  });
}

async function api(engine, req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  if (route === 'GET /api/state') {
    const since = Number(url.searchParams.get('since') ?? 0);
    if (!Number.isInteger(since) || since < 0) throw new HttpError(400, '"since" deve essere un intero >= 0.');
    return json(res, 200, engine.snapshot({ since }));
  }
  if (route === 'POST /api/reset') {
    engine.reset();
    return json(res, 200, engine.snapshot());
  }
  const tool = url.pathname.match(/^\/api\/tools\/([a-z_]+)$/);
  if (tool && req.method === 'POST') {
    const result = engine.call(tool[1], await readJson(req), 'http');
    return json(res, 200, result);
  }
  throw new HttpError(404, `Endpoint sconosciuto: ${route}.`);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw new HttpError(413, 'Body troppo grande.');
  }
  if (!body.trim()) return {};
  try {
    const v = JSON.parse(body);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new HttpError(400, 'Il body deve essere un oggetto JSON.');
  }
}

async function serveStatic(publicDir, req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Metodo non ammesso.');
  let rel;
  try {
    rel = decodeURIComponent(url.pathname).replace(/\/$/, '/index.html');
  } catch {
    throw new HttpError(400, 'Percorso non valido.');
  }
  const file = normalize(join(publicDir, rel));
  if (!file.startsWith(publicDir + sep)) throw new HttpError(404, 'Non trovato.');
  let data;
  try {
    data = await readFile(file);
  } catch {
    throw new HttpError(404, 'Non trovato.');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(req.method === 'HEAD' ? undefined : data);
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
