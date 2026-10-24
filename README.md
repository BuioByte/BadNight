# BadNight

Una piccola storia horror a bivi, delicata e adatta a un bambino di circa sei anni. Il bambino si è svegliato nella sua cameretta e attraversa una casa infestata di tre stanze per raggiungere il lettone dei genitori. Fantasmi, scricchiolii e ombre fanno un po' paura, senza scene violente.

## Setup and tests

Serve Node.js LTS (`nvm use`) e pnpm tramite Corepack.

```sh
corepack pnpm install
corepack pnpm start     # avvia l'engine e stampa il link alla pagina web
```

For live provider tests, set `GEMINI_API_KEY` or configure NVIDIA NIM in the server-side environment:

```sh
GEMINI_API_KEY=...
```

Per NVIDIA NIM, usa la chiave generata su NVIDIA Build:

```sh
AGENT_PROVIDER=openai-compatible
NVIDIA_API_KEY=...
NVIDIA_MODEL=deepseek-ai/deepseek-v4.1-flash
```

When `AGENT_PROVIDER=openai-compatible`, the harness uses `https://integrate.api.nvidia.com/v1` and `deepseek-ai/deepseek-v4.1-flash` by default. Override them with `NVIDIA_BASE_URL` or `NVIDIA_MODEL`. Keep provider credentials server-side. Run the optional live check with `corepack pnpm test:live:nim`.

## Architettura

### Engine

Server locale in Node.js, avviato da linea di comando ([`packages/engine`](packages/engine/README.md)).
Tiene l'unica partita in memoria (un solo giocatore, una sola sessione), serve la pagina web e
comunica con il frontend attraverso un WebSocket. È l'unica fonte di verità sulle regole.

Un turno di gioco:

1. il giocatore scrive testo libero nella pagina, che lo invia all'engine e attende;
2. l'engine passa il testo all'agente AI, che usa i tool di gioco;
3. l'agente risponde al giocatore; l'engine notifica alla pagina tool usati, risposta e nuovo stato;
4. a fine turno l'engine invia `ready` e la pagina riattiva l'input.

Il protocollo WebSocket è descritto nel [README dell'engine](packages/engine/README.md#websocket-ws).
Finché l'agente AI non è collegato, l'engine usa un agente di sviluppo a comandi testuali
(`act letto guarda_sotto`).

### Livello e regole

Il caricamento dei livelli, lo stato della partita e i tool per l'agente sono in
[`packages/level`](packages/level/README.md).

- **Livello in YAML**: stanze, uscite, oggetti, fantasmi ed enigmi sono descritti in un file YAML,
  che l'engine carica e valida all'avvio. Il livello di default è `levels/level-0.yaml`.
- **Oggetti e azioni**: ogni oggetto (e ogni fantasma) ha una lista di azioni possibili.
  Ogni azione ha una lista ordinata di esiti possibili: vale il primo la cui condizione è vera.
  Un esito ha un testo e degli effetti, ad esempio cambiare lo stato di un oggetto, far comparire
  un oggetto nascosto o completare un traguardo.
- **Niente inventario**: gli oggetti restano sempre nella loro stanza, il bambino non li porta con sé.
- **Traguardi**: ogni stanza ha un DAG di traguardi. Un traguardo si può completare solo quando tutti
  i suoi prerequisiti sono completati, e le uscite si sbloccano al completamento di traguardi.
  All'avvio l'engine verifica che il grafo non abbia cicli.
- **Tool per l'agente AI**: `look` (la stanza), `examine` (un oggetto o un fantasma), `act` (un'azione),
  `move` (una stanza adiacente), `talk` (un fantasma). Ogni azione restituisce la variazione dello stato
  (oggetti cambiati o comparsi, traguardi raggiunti, uscite sbloccate, vittoria).
- **Dialoghi con i fantasmi**: passano dall'agente. `talk` restituisce la personalità del fantasma e solo
  le informazioni sbloccate dai traguardi raggiunti: il fantasma non può rivelare più del previsto, e la
  progressione resta decisa dalle regole, non dal modello.

### Agente AI

[`packages/agent-harness`](packages/agent-harness/README.md) contiene il registry dei tool e il loop
del modello. I tool e lo stato della partita restano dell'engine, che li registra nel harness.

## Provider AI

Gemini AI Studio è il provider predefinito. Il modello Gemma 4 31B Dense gestisce ragionamento e tool call; Gemma 4 26B A4B MoE genera la narrazione. I nomi sono quelli supportati dal Gemini Developer API.

Il tool adapter OpenAI-compatible del harness supporta endpoint che implementano Chat Completions. Per selezionarlo, configura `.env` così:

```sh
AGENT_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=http://localhost:1234/v1
OPENAI_COMPATIBLE_API_KEY=
OPENAI_COMPATIBLE_TOOL_MODEL=nome-modello-tools
OPENAI_COMPATIBLE_NARRATION_MODEL=nome-modello-narratore
```

La chiave è facoltativa per server locali che non richiedono autenticazione. `OPENAI_BASE_URL`, `OPENAI_API_KEY` e `OPENAI_MODEL` sono fallback compatibili. Le impostazioni specifiche di ragionamento non sono standardizzate tra endpoint OpenAI-compatible: il loro comportamento dipende dal provider.

## Struttura

- `packages/engine/`: server CLI, partita, WebSocket per il frontend, pagina web (`public/`).
- `packages/level/`: livello YAML, regole della partita e tool `look`, `examine`, `act`, `move`, `talk`.
- `packages/agent-harness/`: registry dei tool e loop Gemini/OpenAI-compatible.
- `shared/contracts/`: JSON Schema di un contratto REST per il client (sessioni, inventario). Oggi non ha
  utilizzatori: il frontend usa il WebSocket dell'engine.
- `docs/MVSP.md`: baseline di sicurezza minima del prototipo.

## Comandi

```sh
corepack pnpm start          # engine su http://127.0.0.1:3000 (opzioni: --level, --port, --host)
corepack pnpm test           # test di level, engine e harness
corepack pnpm build          # build TypeScript del harness
corepack pnpm test:live      # test live con Gemini AI Studio e GEMINI_API_KEY
corepack pnpm test:live:nim  # test live NVIDIA NIM con NVIDIA_API_KEY
```
