// L'unica partita del server: un solo giocatore, una sola sessione, in memoria.
//
// Un turno: il giocatore invia un testo, l'engine lo passa all'agente AI, l'agente chiama i tool
// di gioco e il tool `respond` per rispondere, poi il turno finisce. Tutto quello che succede
// viene emesso come messaggio ('message') per il frontend; a fine turno arriva { type: 'ready' }
// e il frontend riattiva l'input.

import { EventEmitter } from 'node:events';
import { createGame } from '@badnight/level';
import { createTools } from './tools.js';

const DEFAULT_TURN_TIMEOUT = 120_000;

export function createEngine(level, options) {
  return new Engine(level, options);
}

export class Engine extends EventEmitter {
  #level;
  #game;
  #history = [];
  #busy = false;
  #agent;
  #turnTimeout;

  // agent: async (text, tools) => void. Riceve il testo del giocatore e i tool (vedi tools.js);
  // il turno finisce quando la promise si risolve.
  constructor(level, { agent, turnTimeout = DEFAULT_TURN_TIMEOUT } = {}) {
    super();
    this.#level = level;
    this.#game = createGame(level);
    this.#agent = agent;
    this.#turnTimeout = turnTimeout;
    this.tools = createTools(this);
  }

  get level() {
    return this.#level;
  }

  get game() {
    return this.#game;
  }

  get busy() {
    return this.#busy;
  }

  set agent(agent) {
    this.#agent = agent;
  }

  // Esegue un tool del livello e lo notifica al frontend.
  call(name, args = {}) {
    const result = this.#game.call(name, args);
    this.#emit({ type: 'tool', tool: name, args, result });
    return result;
  }

  // Testo dell'agente per il giocatore (tool `respond`).
  respond(text) {
    this.#emit({ type: 'output', text });
  }

  // Un turno di gioco. Restituisce false (senza fare nulla) se un turno è già in corso.
  async input(text) {
    if (this.#busy) return false;
    this.#busy = true;
    this.#emit({ type: 'input', text });
    let timer;
    try {
      if (!this.#agent) throw new Error('Nessun agente AI collegato.');
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("L'agente non ha risposto in tempo.")), this.#turnTimeout);
      });
      await Promise.race([this.#agent(text, this.tools), timeout]);
    } catch (e) {
      this.#emit({ type: 'error', error: e.message });
    } finally {
      clearTimeout(timer);
      this.#busy = false;
      this.emit('message', this.snapshot());
      this.emit('message', { type: 'ready' });
    }
    return true;
  }

  // Nuova partita. Rifiutata durante un turno.
  reset() {
    if (this.#busy) return false;
    this.#game = createGame(this.#level);
    this.#history = [];
    this.emit('message', this.snapshot());
    return true;
  }

  // Stato completo per il frontend, inviato alla connessione e a fine turno.
  // `history` permette di ricostruire la chat dopo un ricaricamento della pagina.
  snapshot() {
    const L = this.#level;
    const { ok, ...view } = this.#game.look();
    return {
      type: 'state',
      level: { id: L.id, title: L.title, intro: L.intro, outro: L.outro },
      view,
      completed: this.#game.state.completed.map((id) => ({ id, description: L.milestones[id].description })),
      won: this.#game.won,
      busy: this.#busy,
      history: this.#history,
    };
  }

  #emit(msg) {
    msg = { ...msg, seq: this.#history.length + 1, at: new Date().toISOString() };
    this.#history.push(msg);
    this.emit('message', msg);
  }
}
