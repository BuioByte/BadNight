# @badnight/engine

Server CLI di BadNight. All'avvio carica il livello, serve la pagina web e il WebSocket
e stampa in console il link da aprire.

Prototipo: una sola partita in memoria, un solo giocatore, nessuna autenticazione.
Regole e stato della partita sono nel package [`level`](../level/README.md).

```sh
corepack pnpm install    # dalla radice del repo (workspace pnpm)
corepack pnpm start      # = badnight, livello 1 su http://127.0.0.1:3000
corepack pnpm start -- --port 3100
corepack pnpm --filter @badnight/engine test
```

```
badnight [--level file.yaml] [--port 3000] [--host 127.0.0.1] [--agent ai|dev] [--web cartella]
```

- `--level`: default `packages/level/levels/level-1.yaml`. I test dell'engine usano un livello minimo tutto loro, `test/fixtures/level.yaml`.
- `--agent ai`: risponde l'agente AI del harness. Le chiavi si leggono dall'ambiente o dal file `.env`
  nella radice del repo (vedi il README principale). `--agent dev`: l'agente di sviluppo a comandi testuali.
  Senza `--agent`: `ai` se è impostato `GEMINI_API_KEY` o `AGENT_PROVIDER`, altrimenti `dev`.
  La console mostra quale agente è attivo.
- `--web`: la cartella della pagina da servire. Senza `--web`: il frontend compilato (`frontend/dist`, lo crea
  `corepack pnpm start` dalla radice) se c'è, altrimenti la pagina provvisoria `public/`. La console mostra quale.
- `--llm-log`: con l'agente AI, il file dove registrare le chiamate al provider (default `logs/llm-calls.log`
  nella radice; `off` lo disattiva). Vedi "Log" qui sotto.
- Se la porta è occupata l'engine prova le successive.

`start` e `test` compilano prima il harness (TypeScript).

### Log

- **Console**: una riga per turno, con orario, testo, durata e numero di tool usati. Se il turno fallisce,
  sotto c'è l'errore riassunto lungo la catena delle cause (per gli errori del provider: codice, stato e
  messaggio), lo stack solo per gli errori di programmazione, e il percorso del log delle chiamate.
