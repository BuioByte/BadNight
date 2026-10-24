// Stato di una partita e implementazione dei tool.
// Ogni tool restituisce { ok: true, ... } oppure { ok: false, error } se la chiamata non è valida
// (bersaglio inesistente, azione sconosciuta, partita finita). act e move riportano in `changes`
// la variazione di stato.

import { toolDefinitions } from './tools.js';

const GAME_OVER = 'La partita è finita: il bambino è al sicuro nel lettone.';

const fail = (error) => ({ ok: false, error });
const ref = ({ id, name, asset }) => ({ id, name, ...(asset && { asset }) });
const list = (v) => (Array.isArray(v) ? v : [v]);
const exitOpen = (exit, s) => exit.requires.every((m) => s.completed.includes(m));

export function evaluate(cond, s) {
  return Object.entries(cond).every(([k, v]) => {
    switch (k) {
      case 'completed':
        return list(v).every((m) => s.completed.includes(m));
      case 'visited':
        return list(v).every((r) => s.visited.includes(r));
      case 'state':
        return Object.entries(v).every(([e, st]) => s.entities[e].state === st);
      case 'not':
        return !evaluate(v, s);
      case 'all':
        return v.every((c) => evaluate(c, s));
      case 'any':
        return v.some((c) => evaluate(c, s));
      default:
        throw new Error(`condizione sconosciuta "${k}"`);
    }
  });
}

export function initialState(level) {
  return {
    room: level.start,
    visited: [level.start],
    completed: [],
    entities: Object.fromEntries(
      Object.values(level.entities).map((e) => [e.id, { state: e.initialState, hidden: e.hidden }]),
    ),
    won: false,
  };
}

// `state` permette di riprendere una partita salvata (vedi game.state).
export function createGame(level, { state } = {}) {
  return new Game(level, state);
}

export class Game {
  #level;
  #s;

