// Agente di sviluppo, da usare finché non è collegato l'agente AI vero.
// Non interpreta il linguaggio naturale: accetta comandi come "act letto guarda_sotto",
// chiama il tool corrispondente e risponde con `respond`, come farà l'agente.

const PARAMS = { examine: ['target'], act: ['target', 'action'], move: ['to'], talk: ['ghost'] };
const HELP = 'Comandi: look | examine <id> | act <id> <azione> | move <stanza> | talk <fantasma>';

export async function devAgent(text, tools) {
  const tool = (name) => tools.find((t) => t.name === name).handler;
  const [cmd, ...rest] = text.trim().split(/\s+/);
  if (!(cmd in PARAMS) && cmd !== 'look') return tool('respond')({ text: HELP });

  const args = Object.fromEntries((PARAMS[cmd] ?? []).map((p, i) => [p, rest[i]]));
  const r = tool(cmd)(args);
  tool('respond')({ text: describe(cmd, r) });
}

function describe(cmd, r) {
  if (!r.ok) return r.error;
  switch (cmd) {
    case 'look': {
      const names = (xs) => xs.map((x) => `${x.name} (${x.id})`).join(', ') || 'nessuno';
      const exits = r.exits.map((e) => `${e.name} (${e.to})${e.open ? '' : ' [chiusa]'}`).join(', ');
      return `${r.room.name}. ${r.room.description}\nOggetti: ${names(r.objects)}\nFantasmi: ${names(r.ghosts)}\nUscite: ${exits}`;
    }
    case 'examine':
      return `${r.target.description}\nAzioni: ${r.target.actions.map((a) => a.name).join(', ') || 'nessuna'}`;
    case 'talk':
      return `${r.ghost.name}: ${r.knowledge.join(' ')}`;
    default:
      return r.text;
  }
}
