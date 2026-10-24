# @badnight/engine

Server CLI di BadNight. All'avvio carica il livello, serve la pagina web e l'API REST
e stampa in console il link da aprire.

Prototipo: una sola partita in memoria, un solo giocatore, nessuna autenticazione.
Regole e stato della partita sono nel package [`level`](../level/README.md).

```sh
npm install          # dalla radice del repo (npm workspaces)
npm start            # = badnight, livello 1 su http://127.0.0.1:3000
npm test
```

```
badnight [--level file.yaml] [--port 3000] [--host 127.0.0.1]
```

Se la porta è occupata l'engine prova le successive.

## Struttura

| File | Cosa contiene |
| --- | --- |
| `bin/badnight.js` | CLI: argomenti, caricamento del livello, avvio del server, link in console |
| `src/engine.js` | `Engine`: l'unica partita, il log degli eventi, la vista per il frontend |
| `src/tools.js` | `createTools(engine)`: i tool per l'agente AI come funzioni |
| `src/http.js` | server HTTP: file statici da `public/` e API REST |
| `public/` | pagina web (per ora una pagina provvisoria per chiamare i tool a mano) |

## Tool per l'agente AI

```js
import { createEngine, createTools } from '@badnight/engine';

const tools = createTools(engine);
// [{ name, description, parameters (JSON Schema), handler(args) → risultato }]
```

Il registro non dipende dal trasporto. L'adattatore verso il componente agenti si aggiungerà sopra.
I tool e i loro risultati sono descritti nel [README di level](../level/README.md#uso-dallengine).
Ogni chiamata, che venga dall'agente o dall'API, finisce nel log degli eventi.

## API REST

| Metodo | Path | Risposta |
| --- | --- | --- |
| GET | `/api/state?since=n` | vista della partita ed eventi con `seq > n` |
| POST | `/api/tools/:name` | risultato del tool. Il body JSON contiene gli argomenti, es. `{ "target": "letto", "action": "guarda_sotto" }` |
| POST | `/api/reset` | nuova partita, risponde con la vista |

`GET /api/state`:

```js
{
  run: 1,                     // cambia a ogni reset: se cambia, rileggere da since=0
  level: { id, title, intro, outro },
  view: { room, objects, ghosts, exits, progress, won? },  // come il tool look
  completed: [{ id, description }],
  won: false,
  seq: 3,                     // ultimo evento: il prossimo polling usa since=3
  events: [{ seq, at, source: 'agent' | 'http', tool, args, result }],
}
```

Le mosse dell'agente non passano dal frontend. Per vederle, il frontend fa polling di `/api/state?since=<seq>`.

Errori: `{ ok: false, error }`, con 400 (body non valido), 404 (endpoint sconosciuto) o 500.
Un tool chiamato in modo sbagliato (bersaglio inesistente, ecc.) risponde invece 200 con `ok: false`,
come lo vede l'agente.
