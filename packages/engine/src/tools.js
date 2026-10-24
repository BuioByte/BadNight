// Tool per l'agente AI come funzioni: { name, description, parameters (JSON Schema), handler(args) }.
// Il registro non dipende dal trasporto: il componente agenti lo userà tramite un adattatore,
// e qui si cambiano firme o si aggiungono tool senza toccare il package level.

import { toolDefinitions } from '@badnight/level';

export function createTools(engine) {
  return toolDefinitions.map((def) => ({
    ...def,
    handler: (args) => engine.call(def.name, args, 'agent'),
  }));
}
