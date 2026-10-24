// Validazione e normalizzazione del livello letto dal YAML.
// Raccoglie tutti gli errori (con il percorso nel file) invece di fermarsi al primo.

const ID_RE = /^[a-z][a-z0-9_]*$/;
const CONDITIONS = ['completed', 'visited', 'state', 'not', 'all', 'any'];
const EFFECTS = ['set_state', 'complete', 'reveal', 'hide'];

export class LevelError extends Error {
  constructor(errors) {
    super(`Livello non valido:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    this.name = 'LevelError';
    this.errors = errors;
  }
}

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export function validateLevel(raw) {
  if (!isMap(raw)) throw new LevelError(['il livello deve essere una mappa YAML']);

  const errors = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  // I riferimenti (traguardi, oggetti, stanze) si controllano dopo aver letto tutto il file.
  const deferred = [];

  function keys(obj, path, allowed, required = []) {
    if (!isMap(obj)) {
      err(path, 'deve essere una mappa');
      return false;
    }
    for (const k of Object.keys(obj)) {
      if (!allowed.includes(k)) err(path, `chiave sconosciuta "${k}" (ammesse: ${allowed.join(', ')})`);
    }
    for (const k of required) if (obj[k] == null) err(path, `manca "${k}"`);
    return true;
  }

  function text(obj, key, path) {
    const v = obj[key];
    if (v == null) return '';
    if (typeof v !== 'string') err(`${path}.${key}`, 'deve essere un testo');
    return String(v);
  }

  function parseAsset(obj, path) {
    if (!Object.hasOwn(obj, 'asset')) return {};
    if (typeof obj.asset !== 'string' || !ID_RE.test(obj.asset)) {
      err(`${path}.asset`, 'deve essere un id asset: minuscole, cifre e _, iniziando con una lettera');
      return {};
    }
    return { asset: obj.asset };
  }

  function entries(v, path) {
    if (v == null) return [];
    if (!isMap(v)) {
      err(path, 'deve essere una mappa');
      return [];
    }
    return Object.entries(v).filter(([id]) => {
      if (ID_RE.test(id)) return true;
      err(`${path}.${id}`, 'id non valido: usa minuscole, cifre e _, iniziando con una lettera');
      return false;
    });
  }

  function idList(v, path) {
    const ids = asList(v);
    if (ids.every((x) => typeof x === 'string')) return ids;
    err(path, 'deve essere un id o una lista di id');
    return [];
  }

  function refs(ids, table, what, path) {
    for (const id of ids) if (!table[id]) err(path, `${what} "${id}"`);
  }

  function checkState(target, state, path) {
    const e = level.entities[target];
    if (!e) return err(path, `oggetto sconosciuto "${target}"`);
    if (!e.states) return err(path, `"${target}" non dichiara "states"`);
    if (!(state in e.states)) {
      err(path, `"${target}" non ha lo stato "${state}" (stati: ${Object.keys(e.states).join(', ')})`);
    }
  }

  function checkCondition(c, path) {
    if (!isMap(c) || !Object.keys(c).length) return err(path, 'la condizione deve essere una mappa non vuota');
    for (const [k, v] of Object.entries(c)) {
      const p = `${path}.${k}`;
      switch (k) {
        case 'completed':
          refs(idList(v, p), level.milestones, 'traguardo sconosciuto', p);
          break;
        case 'visited':
          refs(idList(v, p), level.rooms, 'stanza sconosciuta', p);
          break;
        case 'state':
          if (!isMap(v)) err(p, 'vuole una mappa { oggetto: stato }');
          else for (const [target, state] of Object.entries(v)) checkState(target, state, p);
          break;
        case 'not':
          checkCondition(v, p);
          break;
        case 'all':
        case 'any':
          if (!Array.isArray(v) || !v.length) err(p, 'vuole una lista non vuota di condizioni');
          else v.forEach((x, i) => checkCondition(x, `${p}[${i}]`));
          break;
        default:
          err(p, `condizione sconosciuta (ammesse: ${CONDITIONS.join(', ')})`);
      }
    }
  }

  function parseEffects(v, path) {
    const effects = [];
    if (v == null) return effects;
    if (!Array.isArray(v)) {
      err(path, 'deve essere una lista di effetti');
      return effects;
    }
    v.forEach((e, i) => {
      const p = `${path}[${i}]`;
      if (!isMap(e) || Object.keys(e).length !== 1) {
        return err(p, `ogni effetto è una mappa con una sola chiave tra: ${EFFECTS.join(', ')}`);
      }
      const [type, arg] = Object.entries(e)[0];
      switch (type) {
        case 'set_state':
          if (!isMap(arg)) return err(p, 'set_state vuole una mappa { oggetto: stato }');
          for (const [target, state] of Object.entries(arg)) {
            effects.push({ type, target, state });
            deferred.push(() => checkState(target, state, p));
          }
          break;
        case 'complete':
          for (const milestone of idList(arg, p)) effects.push({ type, milestone });
          deferred.push(() => refs(idList(arg, p), level.milestones, 'traguardo sconosciuto', p));
          break;
        case 'reveal':
        case 'hide':
          for (const target of idList(arg, p)) effects.push({ type, target });
          deferred.push(() => refs(idList(arg, p), level.entities, 'oggetto o fantasma sconosciuto', p));
          break;
        default:
          err(p, `effetto sconosciuto "${type}" (ammessi: ${EFFECTS.join(', ')})`);
      }
    });
    return effects;
  }

  function parseOutcome(o, path) {
    if (!keys(o, path, ['if', 'text', 'effects'], ['text'])) return null;
    if (o.if != null) deferred.push(() => checkCondition(o.if, `${path}.if`));
    return { if: o.if ?? null, text: text(o, 'text', path), effects: parseEffects(o.effects, `${path}.effects`) };
  }

  // Un'azione è { description?, outcomes: [...] }, oppure direttamente la lista degli esiti.
  function parseActions(v, path) {
    const actions = {};
    for (const [name, a] of entries(v, path)) {
      const p = `${path}.${name}`;
      const def = Array.isArray(a) ? { outcomes: a } : a;
      if (!keys(def, p, ['description', 'outcomes'], ['outcomes'])) continue;
      if (!Array.isArray(def.outcomes) || !def.outcomes.length) {
        err(`${p}.outcomes`, 'deve essere una lista non vuota di esiti');
        continue;
      }
      actions[name] = {
        name,
        description: text(def, 'description', p),
        outcomes: def.outcomes.map((o, i) => parseOutcome(o, `${p}.outcomes[${i}]`)).filter(Boolean),
      };
    }
    return actions;
  }

  keys(raw, 'livello', ['id', 'title', 'intro', 'outro', 'start', 'goal', 'rooms'], ['id', 'title', 'start', 'goal', 'rooms']);

  const level = {
    id: raw.id,
    title: text(raw, 'title', 'livello'),
    intro: text(raw, 'intro', 'livello'),
    outro: text(raw, 'outro', 'livello'),
    start: raw.start,
    goal: raw.goal,
    rooms: {},
    entities: {},
    milestones: {},
  };

  for (const [roomId, r] of entries(raw.rooms, 'rooms')) {
    const p = `rooms.${roomId}`;
    if (!keys(r, p, ['name', 'description', 'milestones', 'exits', 'objects', 'ghosts', 'asset'], ['name', 'description'])) continue;
    const room = {
      id: roomId,
      name: text(r, 'name', p),
      description: text(r, 'description', p),
      ...parseAsset(r, p),
      exits: [],
      objects: [],
      ghosts: [],
    };
    level.rooms[roomId] = room;

    for (const [id, m] of entries(r.milestones, `${p}.milestones`)) {
      const mp = `${p}.milestones.${id}`;
      if (level.milestones[id]) {
        err(mp, `id già usato in rooms.${level.milestones[id].room}`);
        continue;
      }
      if (!keys(m ?? {}, mp, ['description', 'requires'])) continue;
      level.milestones[id] = {
        id,
        room: roomId,
        description: text(m ?? {}, 'description', mp),
        requires: idList(m?.requires, `${mp}.requires`),
      };
    }

    for (const [to, e] of entries(r.exits, `${p}.exits`)) {
      const ep = `${p}.exits.${to}`;
      if (!keys(e ?? {}, ep, ['description', 'requires', 'locked'])) continue;
      room.exits.push({
        to,
        description: text(e ?? {}, 'description', ep),
        requires: idList(e?.requires, `${ep}.requires`),
        locked: text(e ?? {}, 'locked', ep),
      });
    }

    for (const [section, kind] of [['objects', 'object'], ['ghosts', 'ghost']]) {
      for (const [id, e] of entries(r[section], `${p}.${section}`)) {
        const xp = `${p}.${section}.${id}`;
        const allowed = kind === 'object'
          ? ['name', 'description', 'states', 'hidden', 'actions', 'asset']
          : ['name', 'description', 'personality', 'voice', 'knowledge', 'hidden', 'actions', 'asset'];
        if (!keys(e, xp, allowed, kind === 'object' ? ['name'] : ['name', 'personality'])) continue;
        if (level.entities[id]) {
          err(xp, `id "${id}" già usato da un altro oggetto o fantasma`);
          continue;
        }
        if (e.hidden != null && typeof e.hidden !== 'boolean') err(`${xp}.hidden`, 'deve essere true o false');

        const entity = {
          id,
          kind,
          room: roomId,
          name: text(e, 'name', xp),
          description: text(e, 'description', xp),
          ...parseAsset(e, xp),
          hidden: e.hidden === true,
          states: null,
          initialState: null,
          actions: parseActions(e.actions, `${xp}.actions`),
        };

        if (e.states != null) {
          const states = entries(e.states, `${xp}.states`);
          if (!states.length) err(`${xp}.states`, 'serve almeno uno stato (il primo è quello iniziale)');
          entity.states = Object.fromEntries(states.map(([s, d]) => [s, d == null ? '' : text({ d }, 'd', `${xp}.states.${s}`)]));
          entity.initialState = states[0]?.[0] ?? null;
        }

        if (kind === 'ghost') {
          entity.personality = text(e, 'personality', xp);
          entity.voice = text(e, 'voice', xp);
          entity.knowledge = asList(e.knowledge).flatMap((k, i) => {
            const kp = `${xp}.knowledge[${i}]`;
            if (!keys(k, kp, ['if', 'text'], ['text'])) return [];
            if (k.if != null) deferred.push(() => checkCondition(k.if, `${kp}.if`));
            return [{ if: k.if ?? null, text: text(k, 'text', kp) }];
          });
        }

        level.entities[id] = entity;
        room[section].push(id);
      }
    }
  }

  // Riferimenti.
  if (!level.rooms[level.start]) err('start', `stanza sconosciuta "${level.start}"`);
  if (!level.rooms[level.goal]) err('goal', `stanza sconosciuta "${level.goal}"`);
  if (level.start === level.goal) err('goal', 'deve essere diversa da start');

  for (const room of Object.values(level.rooms)) {
    for (const exit of room.exits) {
      const p = `rooms.${room.id}.exits.${exit.to}`;
      if (!level.rooms[exit.to]) err(p, `stanza sconosciuta "${exit.to}"`);
      if (exit.to === room.id) err(p, 'una stanza non può uscire su se stessa');
      refs(exit.requires, level.milestones, 'traguardo sconosciuto', `${p}.requires`);
    }
  }
  for (const m of Object.values(level.milestones)) {
    refs(m.requires, level.milestones, 'traguardo sconosciuto', `rooms.${m.room}.milestones.${m.id}.requires`);
  }
  deferred.forEach((check) => check());

  const cycle = findCycle(level.milestones);
  if (cycle) err('milestones', `ciclo nei prerequisiti: ${cycle.join(' → ')}`);

  if (errors.length) throw new LevelError(errors);
  return deepFreeze(level);
}

// Cerca un ciclo nel grafo dei prerequisiti (DFS a tre colori). Restituisce il ciclo o null.
function findCycle(milestones) {
  const color = {};
  const stack = [];
  const visit = (id) => {
    color[id] = 'grey';
    stack.push(id);
    for (const req of milestones[id].requires) {
      if (!milestones[req]) continue;
      if (color[req] === 'grey') return [...stack.slice(stack.indexOf(req)), req];
      if (!color[req]) {
        const cycle = visit(req);
        if (cycle) return cycle;
      }
    }
    color[id] = 'black';
    stack.pop();
    return null;
  };
  for (const id of Object.keys(milestones)) {
    if (color[id]) continue;
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

function deepFreeze(obj) {
  for (const v of Object.values(obj)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(obj);
}
