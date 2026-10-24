# @badnight/engine

Server CLI di BadNight. All'avvio carica il livello, serve la pagina web e il WebSocket
e stampa in console il link da aprire.

Prototipo: una sola partita in memoria, un solo giocatore, nessuna autenticazione.
Regole e stato della partita sono nel package [`level`](../level/README.md).

```sh
corepack pnpm install    # dalla radice del repo (workspace pnpm)
corepack pnpm start      # = badnight, livello 0 su http://127.0.0.1:3000
corepack pnpm start -- --port 3100
corepack pnpm --filter @badnight/engine test
```

```
badnight [--level file.yaml] [--port 3000] [--host 127.0.0.1]   # default: packages/level/levels/level-0.yaml
```

Se la porta è occupata l'engine prova le successive.

## Struttura

| File | Cosa contiene |
| --- | --- |
| `bin/badnight.js` | CLI: argomenti, caricamento del livello, avvio del server, link in console |
| `src/engine.js` | `Engine`: l'unica partita, i turni, la cronologia, i messaggi per il frontend |
| `src/tools.js` | `createTools(engine)`: i tool per l'agente AI come funzioni |
| `src/dev-agent.js` | agente di sviluppo a comandi testuali, finché non c'è l'agente AI |
| `src/http.js` | server HTTP: file statici da `public/` |
| `src/ws.js` | WebSocket su `/ws` |
| `public/` | pagina web (per ora una pagina provvisoria) |

## Il turno

```
giocatore ──{input}──▶ engine ──▶ agente AI
                                   ├─ tool di gioco (look, examine, act, move, talk) ──▶ {tool}
                                   └─ respond(text) ──▶ {output}
                        fine turno ──▶ {state}, {ready}
```

1. Il frontend invia il testo del giocatore e disattiva l'input.
2. L'engine passa il testo all'agente. L'agente chiama i tool, e l'engine notifica ogni chiamata.
3. L'agente parla al giocatore solo con il tool `respond`, anche più volte nello stesso turno.
4. Quando l'agente ha finito, l'engine invia lo stato aggiornato e poi `ready`: il frontend riattiva l'input.

Se l'agente lancia un errore o supera il timeout (120 s), l'engine invia `error` e chiude comunque il turno con `ready`.

## Collegare l'agente AI

```js
const engine = createEngine(level, { agent });   // oppure engine.agent = agent

// agent: async (text, tools) => void
// tools: [{ name, description, parameters (JSON Schema), handler(args) → risultato }]
// Il turno finisce quando la promise si risolve.
```

`tools` contiene i tool di gioco descritti nel [README di level](../level/README.md#uso-dallengine)
e `respond({ text })`. Il registro non dipende dal trasporto: l'adattatore verso il componente agenti
si scrive sopra. Per ora la CLI usa `devAgent`, che accetta comandi come `act letto guarda_sotto`.

## WebSocket `/ws`

Messaggi JSON con un campo `type`.

**Frontend → engine**

| Messaggio | Effetto |
| --- | --- |
| `{ type: 'input', text }` | avvia un turno. Rifiutato (con `error`) se un turno è già in corso |
| `{ type: 'reset' }` | nuova partita. Rifiutato durante un turno |

**Engine → frontend**

| Messaggio | Quando |
| --- | --- |
| `{ type: 'state', level, view, completed, won, busy, history }` | alla connessione, a fine turno e dopo un reset |
| `{ type: 'ready' }` | alla connessione (se non c'è un turno in corso) e a fine turno: riattivare l'input |
| `{ type: 'input', seq, at, text }` | il testo del giocatore, all'inizio del turno |
| `{ type: 'tool', seq, at, tool, args, result }` | l'agente ha chiamato un tool di gioco. `result.changes` contiene le variazioni |
| `{ type: 'output', seq, at, text }` | testo dell'agente per il giocatore |
| `{ type: 'error', error }` | errore dell'agente durante il turno (con `seq`), o messaggio del frontend rifiutato |

`state`:

```js
{
  type: 'state',
  level: { id, title, intro, outro },
  view: { room, objects, ghosts, exits, progress, won? },  // come il tool look
  completed: [{ id, description }],                       // traguardi
  won: false,
  busy: false,
  history: [ /* messaggi input, tool, output, error della partita, in ordine di seq */ ],
}
```

Con `history` il frontend ricostruisce la chat dopo un ricaricamento della pagina.
C'è una sola sessione: se ci sono più connessioni aperte, i messaggi arrivano a tutte.
