import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createGame, loadLevelFile } from '../src/index.js';

const level = await loadLevelFile(fileURLToPath(new URL('../levels/level-1.yaml', import.meta.url)));

test('il livello 1 si completa con la soluzione prevista', () => {
  const game = createGame(level);
  const steps = [
    ['act', { target: 'comodino', action: 'apri' }],
    ['act', { target: 'zucca', action: 'inserisci_candela' }],
    ['act', { target: 'conte_sbadiglio', action: 'chiedi_luce' }],
    ['act', { target: 'letto', action: 'guarda_sotto' }],
    ['act', { target: 'cestino', action: 'cerca' }],
    ['act', { target: 'pipistrello_peluche', action: 'offri_caramella' }],
    ['act', { target: 'porta', action: 'apri' }],
    ['move', { to: 'salone' }],
    ['act', { target: 'tavolino', action: 'scegli_dritto' }],
    ['act', { target: 'ernesto', action: 'mostra_ritratto' }],
    ['act', { target: 'pianoforte', action: 'premi_zucca' }],
    ['act', { target: 'pianoforte', action: 'premi_fantasma' }],
    ['act', { target: 'pianoforte', action: 'premi_pipistrello' }],
    ['move', { to: 'camera_genitori' }],
  ];
  const results = steps.map(([tool, args]) => game.call(tool, args));
  for (const result of results) {
    assert.equal(result.ok, true, result.error);
    assert.equal(Object.hasOwn(result.changes, 'inventory'), false);
  }
  assert.equal(Object.hasOwn(game.state, 'inventory'), false);
  assert.equal(Object.hasOwn(game.look(), 'inventory'), false);
  assert.equal(Object.hasOwn(level, 'items'), false);

  assert.deepEqual(results[6].changes, {
    states: [{ id: 'porta', name: 'Porta', asset: 'object_porta_cameretta', from: 'chiusa', to: 'aperta' }],
    hidden: [{ id: 'chiave', name: 'Chiave di ferro', asset: 'item_chiave' }],
    milestones: [{ id: 'porta_aperta', description: 'La porta della cameretta è aperta.' }],
    exitsUnlocked: [{ from: 'cameretta', to: 'salone' }],
  });
  assert.deepEqual(results.at(-1).changes, {
    room: { id: 'camera_genitori', name: 'Camera dei genitori', asset: 'room_camera_genitori' },
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
  assert.equal(game.look().objects.some((o) => o.id === 'chiave'), false);
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
    error: 'Qui non c\'è "pianoforte". Puoi scegliere tra: comodino, zucca, cestino, letto, porta, conte_sbadiglio, pip.',
  });
  assert.equal(game.call('act', { target: 'porta', action: 'sfonda' }).error, 'Con Porta puoi fare: apri.');
  assert.equal(game.call('move', { to: 'soffitta' }).error, 'Da qui non si va a "soffitta". Uscite: salone.');
  assert.equal(game.call('act', { target: 'porta' }).error, 'Manca il parametro "action".');
  assert.equal(game.call('dance').ok, false);
  assert.equal(game.call('talk', { ghost: 'comodino' }).ok, false);
});

test('examine mostra stato e azioni degli oggetti visibili nella stanza', () => {
  const game = createGame(level);
  assert.deepEqual(game.examine('comodino').target, {
    id: 'comodino',
    kind: 'object',
    name: 'Comodino',
    asset: 'object_comodino',
    description: 'Il comodino accanto al letto, con un cassetto. Il cassetto è chiuso.',
    state: 'chiuso',
    actions: [{ name: 'apri', description: 'Aprire il cassetto.' }],
  });
  assert.equal(game.examine('candela').ok, false);
  assert.deepEqual(game.act('comodino', 'apri').changes.revealed, [
    { id: 'candela', name: 'Mozzicone di candela', asset: 'item_candela' },
  ]);
  assert.equal(game.examine('candela').target.kind, 'object');
});

test('talk rivela solo le informazioni sbloccate', () => {
  const game = createGame(level);
  const before = game.talk('pip');
  assert.equal(before.ghost.name, 'Pip');
  assert.equal(before.knowledge.length, 1);

  game.act('comodino', 'apri');
  game.act('zucca', 'inserisci_candela');
  game.act('conte_sbadiglio', 'chiedi_luce');
  assert.deepEqual(game.talk('pip').knowledge, before.knowledge);
  game.act('letto', 'guarda_sotto');
  assert.deepEqual(game.talk('pip').knowledge, [
    ...before.knowledge,
    'Il pipistrello mangia solo dolci per giocattoli; quelli veri gli fanno male alle cuciture.',
  ]);
});

