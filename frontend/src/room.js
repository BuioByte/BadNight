// Dove si trova il bambino: titolo del livello, stanza, progresso, uscite e traguardi raggiunti.

export function createRoom({ levelTitle, roomName, progress, exits, milestones }) {
  return {
    render({ level, view, completed }) {
      document.title = `BadNight · ${view.room.name}`;
      levelTitle.textContent = level.title;
      roomName.textContent = view.room.name;

      // Una candela per stanza: accesa se visitata.
      const { visited, total } = view.progress;
      progress.replaceChildren(
        ...Array.from({ length: total }, (_, i) => {
          const c = document.createElement('span');
          c.className = i < visited ? 'candle lit' : 'candle';
          return c;
        }),
      );
      progress.title = `Stanze visitate: ${visited} su ${total}`;
      progress.setAttribute('aria-label', progress.title);

      exits.textContent = view.exits.length
        ? `Uscite: ${view.exits.map((e) => (e.open ? e.name : `${e.name} (chiusa)`)).join(' · ')}`
        : 'Nessuna uscita.';

      milestones.replaceChildren(
        ...completed.map((m) => {
          const li = document.createElement('li');
          li.textContent = m.description;
          return li;
        }),
      );
    },
  };
}
