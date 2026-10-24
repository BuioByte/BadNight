import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { loadLevelFile } from '@badnight/level';
import { createEngine, createHttpServer, devAgent } from '../src/index.js';

const level = await loadLevelFile(
  fileURLToPath(new URL('fixtures/level.yaml', import.meta.url)),
);

// Raccoglie i messaggi emessi dall'engine.
function record(engine) {
  const messages = [];
  engine.on('message', (m) => messages.push(m));
  return messages;
}

test('un turno: input, tool, respond, state, ready', async () => {
  const engine = createEngine(level, {
    agent: async (text, tools) => {
      const t = Object.fromEntries(tools.map((x) => [x.name, x.handler]));
      const r = t.act({ target: 'comodino', action: 'apri' });
      t.respond({ text: r.text });
    },
  });
  assert.deepEqual(engine.tools.map((t) => t.name), ['look', 'examine', 'act', 'move', 'talk', 'respond']);

  const messages = record(engine);
  assert.equal(await engine.input('apro il comodino'), true);
  assert.deepEqual(messages.map((m) => m.type), ['input', 'tool', 'output', 'state', 'ready']);
  assert.deepEqual(messages[1].result.changes.revealed, [{ id: 'candela', name: 'Mozzicone di candela' }]);
  assert.match(messages[2].text, /mozzicone di candela/);

  const state = messages[3];
  assert.equal(state.busy, false);
  assert.ok(state.view.objects.some((o) => o.id === 'candela'));
  assert.deepEqual(state.history.map((m) => m.seq), [1, 2, 3]);
});

test('un secondo input durante il turno viene rifiutato', async () => {
  let release;
  const engine = createEngine(level, { agent: () => new Promise((r) => (release = r)) });
  const turn = engine.input('uno');
  assert.equal(engine.busy, true);
  assert.equal(await engine.input('due'), false);
  assert.equal(engine.reset(), false);
  release();
  await turn;
  assert.equal(engine.busy, false);
});

test("se l'agente fallisce o non risponde il turno finisce comunque con ready", async () => {
  for (const agent of [async () => { throw new Error('boom'); }, () => new Promise(() => {})]) {
    const engine = createEngine(level, { agent, turnTimeout: 20 });
    const messages = record(engine);
    await engine.input('ciao');
    assert.deepEqual(messages.map((m) => m.type), ['input', 'error', 'state', 'ready']);
  }
});

test('reset ricomincia la partita', async () => {
  const engine = createEngine(level, { agent: devAgent });
  await engine.input('act comodino apri');
  assert.equal(engine.reset(), true);
  const s = engine.snapshot();
  assert.deepEqual(s.history, []);
  assert.ok(!s.view.objects.some((o) => o.id === 'candela'));
});

test('WebSocket', async (t) => {
  const engine = createEngine(level, { agent: devAgent });
  const server = createHttpServer(engine, { publicDir: fileURLToPath(new URL('../public', import.meta.url)) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `127.0.0.1:${server.address().port}`;

  const res = await fetch(`http://${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`http://${base}/%2e%2e/package.json`)).status, 404);

  const ws = new WebSocket(`ws://${base}/ws`);
  t.after(() => {
    ws.close();
    server.close();
  });
  const inbox = [];
  const waiters = [];
  ws.on('message', (data) => {
    inbox.push(JSON.parse(data));
    waiters.splice(0).forEach((w) => w());
  });
  // Attende e restituisce i messaggi fino al primo del tipo indicato (compreso).
  const until = async (type) => {
    while (!inbox.some((m) => m.type === type)) await new Promise((r) => waiters.push(r));
    return inbox.splice(0, inbox.findIndex((m) => m.type === type) + 1);
  };
  await once(ws, 'open');

  let got = await until('ready');
  assert.deepEqual(got.map((m) => m.type), ['state', 'ready']);
  assert.equal(got[0].level.title, 'Livello di test');

  ws.send(JSON.stringify({ type: 'input', text: 'move salone' }));
  got = await until('ready');
  assert.deepEqual(got.map((m) => m.type), ['input', 'tool', 'output', 'state', 'ready']);
  assert.equal(got[2].text, 'La porta è chiusa a chiave.');

  ws.send('non json');
  ws.send(JSON.stringify({ type: 'dance' }));
  ws.send(JSON.stringify({ type: 'input', text: '  ' }));
  got = [...(await until('error')), ...(await until('error')), ...(await until('error'))];
  assert.deepEqual(got.map((m) => m.type), ['error', 'error', 'error']);

  ws.send(JSON.stringify({ type: 'reset' }));
  got = await until('state');
  assert.deepEqual(got.at(-1).history, []);
});

test('shutdown chiude i WebSocket aperti e il server', async () => {
  const engine = createEngine(level, { agent: devAgent });
  const server = createHttpServer(engine, { publicDir: fileURLToPath(new URL('../public', import.meta.url)) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  await once(ws, 'open');

  const closed = once(ws, 'close');
  await server.shutdown();
  const [code] = await closed;
  assert.equal(code, 1001);
  assert.equal(server.listening, false);
});

test('alla vittoria il finale non è in nessun output: lo mostra il frontend da level.outro', async () => {
  const engine = createEngine(level, { agent: devAgent });
  const messages = record(engine);
  await engine.input('act porta apri');
  await engine.input('move salone');

  const state = messages.filter((m) => m.type === 'state').at(-1);
  assert.equal(state.won, true);
  assert.equal(state.level.outro, level.outro);
  for (const m of messages.filter((m) => m.type === 'output')) assert.ok(!m.text.includes(level.outro), m.text);
});
