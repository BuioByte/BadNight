#!/usr/bin/env node
// Avvia l'engine: carica il livello, serve la pagina web e il WebSocket, stampa il link.
// Uso: badnight [--level file.yaml] [--port 3000] [--host 127.0.0.1] [--agent ai|dev] [--web cartella] [--llm-log file|off]
//
// Con l'agente AI le chiamate al provider si registrano in logs/llm-calls.log (svuotato a ogni avvio);
// --llm-log sceglie un altro file, --llm-log off lo disattiva. In console c'è una riga per ogni turno.
//
// La pagina servita è il frontend compilato (frontend/dist, vedi `pnpm start` nella radice); se non c'è,
// la pagina provvisoria di packages/engine/public. --web sceglie un'altra cartella.
//
// Le chiavi dei provider AI si leggono dall'ambiente o dal file .env nella radice del repo.
// --agent ai usa il harness AI; --agent dev l'agente di sviluppo a comandi testuali. Senza --agent:
// ai se c'è una configurazione del provider (GEMINI_API_KEY o AGENT_PROVIDER), altrimenti dev.

import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { LevelError, loadLevelFile } from '@badnight/level';
import { createAiAgent, createEngine, createHttpServer, describeError, devAgent, startLlmLog } from '../src/index.js';

const USAGE = 'Uso: badnight [--level file.yaml] [--port 3000] [--host 127.0.0.1] [--agent ai|dev] [--web cartella] [--llm-log file|off]';
const LLM_LOG = fileURLToPath(new URL('../../../logs/llm-calls.log', import.meta.url));
const FRONTEND_DIST = fileURLToPath(new URL('../../../frontend/dist', import.meta.url));
const PLACEHOLDER = fileURLToPath(new URL('../public', import.meta.url));
const ENV_FILE = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const PORT_ATTEMPTS = 10;
const SHUTDOWN_TIMEOUT = 3000;

// `pnpm start -- --port 3100` passa anche il `--`: lo ignoriamo.
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();

const { values: opts } = parseArgs({
  args,
  options: {
    level: { type: 'string', default: fileURLToPath(new URL('../levels/level-1.yaml', import.meta.resolve('@badnight/level'))) },
    port: { type: 'string', default: '3000' },
    host: { type: 'string', default: '127.0.0.1' },
    agent: { type: 'string', default: process.env.GEMINI_API_KEY || process.env.AGENT_PROVIDER ? 'ai' : 'dev' },
    web: { type: 'string' },
    'llm-log': { type: 'string', default: LLM_LOG },
    help: { type: 'boolean', short: 'h' },
  },
});

if (opts.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!['ai', 'dev'].includes(opts.agent)) {
  console.error(`--agent deve essere ai o dev.\n${USAGE}`);
  process.exit(1);
}

const webDir = opts.web ? resolve(opts.web) : existsSync(join(FRONTEND_DIST, 'index.html')) ? FRONTEND_DIST : PLACEHOLDER;
if (!existsSync(join(webDir, 'index.html'))) {
  console.error(`Nessuna pagina da servire: manca ${join(webDir, 'index.html')}.`);
  process.exit(1);
}

let level;
try {
  level = await loadLevelFile(opts.level);
} catch (e) {
  console.error(e instanceof LevelError ? e.message : `Impossibile leggere ${opts.level}: ${e.message}`);
  process.exit(1);
}

let agent = devAgent;
let llmLog = null;
if (opts.agent === 'ai') {
  if (opts['llm-log'] !== 'off') {
    llmLog = resolve(opts['llm-log']);
    startLlmLog(llmLog);
  }
  try {
    agent = createAiAgent(level);
  } catch (e) {
    console.error(`Impossibile configurare l'agente AI: ${e.message}\nControlla .env, oppure avvia con --agent dev.`);
    process.exit(1);
  }
}
const engine = createEngine(level, { agent });
// Una riga per turno. Al giocatore arriva un messaggio semplice: qui il dettaglio, per chi sviluppa.
const BUG = [TypeError, ReferenceError, SyntaxError, RangeError];
engine.on('turn', ({ text, ms, tools, error }) => {
  const short = text.length > 60 ? `${text.slice(0, 57)}…` : text;
  const head = `[${new Date().toLocaleTimeString('it-IT')}] turno «${short}» · ${(ms / 1000).toFixed(1)} s · ${tools} tool`;
  if (!error) return console.log(`${head} · ok`);
  let root = error;
  while (root.cause instanceof Error) root = root.cause;
  console.error(`${head} · ERRORE\n  ${describeError(error)}`);
  if (BUG.some((type) => root instanceof type)) console.error(root.stack);
  if (llmLog) console.error(`  chiamate al provider: ${relative(process.cwd(), llmLog)}`);
});
const server = createHttpServer(engine, { publicDir: webDir });

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
const agentName = opts.agent === 'ai' ? `AI (${process.env.AGENT_PROVIDER || 'gemini'})` : 'sviluppo, comandi testuali';
const webName = opts.web ? relative(process.cwd(), webDir) || '.' : webDir === FRONTEND_DIST ? 'frontend (frontend/dist)' : 'provvisoria (frontend non compilato)';
const logLine = llmLog ? `\n  Log LLM: ${relative(process.cwd(), llmLog)} (svuotato a ogni avvio)` : '';
console.log(`\n  BadNight — ${level.title}\n  Agente: ${agentName}\n  Pagina: ${webName}${logLine}\n\n  Apri http://${host}:${port}\n`);

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
