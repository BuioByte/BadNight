# BadNight · frontend

La pagina web in cui il giocatore scrive le azioni in linguaggio naturale. Il gioco lo gestisce tutto
l'engine ([`packages/engine`](../packages/engine/README.md)): la pagina invia il testo e mostra quello che
l'engine le notifica sul WebSocket `/ws`.

Ha una **pipeline di build separata**: è un progetto a sé, fuori dal workspace pnpm della radice, con il suo
`package.json`, il suo lockfile e i suoi comandi. Non importa codice dell'engine. Usa [Vite](https://vite.dev)
come server di sviluppo e per la build.

Per giocare basta `corepack pnpm start` dalla radice del repo: compila il frontend in `frontend/dist` e
l'engine lo serve su http://127.0.0.1:3000, insieme al WebSocket.

Per sviluppare con la ricarica automatica:

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
| `npm run build` | build in `frontend/dist/`, che l'engine serve (lo fa anche `corepack pnpm start`) |
| `npm run preview` | serve `dist/` (con il proxy verso l'engine) per provare la build |

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

Le illustrazioni ASCII le genererà il backend e le invierà sul WebSocket. Il protocollo non le prevede
ancora, quindi per ora il riquadro mostra una zucca ASCII statica (`#art` in `index.html`). Quando il
messaggio esisterà, basterà aggiungere un caso in `src/main.js` che scrive il testo in `#art`, con
`textContent`.
