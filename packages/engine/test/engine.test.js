import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLevelFile } from '@badnight/level';
import { createEngine, createHttpServer, createTools } from '../src/index.js';

const level = await loadLevelFile(
  fileURLToPath(new URL('../levels/level-1.yaml', import.meta.resolve('@badnight/level'))),
);

test('i tool chiamano la partita e finiscono nel log', () => {
  const engine = createEngine(level);
  const tools = createTools(engine);
  assert.deepEqual(tools.map((t) => t.name), ['look', 'examine', 'act', 'move', 'talk']);

  const act = tools.find((t) => t.name === 'act');
  const r = act.handler({ target: 'comodino', action: 'apri' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.changes.inventory, { added: [{ id: 'candela', name: 'Mozzicone di candela' }] });

  const s = engine.snapshot();
  assert.equal(s.seq, 1);
  assert.equal(s.events[0].source, 'agent');
  assert.equal(s.events[0].tool, 'act');
  assert.deepEqual(s.view.inventory, [{ id: 'candela', name: 'Mozzicone di candela' }]);
  assert.deepEqual(engine.snapshot({ since: 1 }).events, []);
});

test('reset ricomincia la partita e cambia run', () => {
  const engine = createEngine(level);
  engine.call('act', { target: 'comodino', action: 'apri' });
  engine.reset();
  const s = engine.snapshot();
  assert.equal(s.run, 2);
  assert.equal(s.seq, 0);
  assert.deepEqual(s.view.inventory, []);
});

test('API REST', async (t) => {
  const engine = createEngine(level);
  const server = createHttpServer(engine, { publicDir: fileURLToPath(new URL('../public', import.meta.url)) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  let res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);

  res = await post('/api/tools/act', { target: 'comodino', action: 'apri' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);

  res = await post('/api/tools/move', { to: 'salone' });
  assert.equal((await res.json()).text, 'La porta è chiusa a chiave.');

  res = await post('/api/tools/examine', { target: 'drago' });
  const bad = await res.json();
  assert.equal(bad.ok, false);
  assert.match(bad.error, /comodino/);

  const s = await (await fetch(`${base}/api/state?since=1`)).json();
  assert.equal(s.seq, 3);
  assert.deepEqual(s.events.map((e) => [e.source, e.tool]), [['http', 'move'], ['http', 'examine']]);
  assert.equal(s.level.title, 'La prima notte');

  res = await fetch(`${base}/api/tools/act`, { method: 'POST', body: '[1]' });
  assert.equal(res.status, 400);
  res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  res = await fetch(`${base}/%2e%2e/package.json`);
  assert.equal(res.status, 404);

  res = await post('/api/reset', {});
  assert.equal((await res.json()).run, 2);
});
