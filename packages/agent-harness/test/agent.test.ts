import assert from 'node:assert/strict';
import test from 'node:test';
import type { Content, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import {
  MaxToolRoundsError,
  ToolArgumentsError,
  UnknownToolError,
  createAgent,
} from '../src/agent.js';
import { createToolRegistry } from '../src/tool-registry.js';
import type { AgentTool, ToolExecutor } from '../src/agent.types.js';

function modelResponse(parts: Content['parts'], text?: string): GenerateContentResponse {
  return {
    candidates: [{ content: { role: 'model', parts } }],
    get text() {
      return text;
    },
  } as unknown as GenerateContentResponse;
}

function fakeClient(responses: GenerateContentResponse[]) {
  const requests: unknown[] = [];
  const client = {
    models: {
      generateContent: async (request: unknown) => {
        requests.push(request);
        const response = responses.shift();
        if (!response) throw new Error('Unexpected model request.');
        return response;
      },
    },
  } as unknown as GoogleGenAI;
  return { client, requests };
}

const lookTool: AgentTool = {
  name: 'look',
  description: 'Describe the current room.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

function registryFor(tools: AgentTool[], execute: ToolExecutor) {
  const registry = createToolRegistry();
  for (const tool of tools) registry.register(tool, (args) => execute(tool.name, args));
  return registry;
}

test('registers tool definitions and dispatches calls by name', async () => {
  const registry = createToolRegistry();
  registry.register(lookTool, (args) => ({ room: args.room }));

  assert.deepEqual(registry.definitions(), [lookTool]);
  assert.deepEqual(await registry.execute('look', { room: 'bedroom' }), { room: 'bedroom' });
});

test('rejects duplicate tool names', () => {
  const registry = createToolRegistry();
  registry.register(lookTool, () => ({}));

  assert.throws(() => registry.register(lookTool, () => ({})), /already registered/);
});

test('returns a direct model response and appends the turn to history', async () => {
  const { client, requests } = fakeClient([
    modelResponse([{ text: 'Room details.' }], 'Room details.'),
    modelResponse([{ text: 'A cozy room.' }], 'A cozy room.'),
  ]);
  const agent = createAgent({ client, systemInstruction: 'Be gentle.', registry: createToolRegistry() });

  const result = await agent.runTurn({ action: 'What do I see?' });

  assert.equal(result.text, 'A cozy room.');
  assert.deepEqual(result.history.map((item) => item.role), ['user', 'model', 'model']);
  const firstRequest = requests[0] as { contents: { parts: { text?: string }[] }[] };
  assert.equal(firstRequest.contents[0]?.parts[0]?.text, 'Action: What do I see?');
});

test('rejects a blank action before contacting the model', async () => {
  const { client, requests } = fakeClient([]);
  const agent = createAgent({ client, systemInstruction: 'Be gentle.', registry: createToolRegistry() });

  await assert.rejects(agent.runTurn({ action: '  ' }), /action must not be empty/);
  assert.equal(requests.length, 0);
});

test('carries the earlier story into the next player turn', async () => {
  const { client, requests } = fakeClient([
    modelResponse([{ text: 'A shadow is under the door.' }], 'A shadow is under the door.'),
    modelResponse([{ text: 'A shadow slips beneath the bedroom door.' }], 'A shadow slips beneath the bedroom door.'),
    modelResponse([{ text: 'Drawer detail.' }], 'Drawer detail.'),
    modelResponse([{ text: 'The old drawer gives a soft creak.' }], 'The old drawer gives a soft creak.'),
  ]);
  const agent = createAgent({ client, systemInstruction: 'Keep the story spooky.', registry: createToolRegistry() });

  const firstTurn = await agent.runTurn({ action: 'Listen at the door.' });
  const secondTurn = await agent.runTurn({
    action: 'Open the drawer.',
    thinking: 'Maybe the sound came from there.',
    history: firstTurn.history,
  });

  const secondRequest = requests[2] as { contents: { parts: { text?: string }[] }[] };
  assert.equal(firstTurn.history.length, 3);
  assert.equal(secondRequest.contents[0]?.parts[0]?.text, 'Action: Listen at the door.');
  assert.equal(secondRequest.contents[2]?.parts[0]?.text, 'A shadow slips beneath the bedroom door.');
  assert.equal(secondRequest.contents[3]?.parts[0]?.text,
    'Action: Open the drawer.\nThinking (optional): Maybe the sound came from there.');
  assert.equal(secondTurn.text, 'The old drawer gives a soft creak.');
});

test('runs a tool and returns the model response after its result', async () => {
  const { client, requests } = fakeClient([
    modelResponse([{ functionCall: { name: 'look', args: {}, id: 'call-1' } }]),
    modelResponse([{ text: 'A candle is in the room.' }], 'A candle is in the room.'),
    modelResponse([{ text: 'You see a candle.' }], 'You see a candle.'),
  ]);
  const calls: string[] = [];
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    registry: registryFor([lookTool], (name) => {
      calls.push(name);
      return { room: 'bedroom' };
    }),
  });

  const result = await agent.runTurn({ action: 'Look around.' });

  assert.deepEqual(calls, ['look']);
  assert.equal(result.text, 'You see a candle.');
  assert.equal(result.history[2]?.role, 'user');
  assert.deepEqual(result.history[2]?.parts, [
    { functionResponse: { name: 'look', id: 'call-1', response: { room: 'bedroom' } } },
  ]);
  const firstRequest = requests[0] as {
    model: string;
    config: { systemInstruction: string; tools: { functionDeclarations: { name?: string }[] }[]; thinkingConfig: { thinkingLevel: string } };
  };
  assert.equal(firstRequest.model, 'gemma-4-31b-it');
  assert.equal(firstRequest.config.thinkingConfig.thinkingLevel, 'HIGH');
  assert.match(firstRequest.config.systemInstruction, /Be gentle\./);
  assert.match(firstRequest.config.systemInstruction, /child around six years old/);
  assert.match(firstRequest.config.systemInstruction, /atmospheric horror story/);
  assert.match(firstRequest.config.systemInstruction, /spooky and suspenseful/);
  assert.match(firstRequest.config.systemInstruction, /non-graphic/);
  assert.match(firstRequest.config.systemInstruction, /Never suggest going outside/);
  assert.match(firstRequest.config.systemInstruction, /tool results as the only source of truth/);
  assert.equal(firstRequest.config.tools[0]?.functionDeclarations[0]?.name, 'look');
  const narrationRequest = requests[2] as { model: string; config: { tools?: unknown } };
  assert.equal(narrationRequest.model, 'gemma-4-26b-a4b-it');
  assert.equal(narrationRequest.config.tools, undefined);
});

