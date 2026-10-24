// Il racconto: intro, testo del giocatore, risposte dell'agente, errori e, alla vittoria, outro.
// I messaggi `tool` non sono risposte e non compaiono qui, ma contano per sapere quanta history è già mostrata.

import { parseEmphasis, plainText, renderEmphasis } from './emphasis.js';

const TYPE_DELAY = 28;

export function createStory(el, { typeSound = () => {} } = {}) {
  let rendered = 0; // messaggi della history già mostrati
  let started = false;
  let typing = false;
  const queue = [];
  const idleCallbacks = [];

  function typeNext() {
    if (typing) return;
    const next = queue.shift();
    if (!next) {
      idleCallbacks.splice(0).forEach((callback) => callback());
      return;
    }
    if (!next.element.isConnected) return typeNext();

    typing = true;
    const segments = parseEmphasis(next.text);
    const characters = [...plainText(segments)];
    if (characters.length === 0) {
      next.element.dataset.typed = 'true';
      typing = false;
      return typeNext();
    }
    next.element.classList.add('typing');
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    next.element.replaceChildren(visual);
    let index = 0;
    const timer = setInterval(() => {
      const character = characters[index++];
      renderEmphasis(visual, segments, index);
      if (!/\s/.test(character) && index % 3 === 0) typeSound();
      el.scrollTop = el.scrollHeight;

      if (index === characters.length) {
        clearInterval(timer);
        const accessible = document.createElement('span');
        accessible.className = 'visually-hidden';
        renderEmphasis(accessible, segments);
        next.element.append(accessible);
        next.element.classList.remove('typing');
        next.element.dataset.typed = 'true';
        setTimeout(() => {
          typing = false;
          typeNext();
        }, 110);
      }
    }, TYPE_DELAY);
  }

  function enqueue(element, text) {
    element.dataset.typed = 'false';
    queue.push({ element, text });
    typeNext();
  }

  // `narrate`: scrivere il testo a macchina (ciò che arriva adesso) o mostrarlo subito (la storia passata,
  // ricostruita dopo un ricaricamento o una riconnessione). Prima di startNarration il testo si mostra e,
  // se va narrato, resta in attesa (data-typed="false").
  function entry(kind, text, animate, narrate = animate) {
    const p = document.createElement('p');
    p.className = `entry entry-${kind}${animate ? ' entering' : ''}`;
    // Prima nella pagina, poi in coda: typeNext salta gli elementi non (più) collegati al documento.
    el.append(p);
    if (['intro', 'output', 'outro'].includes(kind)) {
      p.dataset.fullText = text;
      if (narrate && started) enqueue(p, text);
      else {
        renderEmphasis(p, parseEmphasis(text));
        p.dataset.typed = narrate ? 'false' : 'true';
      }
    } else p.textContent = text;
    el.scrollTop = el.scrollHeight;
  }

  function add(msg, animate = true) {
    if (msg.seq) rendered = Math.max(rendered, msg.seq);
    switch (msg.type) {
      case 'input':
        entry('input', msg.text, animate);
        break;
      case 'output':
        entry('output', msg.text, animate);
        break;
      case 'error':
        entry('error', msg.error, animate);
        break;
    }
  }

  return {
    startNarration() {
      started = true;
      for (const p of el.querySelectorAll('.entry-intro, .entry-output, .entry-outro')) {
        if (p.dataset.typed === 'false') enqueue(p, p.dataset.fullText ?? p.textContent);
      }
    },

    whenIdle(callback) {
      if (!typing && queue.length === 0) callback();
      else idleCallbacks.push(callback);
    },

    // Messaggio arrivato durante il turno.
    add,

    // Errore fuori dalla partita (messaggio rifiutato): si mostra ma non fa parte della history.
    notice(text) {
      entry('error', text, true);
    },

    // Da `state`: si ricostruisce tutto solo se la history non è quella già mostrata
    // (connessione, ricaricamento, reset); a fine turno di solito coincide.
    // Nella ricostruzione la storia passata compare subito; si narra solo l'intro di una partita nuova.
    sync({ level, history, won }) {
      const outro = el.querySelector('.entry-outro');
      const rebuilt = history.length !== rendered || el.childElementCount === 0;
      if (rebuilt) {
        el.replaceChildren();
        rendered = 0;
        if (level.intro) entry('intro', level.intro, false, history.length === 0);
        for (const msg of history) add(msg, false);
      } else if (outro && !won) {
        outro.remove();
      }
      if (won && level.outro && !el.querySelector('.entry-outro')) entry('outro', level.outro, !rebuilt);
    },
  };
}
