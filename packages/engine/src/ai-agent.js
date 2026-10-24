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
      if (name !== 'respond') registry.register({ name, description, ...(parameters && { parameters }) }, handler);
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
${level.outro ? `- Quando un tool restituisce won: true, racconta il finale: ${level.outro}\n` : ''}
Rispondi sempre in italiano, in seconda persona ("apri il cassetto…"), con poche frasi brevi e semplici.`;
}
