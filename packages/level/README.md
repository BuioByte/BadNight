# @badnight/level

Il modulo dell'engine che gestisce i livelli:

- carica e valida il livello YAML (riferimenti, chiavi sconosciute, cicli nei traguardi);
- tiene lo stato della partita e applica le regole (azioni, esiti, traguardi, uscite);
- implementa i tool per l'agente AI: `look`, `examine`, `act`, `move`, `talk`.

Non contiene il server HTTP, le chiamate a Gemma né la sintesi vocale. Quelle parti stanno nell'engine,
che importa questo modulo.

```sh
cd packages/level
npm install
npm test        # test
npm run play    # gioca il livello 1 dal terminale, chiamando i tool a mano
```

## Uso dall'engine

```js
import { loadLevelFile, createGame, toolDefinitions } from '@badnight/level';

const level = await loadLevelFile('levels/level-1.yaml'); // lancia LevelError (con .errors) se non è valido
const game = createGame(level);                           // oppure createGame(level, { state: salvato })

// toolDefinitions: [{ name, description, parameters }] da passare al modello come function declarations.
// Per ogni function call del modello:
const result = game.call(name, args);

game.state;  // stato serializzabile in JSON, per salvare la partita
game.won;    // true quando il bambino raggiunge la stanza `goal`
```

Ogni tool restituisce `{ ok: true, ... }`, oppure `{ ok: false, error }` quando la chiamata non è valida
(bersaglio che non c'è, azione sconosciuta, partita finita). Il testo dell'errore elenca le alternative valide,
così l'agente può correggersi.

| Tool | Argomenti | Risultato |
| --- | --- | --- |
| `look` | | `room`, `objects`, `ghosts`, `exits` (con `open`), `inventory`, `progress` |
| `examine` | `target` | `target`: descrizione (incluso lo stato), `state`, `actions` |
| `act` | `target`, `action` | `text`, `changes` |
| `move` | `to` | `text`, `changes` (se l'uscita è chiusa: testo `locked` e `changes` vuoto) |
| `talk` | `ghost` | `ghost` (nome, descrizione, `personality`, `voice`), `knowledge` |

`talk` non genera il dialogo. Restituisce il contesto da passare a Gemma: la personalità del fantasma
e solo le informazioni (`knowledge`) sbloccate dallo stato attuale.

`changes` contiene solo i campi che sono cambiati:

```js
{
  states: [{ id, name, from, to }],          // stati degli oggetti
  revealed: [{ id, name }], hidden: [...],   // oggetti/fantasmi comparsi o spariti
  inventory: { added: [...], removed: [...] },
  milestones: [{ id, description }],         // traguardi completati
  exitsUnlocked: [{ from, to }],
  room: { id, name },                        // dopo move
  won: true,
}
```

## Formato del livello

Esempio completo: [levels/level-1.yaml](levels/level-1.yaml). Gli id sono in minuscolo con `_`.
Gli id di oggetti, fantasmi e oggetti d'inventario sono unici in tutto il livello, e lo stesso vale per i traguardi.

```yaml
id: livello_1
title: La prima notte
intro: Testo iniziale.
outro: Testo finale, mostrato quando si entra nella stanza goal.
start: cameretta          # stanza di partenza
goal: camera_genitori     # entrarci fa vincere

items:                    # oggetti che possono finire nell'inventario
  chiave:
    name: Chiave
    description: ...
    actions: { ... }      # opzionale, come per gli oggetti

rooms:
  cameretta:
    name: Cameretta
    description: ...
    milestones:           # DAG dei traguardi
      chiave_trovata:
        description: ...
        requires: [candela_accesa]   # anche di altre stanze
    exits:                # chiave = stanza di destinazione
      salone:
        description: ...
        requires: [porta_aperta]     # traguardi che sbloccano l'uscita
        locked: Testo se è chiusa.
    objects:
      porta:
        name: Porta
        description: ...
        states:           # opzionale; il primo è lo stato iniziale, il testo si aggiunge alla descrizione
          chiusa: È chiusa a chiave.
          aperta: È aperta.
        hidden: false     # se true non si vede finché un effetto `reveal` non lo mostra
        actions:
          apri:
            description: Suggerimento per l'agente (opzionale).
            outcomes:     # vale il primo con `if` vero
              - if: { has: chiave }
                text: La porta si apre.
                effects:
                  - set_state: { porta: aperta }
                  - remove: chiave
                  - complete: porta_aperta
              - text: Serve una chiave.
    ghosts:
      pip:
        name: Pip
        description: ...
        personality: Istruzioni di personalità per il modello.
        voice: id-voce-elevenlabs    # opzionale
        knowledge:                   # cosa può rivelare, e da quando
          - text: Ha perso la chiave.
          - if: { completed: candela_accesa }
            text: La chiave è sotto il letto.
        actions: { ... }             # come per gli oggetti
```

**Condizioni** (`if`). Più chiavi nella stessa mappa vanno tutte soddisfatte.

| Condizione | Vera se |
| --- | --- |
| `completed: id` o `[id, ...]` | i traguardi sono completati |
| `has: id` o `[id, ...]` | gli oggetti sono nell'inventario |
| `visited: id` o `[id, ...]` | le stanze sono state visitate |
| `state: { oggetto: stato }` | gli oggetti sono in quello stato |
| `not: cond` / `all: [cond, ...]` / `any: [cond, ...]` | negazione, e, o |

**Effetti** (`effects`): `set_state: { oggetto: stato }`, `give: item`, `remove: item`,
`complete: traguardo`, `reveal: oggetto`, `hide: oggetto`.

**Traguardi.** L'engine non completa mai un traguardo i cui prerequisiti non sono completati.
Un esito che contiene `complete: X` viene quindi saltato finché i prerequisiti di `X` mancano,
e vale l'esito successivo. Nel livello 1 succede con "guarda sotto il letto", che senza candela accesa
dà "è troppo buio".