test('lets the model recover from a game tool error result', async () => {
  const actTool: AgentTool = {
    name: 'act',
    description: 'Try an action on a room object.',
    parameters: {
      type: 'object',
      properties: { target: { type: 'string' }, action: { type: 'string' } },
      required: ['target', 'action'],
    },
  };
  const { client } = fakeClient([
    modelResponse([{ functionCall: { name: 'act', args: { target: 'door', action: 'open' }, id: 'act-1' } }]),
    modelResponse([{ functionCall: { name: 'look', args: {}, id: 'look-1' } }]),
    modelResponse([{ text: 'The door remains locked. A bell rings.' }], 'The door remains locked. A bell rings.'),
    modelResponse([{ text: 'The door stays shut. From the hallway, a small bell rings once.' }],
      'The door stays shut. From the hallway, a small bell rings once.'),
  ]);
  const calls: string[] = [];
  const agent = createAgent({
    client,
    systemInstruction: 'Keep the story spooky.',
    registry: registryFor([actTool, lookTool], (name) => {
      calls.push(name);
      return name === 'act'
        ? { ok: false, error: 'The door is locked.' }
        : { ok: true, room: 'Cameretta', exits: ['salone'] };
    }),
  });

  const result = await agent.runTurn({ action: 'Open the door.' });

  assert.deepEqual(calls, ['act', 'look']);
  assert.deepEqual(result.history[2]?.parts, [
    { functionResponse: { name: 'act', id: 'act-1', response: { ok: false, error: 'The door is locked.' } } },
  ]);
  assert.equal(result.text, 'The door stays shut. From the hallway, a small bell rings once.');
});

