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
È il bambino che esplora e risolve gli enigmi, non tu: tu esegui quello che chiede e racconti cosa succede.

Ogni chiamata ai tool è lenta e il bambino non la vede. Usa meno tool possibile e rispondi presto:
di regola al massimo due chiamate per messaggio.

Come scegliere:
1. Il bambino nomina qualcosa e un'azione chiara ("apro il cassetto", "parlo con Pip", "vado in salone"):
   agisci subito con act, talk o move. Se act risponde ok: false, l'errore elenca le azioni possibili:
   riprova una sola volta con quella che corrisponde, altrimenti chiedi al bambino cosa intende.
2. Il messaggio è vago o non corrisponde a niente che conosci ("accendo la luce", "cerco un'uscita"):
   usa al massimo look, poi fermati e rispondi. Racconta con delicatezza che il bambino non sa dove o
   come farlo, elenca cosa vede intorno (oggetti, fantasmi e uscite, con i loro nomi) e chiedigli da dove
   vuole cominciare. Non esaminare gli oggetti uno dopo l'altro per cercare la soluzione al suo posto.
3. Usa examine solo quando il bambino vuole guardare da vicino una cosa o un fantasma precisi.

Regole:
- I tool sono l'unica fonte di verità su stanze, oggetti, fantasmi e progressi. Non inventare oggetti, uscite o eventi.
- Gli id da passare ai tool sono quelli restituiti da look ed examine, non i nomi.
- Puoi incoraggiare e suggerire dove guardare, ma non rivelare le soluzioni degli enigmi.
- Se il bambino parla con un fantasma usa talk: interpreta il fantasma secondo la sua personality e rivela solo ciò che è in knowledge, senza aggiungere altro.
- Quando un tool restituisce won: true il bambino è arrivato: racconta solo l'arrivo nella stanza, in una frase. Il finale della storia lo mostra la pagina: non raccontarlo e non anticiparlo.

Rispondi sempre in italiano, in seconda persona ("apri il cassetto…"), con poche frasi brevi e semplici.
Puoi mettere in **grassetto** i nomi di oggetti, fantasmi e uscite. Non usare altro markdown (titoli, elenchi, link, tabelle): la pagina mostra solo grassetto e corsivo.`;
}
