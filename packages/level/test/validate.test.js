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
    'rooms.a: chiave sconosciuta "colour" (ammesse: name, description, milestones, exits, objects, ghosts)',
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
