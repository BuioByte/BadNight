# @badnight/level

Il modulo dell'engine che gestisce i livelli:

- carica e valida il livello YAML (riferimenti, chiavi sconosciute, cicli nei traguardi);
- tiene lo stato della partita e applica le regole (azioni, esiti, traguardi, uscite);
- implementa i tool per l'agente AI: `look`, `examine`, `act`, `move`, `talk`.

Non contiene il server HTTP, le chiamate a Gemma né la sintesi vocale. Quelle parti stanno nell'engine,
che importa questo modulo.

```sh
corepack pnpm install   # dalla radice del repo (workspace pnpm)
cd packages/level
corepack pnpm test      # test
corepack pnpm play      # gioca il livello 1 dal terminale, chiamando i tool a mano
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
| `look` | | `room`, `objects`, `ghosts`, `exits` (con `open`), `progress` |
| `examine` | `target` | `target`: descrizione (incluso lo stato), `state`, `actions` |
| `act` | `target`, `action` | `text`, `changes` |
| `move` | `to` | `text`, `changes` (se l'uscita è chiusa: testo `locked` e `changes` vuoto). Alla vittoria `changes.won` è `true`; il testo non contiene l'`outro`, che mostra chi presenta la partita |
| `talk` | `ghost` | `ghost` (nome, descrizione, `personality`, `voice`), `knowledge` |

`talk` non genera il dialogo. Restituisce il contesto da passare a Gemma: la personalità del fantasma
e solo le informazioni (`knowledge`) sbloccate dallo stato attuale.

`changes` contiene solo i campi che sono cambiati:

```js
{
  states: [{ id, name, from, to }],          // stati degli oggetti
  revealed: [{ id, name }], hidden: [...],   // oggetti/fantasmi comparsi o spariti
  milestones: [{ id, description }],         // traguardi completati
  exitsUnlocked: [{ from, to }],
  room: { id, name },                        // dopo move
  won: true,
}
```

## Formato del livello

Esempio completo: [levels/level-1.yaml](levels/level-1.yaml). Gli id sono in minuscolo con `_`.
Gli id di oggetti e fantasmi sono unici in tutto il livello, e lo stesso vale per i traguardi.
Non c'è inventario: gli oggetti restano nella loro stanza. Un oggetto da trovare si dichiara `hidden: true`
e compare con l'effetto `reveal`.

```yaml
id: livello_1
title: La prima notte
intro: Testo iniziale.
outro: Testo finale, da mostrare quando si entra nella stanza goal (non è nel testo di move).
start: cameretta          # stanza di partenza
goal: camera_genitori     # entrarci fa vincere

rooms:
  cameretta:
    name: Cameretta
    asset: room_cameretta
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
      chiave:
        name: Chiave
        asset: object_chiave
        description: ...
        hidden: true      # resta nella stanza; un'azione la rivela con `reveal`
      porta:
        name: Porta
        asset: object_porta_cameretta
        description: ...
        states:           # opzionale; il primo è lo stato iniziale, il testo si aggiunge alla descrizione
          chiusa: È chiusa a chiave.
          aperta: È aperta.
        hidden: false     # se true non si vede finché un effetto `reveal` non lo mostra
        actions:
          apri:
            description: Suggerimento per l'agente (opzionale).
            outcomes:     # vale il primo con `if` vero
              - if: { completed: chiave_trovata }
                text: La porta si apre.
                effects:
                  - set_state: { porta: aperta }
                  - complete: porta_aperta
              - text: Serve una chiave.
    ghosts:
      pip:
        name: Pip
        asset: ghost_pip
        description: ...
        personality: Istruzioni di personalità per il modello.
        voice: id-voce-elevenlabs    # opzionale
        knowledge:                   # cosa può rivelare, e da quando
          - text: Ha perso la chiave.
          - if: { completed: candela_accesa }
            text: La chiave è sotto il letto.
        actions: { ... }             # come per gli oggetti
```

### Asset grafici

Il campo facoltativo `asset` identifica la risorsa grafica di una stanza (sfondo), un oggetto,
o un fantasma. Deve rispettare il formato `[a-z][a-z0-9_]*`.
Il prefisso non determina il tipo di elemento: gli identificativi esistenti restano validi.

Sono identificativi logici, non percorsi o URL: il frontend li associa ai file effettivi.
Il caricatore valida il formato, non l'esistenza dei file; lo stesso asset si puo' riutilizzare.
Il campo non modifica le regole di gioco e non e' obbligatorio nei livelli esistenti.

`look`, `examine` e `talk` restituiscono `asset` insieme ai dati degli elementi visibili.
Anche i riferimenti in `changes` (stati, elementi rivelati/nascosti e stanza)
lo includono quando presente. Gli elementi nascosti restano esclusi dalle viste fino alla scoperta.
L'asset identifica l'elemento indipendentemente dal suo stato; eventuali varianti grafiche
possono essere selezionate dal frontend usando anche `state` o i cambiamenti di stato.

**Condizioni** (`if`). Più chiavi nella stessa mappa vanno tutte soddisfatte.

| Condizione | Vera se |
| --- | --- |
| `completed: id` o `[id, ...]` | i traguardi sono completati |
| `visited: id` o `[id, ...]` | le stanze sono state visitate |
| `state: { oggetto: stato }` | gli oggetti sono in quello stato |
| `not: cond` / `all: [cond, ...]` / `any: [cond, ...]` | negazione, e, o |

**Effetti** (`effects`): `set_state: { oggetto: stato }`, `complete: traguardo`,
`reveal: oggetto` (lo fa comparire), `hide: oggetto` (lo nasconde).

**Traguardi.** L'engine non completa mai un traguardo i cui prerequisiti non sono completati.
Un esito che contiene `complete: X` viene quindi saltato finché i prerequisiti di `X` mancano,
e vale l'esito successivo. Nel livello 1 succede con "guarda sotto il letto", che senza candela accesa
dà "è troppo buio".
