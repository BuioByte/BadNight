// L'unica partita del server: un solo giocatore, una sola sessione, in memoria.
// Ogni chiamata a un tool passa da qui e finisce nel log degli eventi, così il frontend
// vede anche le mosse fatte dall'agente (leggendo gli eventi successivi a quelli che ha già).

import { createGame } from '@badnight/level';

export function createEngine(level) {
  return new Engine(level);
}

export class Engine {
  #level;
  #game;
  #events = [];
  #run = 1;

  constructor(level) {
    this.#level = level;
    this.#game = createGame(level);
  }

  get level() {
    return this.#level;
  }

  get game() {
    return this.#game;
  }

  // Esegue un tool del livello. `source` dice chi l'ha chiamato ('agent', 'http').
  call(name, args = {}, source = 'agent') {
    const result = this.#game.call(name, args);
    this.#events.push({ seq: this.#events.length + 1, at: new Date().toISOString(), source, tool: name, args, result });
    return result;
  }

  // Nuova partita: il log riparte da zero e `run` cambia, così chi legge gli eventi sa che deve ricominciare.
  reset() {
    this.#game = createGame(this.#level);
    this.#events = [];
    this.#run++;
  }

  // Vista per il frontend. `since` è l'ultimo `seq` già letto: restituisce solo gli eventi successivi.
  snapshot({ since = 0 } = {}) {
    const L = this.#level;
    const { ok, ...view } = this.#game.look();
    return {
      run: this.#run,
      level: { id: L.id, title: L.title, intro: L.intro, outro: L.outro },
      view,
      completed: this.#game.state.completed.map((id) => ({ id, description: L.milestones[id].description })),
      won: this.#game.won,
      seq: this.#events.length,
      events: this.#events.slice(since),
    };
  }
}
