// Il racconto: intro, testo del giocatore, risposte dell'agente, errori e, alla vittoria, outro.
// I messaggi `tool` non sono risposte e non compaiono qui, ma contano per sapere quanta history è già mostrata.

export function createStory(el) {
  let rendered = 0; // messaggi della history già mostrati

  function entry(kind, text, animate) {
    const p = document.createElement('p');
    p.className = `entry entry-${kind}${animate ? ' entering' : ''}`;
    p.textContent = text;
    el.append(p);
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
    // Messaggio arrivato durante il turno.
    add,

    // Errore fuori dalla partita (messaggio rifiutato): si mostra ma non fa parte della history.
    notice(text) {
      entry('error', text, true);
    },

    // Da `state`: si ricostruisce tutto solo se la history non è quella già mostrata
    // (connessione, ricaricamento, reset); a fine turno di solito coincide.
    sync({ level, history, won }) {
      const outro = el.querySelector('.entry-outro');
      if (history.length !== rendered || el.childElementCount === 0) {
        el.replaceChildren();
        rendered = 0;
        if (level.intro) entry('intro', level.intro, false);
        for (const msg of history) add(msg, false);
      } else if (outro && !won) {
        outro.remove();
      }
      if (won && level.outro && !el.querySelector('.entry-outro')) entry('outro', level.outro, true);
    },
  };
}
