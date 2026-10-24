// Il giocatore va avanti solo quando l'engine ha risposto.
// L'input parte bloccato e si sblocca soltanto con `ready`: non bastano `output`, `state` o un timer.
// Si blocca di nuovo prima di inviare, così un doppio Enter non manda due messaggi.

export function createTurn({ text, send, reset, status }) {
  let locked = true;
  let won = false;
  let message = 'il castello si risveglia…';

  function apply() {
    text.disabled = locked || won;
    send.disabled = locked || won;
    reset.disabled = locked;
    document.body.classList.toggle('locked', locked);
    status.textContent = locked ? message : won ? 'Sei arrivato. Vuoi vivere una nuova notte?' : '';
    if (!locked && !won) text.focus();
  }

  return {
    get locked() {
      return locked;
    },
    lock(why = 'il castello sussurra…') {
      locked = true;
      message = why;
      apply();
    },
    // Solo per il messaggio `ready` dell'engine.
    ready() {
      locked = false;
      apply();
    },
    setWon(value) {
      won = value;
      apply();
    },
  };
}
