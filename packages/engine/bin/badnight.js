#!/usr/bin/env node
// Avvia l'engine: carica il livello, serve la pagina web e il WebSocket, stampa il link.
// Uso: badnight [--level file.yaml] [--port 3000] [--host 127.0.0.1]

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { LevelError, loadLevelFile } from '@badnight/level';
import { createEngine, createHttpServer, devAgent } from '../src/index.js';

const PORT_ATTEMPTS = 10;
const SHUTDOWN_TIMEOUT = 3000;

// `pnpm start -- --port 3100` passa anche il `--`: lo ignoriamo.
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();

const { values: opts } = parseArgs({
  args,
  options: {
    level: { type: 'string', default: fileURLToPath(new URL('../levels/level-0.yaml', import.meta.resolve('@badnight/level'))) },
    port: { type: 'string', default: '3000' },
    host: { type: 'string', default: '127.0.0.1' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (opts.help) {
  console.log('Uso: badnight [--level file.yaml] [--port 3000] [--host 127.0.0.1]');
  process.exit(0);
}

let level;
try {
  level = await loadLevelFile(opts.level);
} catch (e) {
  console.error(e instanceof LevelError ? e.message : `Impossibile leggere ${opts.level}: ${e.message}`);
  process.exit(1);
}

// Finché l'agente AI non è collegato, risponde l'agente di sviluppo (comandi testuali).
const engine = createEngine(level, { agent: devAgent });
const server = createHttpServer(engine, { publicDir: fileURLToPath(new URL('../public', import.meta.url)) });

// Se la porta è occupata prova le successive.
const listen = (port) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, opts.host, () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });

let port = Number(opts.port);
for (let i = 1; ; i++) {
  try {
    port = await listen(port);
    break;
  } catch (e) {
    if (e.code !== 'EADDRINUSE' || i === PORT_ATTEMPTS) {
      console.error(`Impossibile avviare il server: ${e.message}`);
      process.exit(1);
    }
    port++;
  }
}

const host = opts.host.includes(':') ? `[${opts.host}]` : opts.host;
console.log(`\n  BadNight — ${level.title}\n\n  Apri http://${host}:${port}\n`);

// Ctrl+C: chiude WebSocket e server. Se qualcosa resta appeso esce comunque dopo SHUTDOWN_TIMEOUT;
// un secondo Ctrl+C esce subito.
let stopping = false;
function stop() {
  if (stopping) process.exit(1);
  stopping = true;
  console.log('\n  Arresto in corso…');
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT).unref();
  server.shutdown().then(() => process.exit(0));
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
