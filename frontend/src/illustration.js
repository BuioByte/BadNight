// Il riquadro dell'illustrazione: mostra l'immagine più pertinente all'ultima risposta dell'engine,
// scelta dalla chiave `asset` di stanze, oggetti e fantasmi del livello.
//
// Per ogni chiave si usa, in ordine:
//   1. /illustrations/<asset>-<stato>.png o /illustrations/<asset>.png, se esiste (frontend/public/illustrations/);
//   2. il disegno 1-bit in art/drawings.js;
//   3. la zucca ASCII, se la chiave non c'è o non ha né immagine né disegno.

import { drawIllustration } from './art/drawings.js';
import { paint } from './art/bitmap.js';

const pngCache = new Map(); // url -> Promise<boolean>: il file esiste?

function pngExists(url) {
  if (!pngCache.has(url)) {
    pngCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    }));
  }
  return pngCache.get(url);
}

export function createIllustration({ canvas, image, fallback, label }) {
  let known = new Map(); // id -> { id, name, asset, state }
  let current = '';
  let request = 0;

  function remember(ref, state) {
    if (!ref?.id) return null;
    const entry = { ...known.get(ref.id), ...ref };
    if (state !== undefined && state !== null) entry.state = state;
    known.set(ref.id, entry);
    return entry;
  }

  function reveal(el) {
    for (const other of [canvas, image, fallback]) other.hidden = other !== el;
    el.classList.remove('appearing');
    void el.offsetWidth; // riavvia l'animazione di comparsa
    el.classList.add('appearing');
  }

  async function show(ref) {
    const entry = (ref?.id && known.get(ref.id)) || ref;
    const asset = entry?.asset;
    const key = asset ? `${asset}:${entry.state ?? ''}` : '';
    if (key === current) return;
    current = key;
    const mine = ++request;
    label.textContent = asset ? entry.name ?? '' : '';
    if (!asset) return reveal(fallback);

    const urls = [...(entry.state ? [`/illustrations/${asset}-${entry.state}.png`] : []), `/illustrations/${asset}.png`];
    for (const url of urls) {
      if (!(await pngExists(url))) continue;
      if (mine !== request) return;
      image.src = url;
      image.alt = entry.name ?? '';
      return reveal(image);
    }
    if (mine !== request) return;
    const bitmap = drawIllustration(asset, entry.state);
    if (!bitmap) return reveal(fallback);
    paint(canvas, bitmap);
    reveal(canvas);
  }

  // L'elemento più pertinente per una chiamata di tool, o null se l'illustrazione non deve cambiare.
  // Aggiorna intanto ciò che si sa degli elementi (chiave asset, stato).
  function pertinent({ tool, args, result }) {
    if (!result?.ok) return null;
    const changes = result.changes ?? {};
    for (const s of changes.states ?? []) remember(s, s.to);
    for (const r of changes.revealed ?? []) remember(r);
    switch (tool) {
      case 'look':
        for (const e of [...(result.objects ?? []), ...(result.ghosts ?? [])]) remember(e);
        return remember(result.room);
      case 'examine':
        return remember(result.target, result.target?.state);
      case 'talk':
        return remember(result.ghost);
      case 'move':
        return changes.room ? remember(changes.room) : null;
      case 'act':
        // Una scoperta conta più dell'oggetto usato; poi l'oggetto usato; poi un altro oggetto cambiato.
        return changes.revealed?.at(-1) ?? known.get(args?.target) ?? changes.states?.[0] ?? null;
      default:
        return null;
    }
  }

  return {
    // Messaggio `tool` arrivato durante il turno.
    tool(msg) {
      const ref = pertinent(msg);
      if (ref) void show(ref);
    },

    // Messaggio `state`: si ricostruisce tutto dalla history, così dopo un ricaricamento
    // o un reset il riquadro mostra la stessa immagine che si vedeva durante la partita.
    state({ view, history }) {
      known = new Map();
      for (const e of [...view.objects, ...view.ghosts]) remember(e);
      remember(view.room);
      let pick = null;
      for (const msg of history) if (msg.type === 'tool') pick = pertinent(msg) ?? pick;
      void show(pick ?? view.room);
    },
  };
}