test('lo stato salvato permette di riprendere la partita', () => {
  const game = createGame(level);
  game.act('comodino', 'apri');
  const saved = JSON.parse(JSON.stringify(game.state));
  const resumed = createGame(level, { state: saved });
  assert.deepEqual(resumed.look(), game.look());
  assert.equal(Object.hasOwn(saved, 'inventory'), false);
  assert.equal(resumed.examine('candela').target.asset, 'item_candela');
  assert.equal(resumed.act('comodino', 'apri').text, 'Il cassetto è già aperto.');
});

test('a partita finita act e move sono rifiutati', () => {
  const game = createGame(level, {
    state: { ...createGame(level).state, room: 'camera_genitori', won: true },
  });
  assert.equal(game.move('salone').ok, false);
  assert.equal(game.talk('nonno_fosco').ok, true);
});

test('asset: il livello assegna un identificativo a ogni elemento visualizzabile', () => {
  for (const entry of [...Object.values(level.rooms), ...Object.values(level.entities)]) {
    assert.match(entry.asset, /^[a-z][a-z0-9_]*$/, entry.id);
  }
});

test('asset: i tool espongono gli identificativi senza rivelare oggetti nascosti', () => {
  const game = createGame(level);
  const view = game.look();
  assert.equal(view.room.asset, 'room_cameretta');
  assert.equal(view.objects.find((entry) => entry.id === 'zucca').asset, 'object_zucca');
  assert.equal(view.ghosts.find((entry) => entry.id === 'conte_sbadiglio').asset, 'ghost_conte_sbadiglio');
  assert.equal(view.objects.some((entry) => entry.id === 'pipistrello_peluche'), false);
  assert.equal(game.examine('pipistrello_peluche').ok, false);
  assert.equal(game.examine('comodino').target.asset, 'object_comodino');
  assert.equal(game.talk('conte_sbadiglio').ghost.asset, 'ghost_conte_sbadiglio');

  const opened = game.act('comodino', 'apri');
  assert.equal(opened.changes.revealed[0].asset, 'item_candela');
  assert.equal(opened.changes.states[0].asset, 'object_comodino');
  assert.equal(game.look().objects.find((entry) => entry.id === 'candela').asset, 'item_candela');
  assert.equal(game.examine('candela').target.asset, 'item_candela');
  assert.equal(game.act('zucca', 'inserisci_candela').changes.hidden[0].asset, 'item_candela');
  assert.equal(game.examine('candela').ok, false);
  game.act('conte_sbadiglio', 'chiedi_luce');
  assert.equal(game.act('letto', 'guarda_sotto').changes.revealed[0].asset, 'object_pipistrello_peluche');
  assert.equal(game.examine('pipistrello_peluche').target.asset, 'object_pipistrello_peluche');
  assert.equal(game.act('cestino', 'cerca').changes.revealed[0].asset, 'item_caramella_finta');
  game.act('pipistrello_peluche', 'offri_caramella');
  game.act('porta', 'apri');
  assert.equal(game.move('salone').changes.room.asset, 'room_salone');
  assert.equal(game.look().room.asset, 'room_salone');
  assert.equal(level.entities.pipistrello_peluche.room, 'cameretta');
  assert.equal(game.examine('pipistrello_peluche').ok, false);
  assert.equal(game.act('pipistrello_peluche', 'offri_caramella').ok, false);
  game.move('cameretta');
  assert.equal(game.examine('pipistrello_peluche').ok, true);
});

test('asset: i livelli senza riferimenti mantengono le risposte precedenti', () => {
  const legacy = structuredClone(level);
  for (const entry of [...Object.values(legacy.rooms), ...Object.values(legacy.entities)]) {
    delete entry.asset;
  }
  const game = createGame(legacy);
  assert.equal(Object.hasOwn(game.look().room, 'asset'), false);
  assert.equal(Object.hasOwn(game.examine('comodino').target, 'asset'), false);
  assert.equal(Object.hasOwn(game.talk('pip').ghost, 'asset'), false);
  assert.deepEqual(game.act('comodino', 'apri').changes.revealed, [
    { id: 'candela', name: 'Mozzicone di candela' },
  ]);
  assert.equal(Object.hasOwn(game.examine('candela').target, 'asset'), false);
});