- **`logs/llm-calls.log`** (solo con l'agente AI): ogni chiamata HTTP al provider, con richiesta e risposta
  JSON complete, stato e durata; anche gli errori di rete e i tentativi ripetuti dall'SDK. Il file si svuota a
  ogni avvio ed è ignorato da git. Contiene testo del giocatore e del modello, ma non le intestazioni, dove
  viaggiano le chiavi; una chiave nell'URL è oscurata. Si ottiene intercettando il `fetch` del processo
  (`startLlmLog` in `src/llm-log.js`), quindi funziona con ogni provider senza toccare il harness.

## Struttura

| File | Cosa contiene |
| --- | --- |
| `bin/badnight.js` | CLI: argomenti, caricamento del livello, avvio del server, link in console |
| `src/engine.js` | `Engine`: l'unica partita, i turni, la cronologia, i messaggi per il frontend |
| `src/tools.js` | `createTools(engine)`: i tool per l'agente AI come funzioni |
| `src/ai-agent.js` | `createAiAgent(level)`: adattatore verso il harness AI e prompt di sistema |
| `src/dev-agent.js` | agente di sviluppo a comandi testuali |
| `src/errors.js` | `describeError`: errore riassunto per la console |
| `src/llm-log.js` | `startLlmLog`: log su file delle chiamate al provider |
| `src/http.js` | server HTTP: file statici da `public/` |
| `src/ws.js` | WebSocket su `/ws` |
| `public/` | pagina provvisoria, servita solo se il frontend ([`frontend`](../../frontend/README.md)) non è compilato |

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
const engine = createEngine(level, { agent: createAiAgent(level) });   // oppure { agent: devAgent }

// agent: async (text, tools, { signal }) => void, con reset() opzionale
// tools: [{ name, description, parameters (JSON Schema), handler(args) → risultato }]
// Il turno finisce quando la promise si risolve.
```

`tools` contiene i tool di gioco descritti nel [README di level](../level/README.md#uso-dallengine)
e `respond({ text })`, l'unico modo di parlare al giocatore. Sono creati per ogni turno: quando il turno
finisce, anche per timeout, `signal` scatta e i tool rifiutano le chiamate. Così un agente in ritardo
non cambia lo stato e non risponde dopo `ready`. L'engine chiama `agent.reset()`, se c'è, a ogni nuova partita.

Se l'agente lancia un errore, al giocatore arriva `e.message` come `error`, e l'engine emette
`agentError` con l'errore completo (la CLI lo scrive in console).

**`createAiAgent(level, options)`** collega l'engine al [harness AI](../agent-harness/README.md):

- a ogni turno registra nel registry del harness i tool di gioco (non `respond`) e chiama `runTurn`;
  la narrazione restituita arriva al giocatore con `respond`;
- conserva la history della conversazione tra i turni e la azzera con `reset()`;
- se il turno è scaduto ne scarta il risultato;
- se il harness fallisce (provider, argomenti dei tool non validi, troppi round…) al giocatore arriva
  un messaggio semplice in italiano (`AI_ERROR_MESSAGE`); l'errore del harness è in `e.cause`;
- il prompt di sistema (`systemInstructionFor(level)`) chiede risposte in italiano, pochi tool per messaggio
  (di regola al massimo due: ogni chiamata è lenta e il giocatore non la vede) e i tool come unica fonte di
  verità. Se la richiesta è chiara il modello agisce subito; se è vaga usa al massimo `look` e risponde con un
  suggerimento (cosa c'è intorno, da dove cominciare) invece di esplorare al posto del giocatore. Non rivela le
  soluzioni, e i fantasmi dicono solo ciò che `talk` restituisce in `knowledge`;
- `options` sono quelle di `createAgent` del harness (provider, chiave, client, modelli, `maxToolRounds`),
  più `systemInstruction` per sostituire il prompt. La configurazione si verifica subito: senza chiave
  `createAiAgent` lancia un errore.

`devAgent` accetta comandi come `act letto guarda_sotto` e non chiama nessun modello: serve per
sviluppare e provare il frontend senza chiavi.

## WebSocket `/ws`

Messaggi JSON con un campo `type`.

**Frontend → engine**

| Messaggio | Effetto |
| --- | --- |
| `{ type: 'input', text }` | avvia un turno. Rifiutato (con `error`) se un turno è già in corso |
| `{ type: 'reset' }` | nuova partita: risponde con `state` e `ready`. Rifiutato durante un turno |

**Engine → frontend**

| Messaggio | Quando |
| --- | --- |
| `{ type: 'state', level, view, completed, won, busy, history }` | alla connessione, a fine turno e dopo un reset |
| `{ type: 'ready' }` | alla connessione (se non c'è un turno in corso), a fine turno e dopo un reset: riattivare l'input |
| `{ type: 'input', seq, at, text }` | il testo del giocatore, all'inizio del turno |
| `{ type: 'tool', seq, at, tool, args, result }` | l'agente ha chiamato un tool di gioco. `result.changes` contiene le variazioni |
| `{ type: 'output', seq, at, text }` | testo dell'agente per il giocatore |
| `{ type: 'error', error }` | errore dell'agente durante il turno (con `seq`), o messaggio del frontend rifiutato |

`state`:

```js
{
  type: 'state',
  level: { id, title, intro, outro },                     // outro: lo mostra il frontend quando won è true
  view: { room, objects, ghosts, exits, progress, won? },  // come il tool look
  completed: [{ id, description }],                       // traguardi
  won: false,
  busy: false,
  history: [ /* messaggi input, tool, output, error della partita, in ordine di seq */ ],
}
```

Con `history` il frontend ricostruisce la chat dopo un ricaricamento della pagina.
Il finale (`level.outro`) non arriva in nessun `output` né nei risultati dei tool: il frontend lo mostra
quando `won` è `true`.
C'è una sola sessione: se ci sono più connessioni aperte, i messaggi arrivano a tutte.
