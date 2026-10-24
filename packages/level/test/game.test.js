import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createGame, loadLevelFile } from '../src/index.js';

const level = await loadLevelFile(fileURLToPath(new URL('../levels/level-1.yaml', import.meta.url)));

test('il livello 1 si completa con la soluzione prevista', () => {
  const game = createGame(level);
  const steps = [
    ['act', { target: 'comodino', action: 'apri' }],
    ['act', { target: 'lady_brina', action: 'chiedi_luce' }],
    ['act', { target: 'letto', action: 'guarda_sotto' }],
    ['act', { target: 'porta', action: 'apri' }],
    ['move', { to: 'salone' }],
    ['act', { target: 'libreria', action: 'cerca' }],
    ['act', { target: 'pianoforte', action: 'suona' }],
    ['move', { to: 'camera_genitori' }],
  ];
  const results = steps.map(([tool, args]) => game.call(tool, args));
  for (const r of results) assert.equal(r.ok, true, r.error);

  assert.deepEqual(results[3].changes, {
    states: [{ id: 'porta', name: 'Porta', from: 'chiusa', to: 'aperta' }],
    inventory: { removed: [{ id: 'chiave', name: 'Chiave di ferro' }] },
    milestones: [{ id: 'porta_aperta', description: 'La porta della cameretta è aperta.' }],
    exitsUnlocked: [{ from: 'cameretta', to: 'salone' }],
  });
  assert.deepEqual(results.at(-1).changes, {
    room: { id: 'camera_genitori', name: 'Camera dei genitori' },
    won: true,
  });
  assert.match(results.at(-1).text, /Buonanotte/);
  assert.equal(game.won, true);
  assert.deepEqual(game.look().progress, { visited: 3, total: 3 });
});

test('un esito che completa un traguardo viene saltato se mancano i prerequisiti', () => {
  const game = createGame(level);
  const r = game.act('letto', 'guarda_sotto');
  assert.equal(r.text, 'È troppo buio per vedere qualcosa là sotto.');
  assert.deepEqual(r.changes, {});
  assert.deepEqual(game.state.inventory, []);
});

test("un'uscita chiusa non sposta il bambino", () => {
  const game = createGame(level);
  assert.deepEqual(game.move('salone'), { ok: true, text: 'La porta è chiusa a chiave.', changes: {} });
  assert.equal(game.state.room, 'cameretta');
  assert.equal(game.look().exits[0].open, false);
});

test('le chiamate non valide spiegano cosa si può fare', () => {
  const game = createGame(level);
  assert.deepEqual(game.call('examine', { target: 'pianoforte' }), {
    ok: false,
    error: 'Qui non c\'è "pianoforte". Puoi scegliere tra: comodino, letto, porta, lady_brina, pip.',
  });
  assert.equal(game.call('act', { target: 'porta', action: 'sfonda' }).error, 'Con Porta puoi fare: apri.');
  assert.equal(game.call('move', { to: 'soffitta' }).error, 'Da qui non si va a "soffitta". Uscite: salone.');
  assert.equal(game.call('act', { target: 'porta' }).error, 'Manca il parametro "action".');
  assert.equal(game.call('dance').ok, false);
  assert.equal(game.call('talk', { ghost: 'comodino' }).ok, false);
});

test('examine mostra stato e azioni, anche per gli oggetti in inventario', () => {
  const game = createGame(level);
  assert.deepEqual(game.examine('comodino').target, {
    id: 'comodino',
    kind: 'object',
    name: 'Comodino',
    description: 'Il comodino accanto al letto, con un cassetto. Il cassetto è chiuso.',
    state: 'chiuso',
    actions: [{ name: 'apri', description: 'Aprire il cassetto.' }],
  });
  game.act('comodino', 'apri');
  assert.equal(game.examine('candela').target.kind, 'item');
});

test('talk rivela solo le informazioni sbloccate', () => {
  const game = createGame(level);
  const before = game.talk('pip');
  assert.equal(before.ghost.name, 'Pip');
  assert.equal(before.knowledge.length, 1);

  game.act('comodino', 'apri');
  game.act('lady_brina', 'chiedi_luce');
  assert.deepEqual(game.talk('pip').knowledge.at(-1), 'La chiave è rotolata sotto il letto.');
});

test('lo stato salvato permette di riprendere la partita', () => {
  const game = createGame(level);
  game.act('comodino', 'apri');
  const saved = JSON.parse(JSON.stringify(game.state));
  const resumed = createGame(level, { state: saved });
  assert.deepEqual(resumed.look().inventory, [{ id: 'candela', name: 'Mozzicone di candela' }]);
  assert.equal(resumed.act('comodino', 'apri').text, 'Il cassetto è già aperto.');
});

test('a partita finita act e move sono rifiutati', () => {
  const game = createGame(level, {
    state: { ...createGame(level).state, room: 'camera_genitori', won: true },
  });
  assert.equal(game.move('salone').ok, false);
  assert.equal(game.talk('nonno_fosco').ok, true);
});