test('demo: sends action and optional thinking through a tool call to narration', async (t) => {
  const action = 'Look around.';
  const thinking = 'Maybe I can find a light.';
  const input = `Action: ${action}\nThinking (optional): ${thinking}`;
  const room = { room: 'Cameretta', objects: ['Comodino', 'Letto'] };
  const { client, requests } = fakeClient([
    modelResponse([{ functionCall: { name: 'look', args: {}, id: 'demo-call' } }]),
    modelResponse([{ text: 'A bedroom with toys.' }], 'A bedroom with toys.'),
    modelResponse([{ text: 'The floorboards creak beneath your bed. On the bedside table, a candle stub waits in the moonlight.' }],
      'The floorboards creak beneath your bed. On the bedside table, a candle stub waits in the moonlight.'),
  ]);
  const agent = createAgent({
    client,
    systemInstruction: 'Use a spooky, suspenseful style.',
    registry: registryFor([lookTool], () => room),
  });

  const result = await agent.runTurn({ action, thinking });
  const firstRequest = requests[0] as { contents: { parts: { text?: string }[] }[] };

  assert.equal(firstRequest.contents[0]?.parts[0]?.text, input);
  assert.deepEqual(result.history[2]?.parts, [
    { functionResponse: { name: 'look', id: 'demo-call', response: room } },
  ]);
  assert.equal(result.text, 'The floorboards creak beneath your bed. On the bedside table, a candle stub waits in the moonlight.');

  t.diagnostic('Player: Action="Look around."; Thinking="Maybe I can find a light."');
  t.diagnostic(`Tool: look({}) -> ${JSON.stringify(room)}`);
  t.diagnostic(`Spooky narration: ${result.text}`);
});

test('executes multiple calls from one model response in order', async () => {
  const { client } = fakeClient([
    modelResponse([
      { functionCall: { name: 'look', args: {}, id: '1' } },
      { functionCall: { name: 'look', args: {}, id: '2' } },
    ]),
    modelResponse([{ text: 'Done.' }], 'Done.'),
    modelResponse([{ text: 'Done.' }], 'Done.'),
  ]);
  const ids: string[] = [];
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    registry: registryFor([lookTool], (_name, args) => {
      ids.push(String(args.id ?? ids.length));
      return { ok: true };
    }),
  });

  const result = await agent.runTurn({ action: 'Look twice.' });

  assert.deepEqual(ids, ['0', '1']);
  assert.equal(result.text, 'Done.');
  assert.equal(result.history[2]?.parts?.length, 2);
});

test('rejects unknown tools before execution', async () => {
  const { client } = fakeClient([modelResponse([{ functionCall: { name: 'hack', args: {} } }])]);
  let executed = false;
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    registry: registryFor([lookTool], () => {
      executed = true;
      return {};
    }),
  });

  await assert.rejects(agent.runTurn({ action: 'Run a tool.' }), UnknownToolError);
  assert.equal(executed, false);
});

test('validates arguments against the injected JSON Schema', async () => {
  const { client } = fakeClient([
    modelResponse([{ functionCall: { name: 'examine', args: null as never, id: 'call' } }]),
  ]);
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    registry: registryFor([{ name: 'examine', description: 'Inspect something.', parameters: {
      type: 'object',
      properties: { target: { type: 'string' } },
      required: ['target'],
    } }], () => ({})),
  });

  await assert.rejects(agent.runTurn({ action: 'Examine it.' }), ToolArgumentsError);
});

test('surfaces tool executor failures', async () => {
  const { client } = fakeClient([modelResponse([{ functionCall: { name: 'look', args: {} } }])]);
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    registry: registryFor([lookTool], () => {
      throw new Error('game state unavailable');
    }),
  });

  await assert.rejects(agent.runTurn({ action: 'Look.' }), /game state unavailable/);
});

test('stops after the configured maximum tool rounds', async () => {
  const { client } = fakeClient([
    modelResponse([{ functionCall: { name: 'look', args: {} } }]),
    modelResponse([{ functionCall: { name: 'look', args: {} } }]),
  ]);
  let calls = 0;
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    registry: registryFor([lookTool], () => {
      calls += 1;
      return {};
    }),
    maxToolRounds: 1,
  });

  await assert.rejects(agent.runTurn({ action: 'Look.' }), MaxToolRoundsError);
  assert.equal(calls, 1);
});
