// Server HTTP: la pagina web (file statici) e il WebSocket per il frontend su /ws.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { attachWebSocket } from './ws.js';

const WS_CLOSE_GRACE = 1000;

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
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export function createHttpServer(engine, { publicDir }) {
  publicDir = resolve(publicDir);
  const server = createServer(async (req, res) => {
    try {
      await serveStatic(publicDir, req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) text(res, 500, 'Errore interno.');
      else res.end();
    }
  });
  const wss = attachWebSocket(server, engine);

  // server.close() aspetta che tutte le connessioni siano chiuse, ma un WebSocket aperto
  // (la pagina nel browser) non si chiude da solo: shutdown() chiude prima i WebSocket,
  // in modo ordinato e poi forzato, e si risolve quando il server è chiuso.
  server.shutdown = () =>
    new Promise((resolve) => {
      server.close(() => resolve());
      for (const ws of wss.clients) ws.close(1001, 'Engine in chiusura');
      server.closeAllConnections();
      setTimeout(() => wss.clients.forEach((ws) => ws.terminate()), WS_CLOSE_GRACE).unref();
    });

  return server;
}

async function serveStatic(publicDir, req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return text(res, 405, 'Metodo non ammesso.');
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html');
  } catch {
    return text(res, 400, 'Percorso non valido.');
  }
  const file = normalize(join(publicDir, rel));
  if (!file.startsWith(publicDir + sep)) return text(res, 404, 'Non trovato.');
  let data;
  try {
    data = await readFile(file);
  } catch {
    return text(res, 404, 'Non trovato.');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(req.method === 'HEAD' ? undefined : data);
}

function text(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}
