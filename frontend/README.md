# BadNight · frontend

La pagina web in cui il giocatore scrive le azioni in linguaggio naturale. Il gioco lo gestisce tutto
l'engine ([`packages/engine`](../packages/engine/README.md)): la pagina invia il testo e mostra quello che
l'engine le notifica sul WebSocket `/ws`.

Ha una **pipeline di build separata**: è un progetto a sé, fuori dal workspace pnpm della radice, con il suo
`package.json`, il suo lockfile e i suoi comandi. Non importa codice dell'engine. Usa [Vite](https://vite.dev)
come server di sviluppo e per la build.

```sh
# 1. l'engine, dalla radice del repo (pnpm via Corepack)
corepack pnpm install
corepack pnpm start       # http://127.0.0.1:3000

# 2. il frontend, in un altro terminale
cd frontend
npm install
npm run dev               # http://localhost:5173, /ws va in proxy all'engine
```

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | server di sviluppo con ricarica automatica |
| `npm run build` | build in `frontend/dist/` |
| `npm run preview` | serve `dist/` (con il proxy verso l'engine) per provare la build |
| `npm run build:engine` | build direttamente in `packages/engine/public/`, al posto della pagina provvisoria: da usare quando lo si decide con chi segue l'engine |

L'indirizzo dell'engine per il proxy si cambia con `ENGINE_URL` (vedi `.env.example`), per esempio se
l'engine è partito su un'altra porta.

## Struttura

| File | Cosa contiene |
| --- | --- |
| `index.html` | layout: header, illustrazione, racconto, prompt |
| `src/main.js` | collega i moduli e gestisce i messaggi dell'engine |
| `src/socket.js` | WebSocket: connessione, riconnessione, dispatch per `type` |
| `src/turn.js` | blocco dell'input |
| `src/story.js` | racconto: intro, testo del giocatore, risposte, errori, outro |
| `src/room.js` | stanza, progresso (una candela per stanza), uscite, traguardi |
| `src/illustration.js` | sceglie e mostra l'illustrazione più pertinente |
| `src/art/` | disegni 1-bit per chiave `asset` e primitive di disegno |
| `public/illustrations/` | PNG facoltativi che sostituiscono i disegni |
| `art.html` | anteprima di tutti i disegni (solo in sviluppo) |
| `src/style.css` | tema gotico |
| `src/sound.js` | musica, suoni dei tasti e volumi del mixer |

La schermata iniziale permette di scegliere se attivare l'audio. Il mixer nell'intestazione regola separatamente volume master, musica, tasti del giocatore e macchina da scrivere. Le risposte dell'engine vengono mostrate carattere per carattere. Le tracce WAV sono locali e si rigenerano dalla radice del repository con `python3 frontend/scripts/render_soundtrack.py`.

## Si aspetta sempre la risposta

Il giocatore non può andare avanti finché l'engine non ha risposto:

- l'input parte bloccato e si sblocca **solo** con `ready`;
- all'invio si blocca prima di spedire il messaggio, così un doppio Enter non manda due turni;
- dopo una disconnessione resta bloccato finché l'engine, alla riconnessione, non manda `ready`;
- un `state` con `busy: true` (pagina ricaricata durante un turno) lo tiene bloccato;
- dopo la vittoria resta attivo solo "Nuova notte"; anche il `reset` si conclude con `ready`.

## Illustrazioni

Il riquadro a sinistra mostra un'illustrazione statica, in bianco e nero a 1 bit, scelta dalla chiave
`asset` che stanze, oggetti e fantasmi hanno nel livello (vedi il
[README di level](../packages/level/README.md#asset-grafici)). L'engine non va toccato: le chiavi arrivano
già nei messaggi `state` e `tool`.

**Quale immagine.** La più pertinente all'ultima risposta del server (`src/illustration.js`):

| Tool | Immagine |
| --- | --- |
| `look` | la stanza |
| `examine` | l'oggetto o il fantasma esaminato |
| `talk` | il fantasma |
| `act` | l'oggetto appena scoperto, se c'è; altrimenti l'oggetto usato |
| `move` | la nuova stanza (se la porta è chiusa l'immagine non cambia) |

I tool falliti non cambiano l'immagine. A ogni `state` la scelta si ricostruisce dalla `history`, quindi dopo
un ricaricamento o un reset si vede la stessa immagine. Gli oggetti con stati diversi (comodino aperto, zucca
accesa, porta aperta, cestino vuoto, pianoforte, tavolino) hanno una variante per stato.

**Da dove viene.** Per ogni chiave si usa, in ordine:

1. un PNG in `public/illustrations/`: `<asset>-<stato>.png` (solo per quello stato) o `<asset>.png`;
2. il disegno generato dal codice in `src/art/drawings.js` (128×128, primitive e retinatura in `src/art/bitmap.js`);
3. la zucca ASCII, se la chiave manca o non ha né PNG né disegno (per esempio un livello senza chiavi `asset`).

I PNG servono a sostituire i disegni del codice con immagini fatte a mano o con un generatore. Formato
consigliato: quadrato, bianco e nero, 128×128 o 256×256. La pagina li ingrandisce a pixel netti.

Con `npm run dev`, la pagina [`/art.html`](art.html) mostra tutti i disegni con le loro varianti di stato
(`/art.html?q=ghost` filtra per chiave).
