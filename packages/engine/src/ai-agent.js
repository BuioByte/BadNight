// Adattatore tra engine e harness AI (@badnight/agent-harness).
//
// A ogni turno registra i tool di gioco del turno nel registry del harness, chiama runTurn e mostra
// al giocatore la narrazione che ne esce (con il tool `respond` dell'engine, che non va al modello).
// La history della conversazione appartiene alla partita: resta qui tra un turno e l'altro e si
// azzera con reset(), che l'engine chiama a ogni nuova partita.
//
// Il harness non si può interrompere: se il turno scade, il signal dell'engine scatta, i tool rifiutano
// le chiamate e qui si scarta il risultato, senza rispondere né aggiornare la history.

import { createAgent, createToolRegistry } from '@badnight/agent-harness';

export const AI_ERROR_MESSAGE = 'Il narratore ha perso il filo della storia. Riprova, magari con altre parole.';

// options: come createAgent del harness (provider, apiKey, client, modelli, maxToolRounds…),
// tranne registry; systemInstruction di default è quella del livello.
export function createAiAgent(level, { systemInstruction = systemInstructionFor(level), ...options } = {}) {
  // Verifica subito la configurazione (chiavi, provider), invece che al primo turno.
  createAgent({ ...options, systemInstruction, registry: createToolRegistry() });

  let history = [];

  async function agent(text, tools, { signal } = {}) {
    const registry = createToolRegistry();
    for (const { name, description, parameters, handler } of tools) {
      if (name !== 'respond') registry.register({ name, description, ...(parameters && { parameters }) }, (args) => withoutAssets(handler(args)));
    }
    const harness = createAgent({ ...options, systemInstruction, registry });

    let result;
    try {
      result = await harness.runTurn({ action: text, history });
    } catch (e) {
      throw new Error(AI_ERROR_MESSAGE, { cause: e });
    }
    if (signal?.aborted) return;
    history = result.history;
    tools.find((t) => t.name === 'respond').handler({ text: result.text });
  }

  agent.reset = () => {
    history = [];
  };
  return agent;
}

// Gli `asset` (id delle illustrazioni) servono al frontend, non al modello: si tolgono dalla copia
// del risultato che va al harness. Il messaggio `tool` per il frontend li conserva.
function withoutAssets(value) {
  if (Array.isArray(value)) return value.map(withoutAssets);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'asset').map(([k, v]) => [k, withoutAssets(v)]));
}

export function systemInstructionFor(level) {
  return `Sei il narratore di BadNight, un gioco testuale. Livello: «${level.title}».
${level.intro ? `Inizio della storia: ${level.intro}\n` : ''}
Il giocatore è il bambino protagonista. Ogni suo messaggio è ciò che il bambino vuole fare, dire o pensare.

Come usare i tool:
- I tool sono l'unica fonte di verità su stanze, oggetti, fantasmi e progressi. Non inventare oggetti, uscite o eventi.
- Usa look per sapere cosa c'è nella stanza ed examine per scoprire le azioni possibili su un oggetto o un fantasma, poi act per compierle e move per cambiare stanza.
- Gli id da passare ai tool sono quelli restituiti da look ed examine, non i nomi.
- Se un tool risponde con ok: false, leggi l'errore: di solito elenca le alternative valide.
- Se il bambino vuole parlare con un fantasma usa talk: interpreta il fantasma secondo la sua personality e rivela solo ciò che è in knowledge, senza aggiungere altro.
- Se una richiesta non corrisponde a nessuna azione possibile, raccontalo con delicatezza e suggerisci cosa si potrebbe provare.
- Quando un tool restituisce won: true il bambino è arrivato: racconta solo l'arrivo nella stanza, in una frase. Il finale della storia lo mostra la pagina: non raccontarlo e non anticiparlo.

Rispondi sempre in italiano, in seconda persona ("apri il cassetto…"), con poche frasi brevi e semplici.`;
}
