import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEmphasis, plainText } from '../src/emphasis.js';

test('riconosce grassetto e corsivo e toglie i marcatori dal testo visibile', () => {
  const text = 'Vedi il **comodino**, la **zucca senza sorriso** e *Pip* che ride.';
  assert.deepEqual(parseEmphasis(text), [
    { text: 'Vedi il ' },
    { text: 'comodino', tag: 'strong' },
    { text: ', la ' },
    { text: 'zucca senza sorriso', tag: 'strong' },
    { text: ' e ' },
    { text: 'Pip', tag: 'em' },
    { text: ' che ride.' },
  ]);
  assert.equal(plainText(parseEmphasis(text)), 'Vedi il comodino, la zucca senza sorriso e Pip che ride.');
});

test('lascia come testo gli asterischi senza coppia e il markup HTML', () => {
  assert.deepEqual(parseEmphasis('3 * 4 fa 12, ** non chiuso'), [{ text: '3 * 4 fa 12, ** non chiuso' }]);
  assert.deepEqual(parseEmphasis('**<img src=x onerror=alert(1)>**'), [{ text: '<img src=x onerror=alert(1)>', tag: 'strong' }]);
  assert.deepEqual(parseEmphasis(''), []);
});