test('gli enigmi della cameretta richiedono le scoperte e non duplicano gli oggetti', () => {
  const game = createGame(level);
  assert.deepEqual(game.act('zucca', 'inserisci_candela').changes, {});
  assert.deepEqual(game.act('conte_sbadiglio', 'chiedi_luce').changes, {});
  assert.deepEqual(game.act('porta', 'apri').changes, {});
  game.act('comodino', 'apri');
  game.act('zucca', 'inserisci_candela');
  assert.deepEqual(game.act('comodino', 'apri').changes, {});
  assert.equal(game.examine('candela').ok, false);
  game.act('conte_sbadiglio', 'chiedi_luce');
  game.act('letto', 'guarda_sotto');
  assert.deepEqual(game.act('pipistrello_peluche', 'offri_caramella').changes, {});
  assert.equal(game.examine('chiave').ok, false);
  game.act('cestino', 'cerca');
  const offered = game.act('pipistrello_peluche', 'offri_caramella');
  assert.deepEqual(offered.changes.revealed.map((entry) => entry.id), ['chiave']);
  assert.deepEqual(offered.changes.hidden.map((entry) => entry.id), ['caramella_finta']);
  assert.equal(game.examine('chiave').ok, true);
  assert.equal(game.examine('caramella_finta').ok, false);
  assert.deepEqual(game.act('cestino', 'cerca').changes, {});
  assert.deepEqual(game.act('pipistrello_peluche', 'offri_caramella').changes, {});
  game.act('porta', 'apri');
  assert.equal(game.examine('chiave').ok, false);
  assert.deepEqual(game.act('porta', 'apri').changes, {});
});

test('ritratti e pianoforte consentono di correggere gli errori senza saltare gli enigmi', () => {
  const game = createGame(level);
  for (const [target, action] of [
    ['comodino', 'apri'], ['zucca', 'inserisci_candela'], ['conte_sbadiglio', 'chiedi_luce'],
    ['letto', 'guarda_sotto'], ['cestino', 'cerca'], ['pipistrello_peluche', 'offri_caramella'],
    ['porta', 'apri'],
  ]) game.act(target, action);
  game.move('salone');
  assert.equal(game.examine('spartito').ok, false);
  assert.deepEqual(game.act('libreria', 'cerca').changes, {});
  assert.deepEqual(game.act('ernesto', 'mostra_ritratto').changes, {});
  for (const symbol of ['zucca', 'fantasma', 'pipistrello']) {
    assert.deepEqual(game.act('pianoforte', `premi_${symbol}`).changes, {});
  }
  for (const direction of ['sinistra', 'destra']) {
    game.act('tavolino', `scegli_${direction}`);
    assert.match(game.act('ernesto', 'mostra_ritratto').text, /storto/);
    assert.equal(game.examine('spartito').ok, false);
  }
  game.act('tavolino', 'scegli_dritto');
  assert.equal(game.act('ernesto', 'mostra_ritratto').changes.revealed[0].id, 'spartito');
  assert.equal(game.examine('spartito').target.asset, 'item_spartito');
  assert.equal(game.examine('ritratto_dritto').ok, true);
  assert.deepEqual(game.act('ernesto', 'mostra_ritratto').changes, {});
  assert.deepEqual(game.act('tavolino', 'scegli_sinistra').changes, {});
  for (const wrong of ['zucca', 'pipistrello']) {
    game.act('pianoforte', 'premi_zucca');
    game.act('pianoforte', `premi_${wrong}`);
    assert.equal(game.examine('pianoforte').target.state, 'inizio');
    assert.equal(game.look().exits.find((exit) => exit.to === 'camera_genitori').open, false);
  }
  game.act('pianoforte', 'premi_fantasma');
  assert.equal(game.examine('pianoforte').target.state, 'inizio');
  for (const symbol of ['zucca', 'fantasma', 'pipistrello']) game.act('pianoforte', `premi_${symbol}`);
  assert.equal(game.look().exits.find((exit) => exit.to === 'camera_genitori').open, true);
  assert.deepEqual(game.act('pianoforte', 'premi_zucca').changes, {});
});
