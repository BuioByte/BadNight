import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLevelFile } from '@badnight/level';
import { AI_ERROR_MESSAGE, createEngine, describeError, devAgent, startLlmLog } from '../src/index.js';

const level = await loadLevelFile(fileURLToPath(new URL('fixtures/level.yaml', import.meta.url)));

// Come gli errori del Gemini SDK: status e il JSON della risposta come messaggio.
class ApiError extends Error {
  name = 'ApiError';
  constructor(status, body) {
    super(JSON.stringify(body));
    this.status = status;
  }
}
const internal = () => new ApiError(500, { error: { code: 500, message: 'Internal error encountered.', status: 'INTERNAL' } });

test('il log LLM riparte vuoto, registra richiesta e risposta e oscura la chiave', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'badnight-log-'));
  const file = join(dir, 'sub', 'llm.log');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 500, status: 'INTERNAL' } }), { status: 500, statusText: 'Internal Server Error' });
  t.after(async () => {
    globalThis.fetch = realFetch;
    await rm(dir, { recursive: true });
  });

  let stop = startLlmLog(file);
  await fetch('https://example.test/v1/models/m:generateContent?key=SEGRETA', { method: 'POST', body: '{"contents":[1]}' });
  stop();
  await writeFile(file, (await readFile(file, 'utf8')) + 'righe del vecchio avvio\n');

  stop = startLlmLog(file);
  const res = await fetch('https://example.test/v1/models/m:generateContent?key=SEGRETA&alt=json', {
    method: 'POST',
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Action: guardo' }] }] }),
  });
  assert.equal((await res.json()).error.status, 'INTERNAL', 'chi chiama riceve la risposta intatta');
  await new Promise((r) => setTimeout(r, 20));
  stop();
  assert.notEqual(globalThis.fetch.name, 'loggedFetch', 'stop ripristina il fetch originale');

  const log = await readFile(file, 'utf8');
  assert.doesNotMatch(log, /vecchio avvio/, 'svuotato a ogni avvio');
  assert.doesNotMatch(log, /SEGRETA/);
  assert.match(log, /=== #1 .* POST https:\/\/example\.test\/v1\/models\/m:generateContent\?key=\[oscurata\]&alt=json/);
  assert.match(log, /--- richiesta\n\{\n {2}"contents"/);
  assert.match(log, /"text": "Action: guardo"/);
  assert.match(log, /--- risposta 500 Internal Server Error in \d+ ms\n\{\n {2}"error"/);
});

test('il log LLM registra gli errori di rete e li rilancia', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'badnight-log-'));
  const file = join(dir, 'llm.log');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND example.test') });
  };
  const stop = startLlmLog(file);
  t.after(async () => {
    stop();
    globalThis.fetch = realFetch;
    await rm(dir, { recursive: true });
  });

  await assert.rejects(fetch('https://example.test/'), /fetch failed/);
  assert.match(await readFile(file, 'utf8'), /--- errore di rete dopo \d+ ms: fetch failed \(getaddrinfo ENOTFOUND example\.test\)/);
});

test("describeError riassume l'errore del provider e la catena delle cause", () => {
  assert.equal(describeError(internal()), 'ApiError: 500 INTERNAL Internal error encountered.');
  assert.equal(
    describeError(new Error(AI_ERROR_MESSAGE, { cause: internal() })),
    `${AI_ERROR_MESSAGE} ← ApiError: 500 INTERNAL Internal error encountered.`,
  );
  const harness = new Error('Invalid arguments for tool "act": must have required property \'action\'');
  harness.name = 'ToolArgumentsError';
  assert.equal(describeError(harness), 'ToolArgumentsError: Invalid arguments for tool "act": must have required property \'action\'');
  assert.equal(describeError(new Error('OpenAI-compatible API request failed with status 502.')), 'OpenAI-compatible API request failed with status 502.');
});

test("l'engine emette 'turn' con durata, tool usati ed eventuale errore", async () => {
  const ok = createEngine(level, { agent: devAgent });
  const turns = [];
  ok.on('turn', (t) => turns.push(t));
  await ok.input('act comodino apri');

  const failing = createEngine(level, { agent: async () => { throw new Error(AI_ERROR_MESSAGE, { cause: internal() }); } });
  failing.on('turn', (t) => turns.push(t));
  await failing.input('guardo');

  assert.equal(turns[0].text, 'act comodino apri');
  assert.equal(turns[0].tools, 1);
  assert.equal(turns[0].error, undefined);
  assert.ok(turns[0].ms >= 0);
  assert.equal(turns[1].tools, 0);
  assert.equal(turns[1].error.cause.status, 500);
});