  constructor(level, state) {
    this.#level = level;
    this.#s = state ? structuredClone(state) : initialState(level);
    if (!level.rooms[this.#s.room]) throw new Error(`stato non valido: stanza sconosciuta "${this.#s.room}"`);
  }

  get level() {
    return this.#level;
  }

  // Copia serializzabile in JSON dello stato, da salvare e ripassare a createGame.
  get state() {
    return structuredClone(this.#s);
  }

  get won() {
    return this.#s.won;
  }

  // Esegue un tool per nome, con gli argomenti ricevuti dall'agente.
  call(name, args = {}) {
    const def = toolDefinitions.find((t) => t.name === name);
    if (!def) return fail(`Tool sconosciuto "${name}". Tool disponibili: ${toolDefinitions.map((t) => t.name).join(', ')}.`);
    for (const p of def.parameters?.required ?? []) {
      if (typeof args?.[p] !== 'string' || !args[p]) return fail(`Manca il parametro "${p}".`);
    }
    switch (name) {
      case 'look':
        return this.look();
      case 'examine':
        return this.examine(args.target);
      case 'act':
        return this.act(args.target, args.action);
      case 'move':
        return this.move(args.to);
      case 'talk':
        return this.talk(args.ghost);
    }
  }

  look() {
    const L = this.#level;
    const s = this.#s;
    const room = L.rooms[s.room];
    return {
      ok: true,
      room: { ...ref(room), description: room.description },
      objects: this.#visible(room.objects).map(ref),
      ghosts: this.#visible(room.ghosts).map(ref),
      exits: room.exits.map((e) => ({
        to: e.to,
        name: L.rooms[e.to].name,
        description: e.description,
        open: exitOpen(e, s),
      })),
      progress: { visited: s.visited.length, total: Object.keys(L.rooms).length },
      ...(s.won && { won: true }),
    };
  }

  examine(target) {
    const { target: t, error } = this.#find(target);
    if (error) return fail(error);
    const state = t.states ? this.#s.entities[t.id].state : null;
    return {
      ok: true,
      target: {
        ...ref(t),
        kind: t.kind,
        description: [t.description, state && t.states[state]].filter(Boolean).join(' '),
        ...(state && { state }),
        actions: Object.values(t.actions).map((a) => ({ name: a.name, ...(a.description && { description: a.description }) })),
      },
    };
  }

  act(target, action) {
    if (this.#s.won) return fail(GAME_OVER);
    const { target: t, error } = this.#find(target);
    if (error) return fail(error);
    const a = t.actions[action];
    if (!a) {
      const names = Object.keys(t.actions);
      return fail(names.length ? `Con ${t.name} puoi fare: ${names.join(', ')}.` : `Con ${t.name} non c'è niente da fare.`);
    }
    // Vale il primo esito con condizione vera. Un esito che completa un traguardo è valido
    // solo se i prerequisiti di quel traguardo sono già completati.
    const outcome = a.outcomes.find(
      (o) =>
        (!o.if || evaluate(o.if, this.#s)) &&
        o.effects.every((e) => e.type !== 'complete' || this.#canComplete(e.milestone)),
    );
    if (!outcome) return { ok: true, text: 'Non succede nulla.', changes: {} };
    return this.#apply(() => {
      outcome.effects.forEach((e) => this.#effect(e));
      return outcome.text;
    });
  }

  move(to) {
    if (this.#s.won) return fail(GAME_OVER);
    const L = this.#level;
    const room = L.rooms[this.#s.room];
    const exit = room.exits.find((e) => e.to === to);
    if (!exit) {
      return fail(`Da qui non si va a "${to}". Uscite: ${room.exits.map((e) => e.to).join(', ') || 'nessuna'}.`);
    }
    if (!exitOpen(exit, this.#s)) return { ok: true, text: exit.locked || 'Il passaggio è bloccato.', changes: {} };
    return this.#apply(() => {
      const s = this.#s;
      s.room = to;
      if (!s.visited.includes(to)) s.visited.push(to);
      if (to === L.goal) s.won = true;
      // Il finale (outro) non è nel testo: lo mostra chi presenta la partita, quando changes.won è true.
      return L.rooms[to].description;
    });
  }

  // Non cambia lo stato: fornisce al modulo dei dialoghi la personalità del fantasma, solo le
  // informazioni sbloccate finora e le azioni possibili (per chiedergli di fare qualcosa si usa act).
  talk(ghost) {
    const { target: g, error } = this.#find(ghost, ['ghost']);
    if (error) return fail(error);
    return {
      ok: true,
      ghost: {
        ...ref(g),
        description: g.description,
        personality: g.personality,
        ...(g.voice && { voice: g.voice }),
      },
      knowledge: g.knowledge.filter((k) => !k.if || evaluate(k.if, this.#s)).map((k) => k.text),
      actions: Object.values(g.actions).map((a) => ({ name: a.name, ...(a.description && { description: a.description }) })),
    };
  }

  #visible(ids) {
    return ids.filter((id) => !this.#s.entities[id].hidden).map((id) => this.#level.entities[id]);
  }

  #find(id, kinds = ['object', 'ghost']) {
    const L = this.#level;
    const s = this.#s;
    const e = L.entities[id];
    if (e && kinds.includes(e.kind) && e.room === s.room && !s.entities[id].hidden) return { target: e };
    const room = L.rooms[s.room];
    const candidates = this.#visible([...room.objects, ...room.ghosts])
      .filter((x) => kinds.includes(x.kind))
      .map((x) => x.id);
    return {
      error: `Qui non c'è "${id}". ${candidates.length ? `Puoi scegliere tra: ${candidates.join(', ')}.` : ''}`.trim(),
    };
  }

  #canComplete(milestone) {
    return this.#level.milestones[milestone].requires.every((m) => this.#s.completed.includes(m));
  }

  #effect(e) {
    const s = this.#s;
    switch (e.type) {
      case 'set_state':
        s.entities[e.target].state = e.state;
        break;
      case 'complete':
        if (!s.completed.includes(e.milestone)) s.completed.push(e.milestone);
        break;
      case 'reveal':
        s.entities[e.target].hidden = false;
        break;
      case 'hide':
        s.entities[e.target].hidden = true;
        break;
    }
  }

  #apply(mutate) {
    const prev = structuredClone(this.#s);
    const text = mutate();
    return { ok: true, text, changes: this.#diff(prev, this.#s) };
  }

  #diff(prev, next) {
    const L = this.#level;
    const states = [];
    const revealed = [];
    const hidden = [];
    for (const [id, n] of Object.entries(next.entities)) {
      const p = prev.entities[id];
      const e = L.entities[id];
      if (p.state !== n.state) states.push({ ...ref(e), from: p.state, to: n.state });
      if (p.hidden && !n.hidden) revealed.push(ref(e));
      if (!p.hidden && n.hidden) hidden.push(ref(e));
    }
    const milestones = next.completed
      .filter((m) => !prev.completed.includes(m))
      .map((m) => ({ id: m, description: L.milestones[m].description }));
    const exitsUnlocked = Object.values(L.rooms).flatMap((r) =>
      r.exits.filter((e) => !exitOpen(e, prev) && exitOpen(e, next)).map((e) => ({ from: r.id, to: e.to })),
    );

    return {
      ...(states.length && { states }),
      ...(revealed.length && { revealed }),
      ...(hidden.length && { hidden }),
      ...(milestones.length && { milestones }),
      ...(exitsUnlocked.length && { exitsUnlocked }),
      ...(prev.room !== next.room && { room: ref(L.rooms[next.room]) }),
      ...(next.won && !prev.won && { won: true }),
    };
  }
}
