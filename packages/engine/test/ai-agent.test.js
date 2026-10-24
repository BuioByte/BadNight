// Integrazione engine ↔ harness AI: harness vero, modello finto (nessuna chiamata di rete).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLevelFile } from '@badnight/level';
import { AI_ERROR_MESSAGE, createAiAgent, createEngine } from '../src/index.js';

const level = await loadLevelFile(
  fileURLToPath(new URL('fixtures/level.yaml', import.meta.url)),
);

// Risposte del modello nel formato del Gemini SDK, come nei test del harness.
const say = (text) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] } }], text });
const call = (name, args) => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args } }] } }] });

// Client finto: ogni richiesta riceve la risposta successiva della coda (o una funzione che la produce).
function fakeClient(responses) {
  const requests = [];
  return {
    requests,
    models: {
      async generateContent(request) {
        requests.push(structuredClone(request));
        const next = responses.shift();
        if (!next) throw new Error('Richiesta al modello non prevista.');
        return typeof next === 'function' ? next() : next;
      },
    },
  };
}

function setup(responses, engineOptions) {
  const client = fakeClient(responses);
  const agent = createAiAgent(level, { client });
  const engine = createEngine(level, { agent, ...engineOptions });
  const messages = [];
  engine.on('message', (m) => messages.push(m));
  return { client, engine, messages };
}

// Testi dei messaggi `user` di una richiesta (azioni del giocatore e risultati dei tool esclusi).
const userTexts = (request) =>
  request.contents.filter((c) => c.role === 'user').flatMap((c) => c.parts.filter((p) => p.text).map((p) => p.text));

test("un turno: il modello usa i tool di gioco e la narrazione arriva al giocatore", async () => {
  const { client, engine, messages } = setup([
    call('act', { target: 'comodino', action: 'apri' }),
    say('Ho aperto il comodino.'),
    say('Apri il cassetto: dentro c\'è un mozzicone di candela.'),
  ]);

  await engine.input('apro il comodino');

  assert.deepEqual(messages.map((m) => m.type), ['input', 'tool', 'output', 'state', 'ready']);
  assert.equal(messages[1].tool, 'act');
  assert.deepEqual(messages[1].result.changes.revealed, [{ id: 'candela', name: 'Mozzicone di candela' }]);
  assert.equal(messages[2].text, 'Apri il cassetto: dentro c\'è un mozzicone di candela.');
  assert.ok(engine.game.look().objects.some((o) => o.id === 'candela'));

  // Il risultato del tool torna al modello.
  const response = client.requests[1].contents.flatMap((c) => c.parts).find((p) => p.functionResponse);
  assert.equal(response.functionResponse.name, 'act');
  assert.equal(response.functionResponse.response.ok, true);
});

test('al modello vanno i tool di gioco, non respond, e il prompt del livello', async () => {
  const { client, engine } = setup([say('Ok.'), say('Sei nella cameretta.')]);
  await engine.input('dove sono?');

  const { config } = client.requests[0];
  const names = config.tools[0].functionDeclarations.map((d) => d.name);
  assert.deepEqual(names, ['look', 'examine', 'act', 'move', 'talk']);
  assert.match(config.systemInstruction, /Livello di test/);
  assert.match(config.systemInstruction, /in italiano/);
  assert.match(config.systemInstruction, /al massimo due chiamate/);
  assert.match(config.systemInstruction, /usa al massimo look, poi fermati/);
  assert.match(config.systemInstruction, /chiede a un fantasma di fare qualcosa, usa act sul fantasma/);
  assert.match(config.systemInstruction, /solo se il risultato di act o move lo conferma in changes/);
  assert.ok(!config.systemInstruction.includes(level.outro), 'il finale lo mostra la pagina, non il modello');
});

test('la conversazione continua tra i turni e riparte con una nuova partita', async () => {
  const { client, engine } = setup([
    say('Ok.'), say('Prima risposta.'),
    say('Ok.'), say('Seconda risposta.'),
    say('Ok.'), say('Dopo il reset.'),
  ]);

  await engine.input('primo');
  await engine.input('secondo');
  assert.deepEqual(userTexts(client.requests[2]), ['Action: primo', 'Action: secondo']);

  engine.reset();
  await engine.input('terzo');
  assert.deepEqual(userTexts(client.requests[4]), ['Action: terzo']);
});

test('un errore di un tool di gioco torna al modello, che si corregge', async () => {
  const { client, engine, messages } = setup([
    call('examine', { target: 'pianoforte' }),
    call('examine', { target: 'letto' }),
    say('Fatto.'),
    say('Il letto ha le coperte arruffate.'),
  ]);

  await engine.input('guardo il pianoforte e il letto');

  const results = client.requests.flatMap((r) => r.contents.flatMap((c) => c.parts)).filter((p) => p.functionResponse);
  assert.equal(results[0].functionResponse.response.ok, false);
  assert.match(results[0].functionResponse.response.error, /letto/);
  assert.equal(messages.filter((m) => m.type === 'output').at(-1).text, 'Il letto ha le coperte arruffate.');
});

test("se il harness fallisce il giocatore riceve un messaggio semplice e la conversazione non cambia", async () => {
  const { client, engine, messages } = setup([
    call('act', { target: 'comodino' }), // manca "action": il harness rifiuta gli argomenti
    say('Ok.'), say('Riprovo.'),
  ]);
  const errors = [];
  engine.on('agentError', (e) => errors.push(e));

  await engine.input('apro');
  assert.deepEqual(messages.map((m) => m.type), ['input', 'error', 'state', 'ready']);
  assert.equal(messages[1].error, AI_ERROR_MESSAGE);
  assert.equal(errors[0].cause.name, 'ToolArgumentsError');

  // Il turno fallito non entra nella history.
  await engine.input('riprovo');
  assert.deepEqual(userTexts(client.requests[1]), ['Action: riprovo']);
});

test("dopo un timeout l'agente in ritardo non cambia lo stato né risponde", async () => {
  let release;
  const late = new Promise((r) => (release = r));
  const { engine, messages } = setup(
    [async () => { await late; return call('act', { target: 'comodino', action: 'apri' }); }, say('Ok.'), say('Troppo tardi.')],
    { turnTimeout: 20 },
  );

  await engine.input('apro il comodino');
  assert.deepEqual(messages.map((m) => m.type), ['input', 'error', 'state', 'ready']);

  release();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(messages.length, 4, 'nessun messaggio dopo ready');
  assert.equal(engine.game.state.entities.comodino.state, 'chiuso');
});

test('senza chiave API la configurazione fallisce subito', () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.throws(() => createAiAgent(level, { provider: 'gemini' }), /GEMINI_API_KEY/);
  } finally {
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  }
});

test('al modello non arrivano gli asset, al frontend sì', async () => {
  const { client, messages, engine } = setup([
    call('look', {}),
    call('act', { target: 'comodino', action: 'apri' }),
    say('Fatto.'),
    say('Apri il cassetto.'),
  ]);
  await engine.input('apro il comodino');

  const toModel = client.requests.at(-1).contents.flatMap((c) => c.parts).filter((p) => p.functionResponse);
  assert.equal(toModel.length, 2);
  assert.doesNotMatch(JSON.stringify(toModel), /"asset"/);
  assert.equal(toModel[0].functionResponse.response.room.id, 'cameretta');

  const tools = messages.filter((m) => m.type === 'tool');
  assert.equal(tools[0].result.room.asset, 'room_cameretta');
  assert.equal(tools[1].result.changes.states[0].asset, 'object_comodino');
});
