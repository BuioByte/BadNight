// Dichiarazioni dei tool per l'agente AI, nel formato { name, description, parameters (JSON Schema) }
// accettato dalle API di function calling (Gemini compreso).

export const toolDefinitions = [
  {
    name: 'look',
    description:
      'Descrive la stanza in cui si trova il bambino: oggetti e fantasmi visibili, uscite (aperte o chiuse) e progresso.',
  },
  {
    name: 'examine',
    description:
      'Mostra i dettagli di un oggetto o di un fantasma presente nella stanza, con le azioni possibili.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: "id dell'oggetto o del fantasma (come restituito da look)" },
      },
      required: ['target'],
    },
  },
  {
    name: 'act',
    description:
      "Esegue un'azione su un oggetto o un fantasma della stanza. Le azioni possibili si scoprono con examine.",
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: "id dell'oggetto o del fantasma" },
        action: { type: 'string', description: "nome dell'azione (come restituito da examine)" },
      },
      required: ['target', 'action'],
    },
  },
  {
    name: 'move',
    description: 'Porta il bambino in una stanza adiacente, se l\'uscita è aperta.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'id della stanza di destinazione (come restituito da look)' },
      },
      required: ['to'],
    },
  },
  {
    name: 'talk',
    description:
      'Inizia a parlare con un fantasma della stanza. Restituisce la sua personalità, ciò che può rivelare in questo momento della partita e le azioni che si possono fare con lui (da eseguire con act).',
    parameters: {
      type: 'object',
      properties: {
        ghost: { type: 'string', description: 'id del fantasma (come restituito da look)' },
      },
      required: ['ghost'],
    },
  },
];
