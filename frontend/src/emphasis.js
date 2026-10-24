// Markdown minimo nel testo del narratore: **grassetto** e *corsivo*. Tutto il resto resta testo,
// compresi gli asterischi senza coppia. I nodi si costruiscono con textContent: il testo del modello
// non diventa mai HTML.

const TOKEN = /\*\*([^*\n]+?)\*\*|\*([^*\s][^*\n]*?)\*/g;

// "Vedi il **letto**." → [{ text: 'Vedi il ' }, { text: 'letto', tag: 'strong' }, { text: '.' }]
export function parseEmphasis(text) {
  const segments = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    segments.push(m[1] !== undefined ? { text: m[1], tag: 'strong' } : { text: m[2], tag: 'em' });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

// Il testo visibile, senza i marcatori.
export function plainText(segments) {
  return segments.map((s) => s.text).join('');
}

// Mostra in `el` i primi `count` caratteri visibili (tutti, se manca): serve all'effetto macchina da scrivere.
export function renderEmphasis(el, segments, count = Infinity) {
  const nodes = [];
  let left = count;
  for (const { text, tag } of segments) {
    if (left <= 0) break;
    const chars = [...text];
    const part = chars.slice(0, left).join('');
    left -= chars.length;
    if (!tag) nodes.push(document.createTextNode(part));
    else {
      const node = document.createElement(tag);
      node.textContent = part;
      nodes.push(node);
    }
  }
  el.replaceChildren(...nodes);
}
