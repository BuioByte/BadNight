// WebSocket verso l'engine su /ws: messaggi JSON { type, ... } nei due sensi.
// Se la connessione cade si riapre; l'engine rimanda subito `state` (e `ready` se non c'è un turno in corso).

const RECONNECT_DELAY = 1000;

// handlers: { [type]: (msg) => void }, più onOpen / onClose opzionali.
export function connect(handlers, { onOpen, onClose } = {}) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  let ws;

  function open() {
    ws = new WebSocket(url);
    ws.onopen = () => onOpen?.();
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return console.debug('Messaggio non JSON dall\'engine:', ev.data);
      }
      const handler = handlers[msg?.type];
      if (handler) handler(msg);
      else console.debug('Messaggio ignorato:', msg);
    };
    ws.onclose = () => {
      onClose?.();
      setTimeout(open, RECONNECT_DELAY);
    };
  }

  open();

  return {
    // Restituisce false se la connessione non è aperta: il messaggio non parte.
    send(msg) {
      if (ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(msg));
      return true;
    },
  };
}
