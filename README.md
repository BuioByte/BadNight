# BadNight

Gioco a tema Halloween sviluppato durante un hackathon.

Un bambino si sveglia di notte in un castello infestato e deve raggiungere la camera da letto dei genitori.
Lungo la strada risolve enigmi e parla con i fantasmi che abitano le stanze e che possono aiutarlo.
Il progresso si misura in stanze attraversate, partendo da quella in cui si è svegliato.

## Prototipo

Il primo livello è volutamente ridotto:

- **3 stanze**: cameretta del bambino → salone → camera dei genitori
- **2 fantasmi per stanza**
- **pochi enigmi**, al massimo un paio per stanza

## Architettura

Il progetto ha due componenti:

### Engine (Node)

Server locale in Node.js. Tiene lo stato della partita ed è l'unica fonte di verità sulle regole.

- **Livello in YAML**: stanze, uscite, oggetti, fantasmi ed enigmi sono descritti in un file YAML,
  che l'engine carica e valida all'avvio.
- **Oggetti e azioni**: ogni oggetto (e ogni fantasma) ha una lista di azioni possibili.
  Ogni azione ha una lista ordinata di esiti possibili: vale il primo la cui condizione è vera.
  Un esito ha un testo e degli effetti, ad esempio cambiare lo stato di un oggetto, mettere qualcosa
  nell'inventario o completare un traguardo.
- **Stato di una stanza**: è lo stato dei suoi contenuti (bambino, oggetti, fantasmi)
  più un **DAG di traguardi**. Un traguardo si può completare solo quando tutti i suoi prerequisiti
  sono completati, e le uscite si sbloccano al completamento di traguardi. All'avvio l'engine
  verifica che il grafo non abbia cicli.
- **Tool per un agente AI**: l'engine espone dei tool a un agente AI guidato dal giocatore:
  - `look`: informazioni sulla stanza
  - `examine`: dettagli di un oggetto o di un fantasma
  - `act`: esegue un'azione
  - `move`: passa a una stanza adiacente
  - `talk`: parla con un fantasma

  Ogni azione restituisce un feedback con la variazione dello stato
  (oggetti cambiati, inventario, traguardi raggiunti, vittoria).
- **Dialoghi con i fantasmi**: generati da **Gemma 4** via API (Gemini API).
  I dialoghi non sono scritti a mano: l'engine passa al modello la personalità del fantasma
  e solo le informazioni sbloccate dai traguardi raggiunti. Così il fantasma non può rivelare
  più di quanto previsto, e la progressione resta decisa dall'engine, non dal modello.
- **Voce dei fantasmi** (opzionale, se c'è tempo): sintesi vocale con **ElevenLabs** via API,
  con una voce per ogni fantasma.

Le chiavi API restano solo lato server, nel file `.env`, che non va committato.

Il caricamento dei livelli, lo stato della partita e i tool per l'agente sono nel modulo
[`packages/level`](packages/level/README.md). Il server CLI, l'API REST e la pagina web sono in
[`packages/engine`](packages/engine/README.md).

```sh
npm install
npm start     # stampa il link alla pagina web
```

### Frontend (pagina web)

Pagina web servita dall'engine e collegata alle sue API. Mostra:

- la stanza corrente, gli oggetti, i fantasmi e le uscite
- l'inventario
- la chat con i fantasmi e con l'agente
- l'atmosfera: notte, buio, luce di candela, suoni

## Stato

Prima versione del README: struttura, API e istruzioni di avvio saranno aggiunte man mano.
