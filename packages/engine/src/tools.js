// Tool per l'agente AI come funzioni: { name, description, parameters (JSON Schema), handler(args) }.
// Il registro non dipende dal trasporto: l'adattatore verso l'agente (ai-agent.js) li registra nel harness,
// e qui si cambiano firme o si aggiungono tool senza toccare il package level.
//
// Oltre ai tool di gioco del livello c'è `respond`, con cui l'agente risponde al giocatore.
//
// `signal` è quello del turno: quando il turno è finito (anche per timeout) i tool rifiutano le chiamate,
// così un agente in ritardo non cambia lo stato né risponde dopo `ready`.

import { toolDefinitions } from '@badnight/level';

const TURN_OVER = { ok: false, error: 'Il turno è finito: questa chiamata è stata ignorata.' };

export const respondDefinition = {
  name: 'respond',
  description:
    "Mostra un testo al giocatore: il racconto di ciò che è successo, la risposta di un fantasma, una domanda. È l'unico modo per parlare al giocatore.",
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'testo da mostrare al giocatore' },
    },
    required: ['text'],
  },
};

export function createTools(engine, signal) {
  const active = (handler) => (args) => (signal?.aborted ? TURN_OVER : handler(args));
  return [
    ...toolDefinitions.map((def) => ({ ...def, handler: active((args) => engine.call(def.name, args)) })),
    {
      ...respondDefinition,
      handler: active(({ text } = {}) => {
        if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Manca il parametro "text".' };
        engine.respond(text);
        return { ok: true };
      }),
    },
  ];
}
