// WebSocket su /ws: messaggi JSON { type, ... } nei due sensi.
//
// Frontend → engine:  { type: 'input', text }   testo libero del giocatore
//                     { type: 'reset' }         nuova partita
// Engine → frontend:  i messaggi dell'engine (state, input, tool, output, error, ready), più
//                     { type: 'error', error } per i messaggi rifiutati.
//
// Una sola sessione: i messaggi vanno a tutte le connessioni aperte (in pratica una).

import { WebSocketServer } from 'ws';

export function attachWebSocket(server, engine) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  // ws rilancia qui gli errori del server HTTP (es. porta occupata), che gestisce già chi chiama listen.
  wss.on('error', () => {});

  const broadcast = (msg) => {
    const data = JSON.stringify(msg);
    for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(data);
  };
  engine.on('message', broadcast);
  server.on('close', () => engine.off('message', broadcast));

  wss.on('connection', (ws) => {
    const send = (msg) => ws.send(JSON.stringify(msg));
    send(engine.snapshot());
    if (!engine.busy) send({ type: 'ready' });

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return send({ type: 'error', error: 'Il messaggio deve essere JSON.' });
      }
      switch (msg?.type) {
        case 'input':
          if (typeof msg.text !== 'string' || !msg.text.trim()) return send({ type: 'error', error: 'Manca "text".' });
          if (engine.busy) return send({ type: 'error', error: 'Un turno è già in corso: attendi "ready".' });
          engine.input(msg.text.trim());
          break;
        case 'reset':
          if (!engine.reset()) send({ type: 'error', error: 'Un turno è in corso: attendi "ready".' });
          break;
        default:
          send({ type: 'error', error: `Tipo di messaggio sconosciuto: ${JSON.stringify(msg?.type)}.` });
      }
    });
  });

  return wss;
}
