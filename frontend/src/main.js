// Collega la pagina all'engine. Il protocollo è in packages/engine/README.md.

import { connect } from './socket.js';
import { createTurn } from './turn.js';
import { createStory } from './story.js';
import { createRoom } from './room.js';
import { playNarrationSound, playTypingSound, setAudioEnabled, setVolume } from './sound.js';

const $ = (id) => document.getElementById(id);

const form = $('prompt');
const text = $('text');
const resetButton = $('reset');
const art = $('art');
const audioToggle = $('audio-toggle');
const welcome = $('welcome');
const welcomeAudio = $('welcome-audio');
const startGame = $('start-game');

const turn = createTurn({ text, send: $('send'), reset: resetButton, status: $('status') });
const story = createStory($('story'), { typeSound: playNarrationSound });
const room = createRoom({
  levelTitle: $('level-title'),
  roomName: $('room-name'),
  progress: $('progress'),
  exits: $('exits'),
  milestones: $('milestones'),
});

function updateAudioControls(enabled) {
  audioToggle.setAttribute('aria-pressed', String(enabled));
  audioToggle.textContent = enabled ? 'Audio attivo' : 'Attiva audio';
  welcomeAudio.checked = enabled;
}

function chooseAudio(enabled) {
  const active = setAudioEnabled(enabled);
  updateAudioControls(active);
}

audioToggle.addEventListener('click', () => {
  chooseAudio(audioToggle.getAttribute('aria-pressed') !== 'true');
});

welcomeAudio.addEventListener('change', () => chooseAudio(welcomeAudio.checked));
startGame.addEventListener('click', () => {
  if (startGame.disabled) return;
  chooseAudio(welcomeAudio.checked);
  startGame.disabled = true;
  welcome.classList.add('is-opening');

  let entered = false;
  const enterGame = () => {
    if (entered) return;
    entered = true;
    welcome.close();
    story.startNarration();
    turn.lock('la storia prende vita…');
    if (engineReady) story.whenIdle(() => turn.ready());
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    enterGame();
    return;
  }

  const door = $('door-leaf');
  const fallback = setTimeout(enterGame, 1300);
  door.addEventListener('transitionend', (event) => {
    if (event.target !== door || event.propertyName !== 'transform') return;
    clearTimeout(fallback);
    enterGame();
  }, { once: true });
});

welcome.showModal();

for (const channel of ['master', 'music', 'typing', 'narration']) {
  const slider = $(`volume-${channel}`);
  const output = $(`volume-${channel}-value`);
  slider.addEventListener('input', () => {
    const volume = Number(slider.value) / 100;
    output.value = `${slider.value}%`;
    setVolume(channel, volume);
  });
}

// Fa tremare la candela dell'illustrazione mentre l'agente usa i tool.
let stirTimer;
function stir() {
  art.classList.add('stirring');
  clearTimeout(stirTimer);
  stirTimer = setTimeout(() => art.classList.remove('stirring'), 900);
}

let engineReady = false;

const socket = connect(
  {
    state(msg) {
      room.render(msg);
      story.sync(msg);
      turn.setWon(msg.won);
      if (msg.busy) turn.lock();
    },
    ready() {
      engineReady = true;
      if (!welcome.open) story.whenIdle(() => turn.ready());
    },
    input(msg) {
      turn.lock();
      story.add(msg);
    },
    output(msg) {
      story.add(msg);
    },
    tool(msg) {
      stir();
      story.add(msg); // non compare nel racconto, ma conta tra i messaggi della history già mostrati
    },
    error(msg) {
      // Con `seq` è un errore del turno (fa parte della history), senza è un messaggio rifiutato.
      // Un rifiuto arriva solo durante un turno: si resta bloccati fino al suo `ready`.
      if (msg.seq) story.add(msg);
      else story.notice(msg.error);
    },
  },
  {
    onOpen: () => turn.lock('il castello si risveglia…'),
    onClose: () => turn.lock('connessione perduta… la candela si riaccende'),
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
  if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.isComposing && ev.key.length === 1) playTypingSound();
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    submit();
  }
});

resetButton.addEventListener('click', () => {
  if (turn.locked) return;
  turn.lock('una nuova notte cala sul castello…');
  socket.send({ type: 'reset' });
});
