#!/usr/bin/env node
// Gioca un livello dal terminale chiamando i tool a mano, come farebbe l'agente.
// Uso: npm run play [-- percorso/livello.yaml]

import { createInterface } from 'node:readline';
import { argv, stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createGame, loadLevelFile } from '../src/index.js';

const file = argv[2] ?? fileURLToPath(new URL('../levels/level-1.yaml', import.meta.url));
const game = createGame(await loadLevelFile(file));

const params = { examine: ['target'], act: ['target', 'action'], move: ['to'], talk: ['ghost'] };
const usage = 'Comandi: look | examine <id> | act <id> <azione> | move <stanza> | talk <fantasma> | state | help | quit';

console.log(`\n${game.level.title}\n\n${game.level.intro}\n\n${usage}\n`);

const rl = createInterface({ input: stdin, output: stdout, prompt: '> ' });
rl.prompt();
for await (const line of rl) {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (cmd === 'quit' || cmd === 'exit') break;
  if (cmd === 'help') console.log(usage);
  else if (cmd === 'state') console.dir(game.state, { depth: null, colors: true });
  else if (cmd) {
    const args = Object.fromEntries((params[cmd] ?? []).map((p, i) => [p, rest[i]]));
    const result = game.call(cmd, args);
    console.dir(result, { depth: null, colors: true });
    if (result.changes?.won && game.level.outro) console.log(`\n${game.level.outro}\n`);
  }
  rl.prompt();
}
rl.close();
