import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LevelError, parseLevel } from '../src/index.js';

const base = `
id: test
title: Test
start: a
goal: b
rooms:
  a:
    name: A
    description: Stanza A.
    exits:
      b: { requires: [m2] }
    milestones:
      m1: { requires: [m2] }
      m2: { requires: [m1] }
  b:
    name: B
    description: Stanza B.
`;

function errorsOf(source) {
  try {
    parseLevel(source);
  } catch (e) {
    assert.ok(e instanceof LevelError);
    return e.errors;
  }
  assert.fail('il livello doveva essere rifiutato');
}

test('rileva i cicli nei prerequisiti dei traguardi', () => {
  assert.deepEqual(errorsOf(base), ['milestones: ciclo nei prerequisiti: m1 → m2 → m1']);
});

test('segnala riferimenti sconosciuti, chiavi sconosciute e stati non dichiarati', () => {
  const errors = errorsOf(`
id: test
title: Test
start: a
goal: z
rooms:
  a:
    name: A
    description: Stanza A.
    colour: blu
    objects:
      scatola:
        name: Scatola
        states: { chiusa: null, aperta: null }
        actions:
          apri:
            - if: { visited: soffitta }
              text: Ok.
              effects:
                - set_state: { scatola: rotta }
                - complete: boh
                - teleport: b
`);
  assert.deepEqual(errors, [
    'rooms.a: chiave sconosciuta "colour" (ammesse: name, description, milestones, exits, objects, ghosts, asset)',
    'rooms.a.objects.scatola.actions.apri.outcomes[0].effects[2]: effetto sconosciuto "teleport" (ammessi: set_state, complete, reveal, hide)',
    'goal: stanza sconosciuta "z"',
    'rooms.a.objects.scatola.actions.apri.outcomes[0].if.visited: stanza sconosciuta "soffitta"',
    'rooms.a.objects.scatola.actions.apri.outcomes[0].effects[0]: "scatola" non ha lo stato "rotta" (stati: chiusa, aperta)',
    'rooms.a.objects.scatola.actions.apri.outcomes[0].effects[1]: traguardo sconosciuto "boh"',
  ]);
});

test('rifiuta YAML malformato', () => {
  assert.match(errorsOf('rooms: [unclosed')[0], /YAML non valido/);
});

const assetSource = `
id: assets
title: Assets
start: a
goal: b
rooms:
  a:
    name: A
    description: Stanza A.
    asset: room_a
    objects:
      zucca: { name: Zucca, asset: object_zucca }
    ghosts:
      pip: { name: Pip, personality: Giocherellone, asset: ghost_pip }
  b:
    name: B
    description: Stanza B.
`;

test('conserva gli asset di stanze, oggetti e fantasmi', () => {
  const level = parseLevel(assetSource);
  assert.equal(level.rooms.a.asset, 'room_a');
  assert.equal(level.entities.zucca.asset, 'object_zucca');
  assert.equal(level.entities.pip.asset, 'ghost_pip');
  assert.equal(Object.hasOwn(level.rooms.b, 'asset'), false);
});

test('gli asset sono facoltativi e devono essere identificativi logici validi', () => {
  for (const id of ['room_a', 'object_zucca', 'ghost_pip']) {
    for (const invalid of ['null', '42', '""', '[]', '{}', 'images/asset.png', 'Asset']) {
      const errors = errorsOf(assetSource.replace(`asset: ${id}`, `asset: ${invalid}`));
      assert.equal(errors.length, 1);
      assert.match(errors[0], /\.asset: deve essere un id asset/);
    }
  }
  const level = parseLevel(assetSource.replaceAll(/,? asset: \w+/g, ''));
  assert.equal(Object.hasOwn(level.entities.zucca, 'asset'), false);
  assert.equal(Object.hasOwn(level.entities.pip, 'asset'), false);
});

test('rifiuta le strutture di inventario non supportate', () => {
  assert.match(errorsOf(`${assetSource}\nitems: {}`)[0], /livello: chiave sconosciuta "items"/);
  const source = assetSource.replace(
    'zucca: { name: Zucca, asset: object_zucca }',
    `zucca:
        name: Zucca
        actions:
          apri:
            - if: { has: mancante }
              text: Ok.
              effects:
                - give: mancante
                - remove: mancante`,
  );
  assert.deepEqual(errorsOf(source), [
    'rooms.a.objects.zucca.actions.apri.outcomes[0].effects[0]: effetto sconosciuto "give" (ammessi: set_state, complete, reveal, hide)',
    'rooms.a.objects.zucca.actions.apri.outcomes[0].effects[1]: effetto sconosciuto "remove" (ammessi: set_state, complete, reveal, hide)',
    'rooms.a.objects.zucca.actions.apri.outcomes[0].if.has: condizione sconosciuta (ammesse: completed, visited, state, not, all, any)',
  ]);
});

test('rifiuta id condivisi tra oggetti e fantasmi', () => {
  const errors = errorsOf(assetSource.replace('pip: { name: Pip', 'zucca: { name: Pip'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /rooms\.a\.ghosts\.zucca: id "zucca"/);
});
