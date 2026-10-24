// Tool per l'agente AI come funzioni: { name, description, parameters (JSON Schema), handler(args) }.
// Il registro non dipende dal trasporto: il componente agenti lo userà tramite un adattatore,
// e qui si cambiano firme o si aggiungono tool senza toccare il package level.
//
// Oltre ai tool di gioco del livello c'è `respond`, con cui l'agente risponde al giocatore.

import { toolDefinitions } from '@badnight/level';

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

export function createTools(engine) {
  return [
    ...toolDefinitions.map((def) => ({ ...def, handler: (args) => engine.call(def.name, args) })),
    {
      ...respondDefinition,
      handler: ({ text } = {}) => {
        if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Manca il parametro "text".' };
        engine.respond(text);
        return { ok: true };
      },
    },
  ];
}
