// Collega la pagina all'engine. Il protocollo è in packages/engine/README.md.

import { connect } from './socket.js';
import { createTurn } from './turn.js';
import { createStory } from './story.js';
import { createRoom } from './room.js';

const $ = (id) => document.getElementById(id);

const form = $('prompt');
const text = $('text');
const resetButton = $('reset');
const art = $('art');

const turn = createTurn({ text, send: $('send'), reset: resetButton, status: $('status') });
const story = createStory($('story'));
const room = createRoom({
  levelTitle: $('level-title'),
  roomName: $('room-name'),
  progress: $('progress'),
  exits: $('exits'),
  milestones: $('milestones'),
});

// Fa tremare la candela dell'illustrazione mentre l'agente usa i tool.
let stirTimer;
function stir() {
  art.classList.add('stirring');
  clearTimeout(stirTimer);
  stirTimer = setTimeout(() => art.classList.remove('stirring'), 900);
}

// L'engine risponde a `reset` solo con `state`, senza `ready`: quello `state` è la risposta e sblocca l'input.
let resetPending = false;

const socket = connect(
  {
    state(msg) {
      room.render(msg);
      story.sync(msg);
      turn.setWon(msg.won);
      if (msg.busy) turn.lock();
      else if (resetPending) {
        resetPending = false;
        turn.ready();
      }
    },
    ready() {
      turn.ready();
    },
    input(msg) {
      turn.lock();
      story.add(msg);
    },
    output(msg) {
      story.add(msg);
    },
    tool() {
      stir();
    },
    error(msg) {
      // Con `seq` è un errore del turno (fa parte della history), senza è un messaggio rifiutato.
      // Un rifiuto arriva solo durante un turno: si resta bloccati fino al suo `ready`.
      if (msg.seq) story.add(msg);
      else {
        resetPending = false;
        story.notice(msg.error);
      }
    },
  },
  {
    onOpen: () => turn.lock('il castello si risveglia…'),
    onClose: () => {
      resetPending = false;
      turn.lock('connessione perduta… la candela si riaccende');
    },
  },
);

function submit() {
  const value = text.value.trim();
  if (turn.locked || !value) return;
  turn.lock();
  if (!socket.send({ type: 'input', text: value })) return turn.lock('connessione perduta… la candela si riaccende');
  text.value = '';
}

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  submit();
});

// Enter invia, Shift+Enter va a capo.
text.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    submit();
  }
});

resetButton.addEventListener('click', () => {
  if (turn.locked) return;
  turn.lock('una nuova notte cala sul castello…');
  resetPending = socket.send({ type: 'reset' });
});
