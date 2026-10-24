import assert from 'node:assert/strict';
import test from 'node:test';
import type { Content, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import {
  MaxToolRoundsError,
  ToolArgumentsError,
  UnknownToolError,
  createAgent,
} from '../src/agent.js';
import type { AgentTool } from '../src/agent.types.js';

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

test('returns a direct model response and appends the turn to history', async () => {
  const { client, requests } = fakeClient([modelResponse([{ text: 'A cozy room.' }], 'A cozy room.')]);
  const agent = createAgent({ client, systemInstruction: 'Be gentle.', tools: [], executeTool: () => ({}) });

  const result = await agent.runTurn({ action: 'What do I see?' });

  assert.equal(result.text, 'A cozy room.');
  assert.deepEqual(result.history.map((item) => item.role), ['user', 'model']);
  const firstRequest = requests[0] as { contents: { parts: { text?: string }[] }[] };
  assert.equal(firstRequest.contents[0]?.parts[0]?.text, 'Action: What do I see?');
});

test('rejects a blank action before contacting the model', async () => {
  const { client, requests } = fakeClient([]);
  const agent = createAgent({ client, systemInstruction: 'Be gentle.', tools: [], executeTool: () => ({}) });

  await assert.rejects(agent.runTurn({ action: '  ' }), /action must not be empty/);
  assert.equal(requests.length, 0);
});

test('carries the earlier story into the next player turn', async () => {
  const { client, requests } = fakeClient([
    modelResponse([{ text: 'A shadow slips beneath the bedroom door.' }], 'A shadow slips beneath the bedroom door.'),
    modelResponse([{ text: 'The old drawer gives a soft creak.' }], 'The old drawer gives a soft creak.'),
  ]);
  const agent = createAgent({ client, systemInstruction: 'Keep the story spooky.', tools: [], executeTool: () => ({}) });

  const firstTurn = await agent.runTurn({ action: 'Listen at the door.' });
  const secondTurn = await agent.runTurn({
    action: 'Open the drawer.',
    thinking: 'Maybe the sound came from there.',
    history: firstTurn.history,
  });

  const secondRequest = requests[1] as { contents: { parts: { text?: string }[] }[] };
  assert.equal(firstTurn.history.length, 2);
  assert.equal(secondRequest.contents[0]?.parts[0]?.text, 'Action: Listen at the door.');
  assert.equal(secondRequest.contents[1]?.parts[0]?.text, 'A shadow slips beneath the bedroom door.');
  assert.equal(secondRequest.contents[2]?.parts[0]?.text,
    'Action: Open the drawer.\nThinking (optional): Maybe the sound came from there.');
  assert.equal(secondTurn.text, 'The old drawer gives a soft creak.');
});

test('runs a tool and returns the model response after its result', async () => {
  const { client, requests } = fakeClient([
    modelResponse([{ functionCall: { name: 'look', args: {}, id: 'call-1' } }]),
    modelResponse([{ text: 'You see a candle.' }], 'You see a candle.'),
  ]);
  const calls: string[] = [];
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    tools: [lookTool],
    executeTool: (name) => {
      calls.push(name);
      return { room: 'bedroom' };
    },
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
    config: { systemInstruction: string; tools: { functionDeclarations: { name?: string }[] }[] };
  };
  assert.equal(firstRequest.model, 'gemma-4-26b-a4b-it');
  assert.match(firstRequest.config.systemInstruction, /Be gentle\./);
  assert.match(firstRequest.config.systemInstruction, /child around six years old/);
  assert.match(firstRequest.config.systemInstruction, /atmospheric horror story/);
  assert.match(firstRequest.config.systemInstruction, /spooky and suspenseful/);
  assert.match(firstRequest.config.systemInstruction, /non-graphic/);
  assert.match(firstRequest.config.systemInstruction, /Never suggest going outside/);
  assert.match(firstRequest.config.systemInstruction, /tool results as the only source of truth/);
  assert.equal(firstRequest.config.tools[0]?.functionDeclarations[0]?.name, 'look');
});

test('demo: sends action and optional thinking through a tool call to narration', async (t) => {
  const action = 'Look around.';
  const thinking = 'Maybe I can find a light.';
  const input = `Action: ${action}\nThinking (optional): ${thinking}`;
  const room = { room: 'Cameretta', objects: ['Comodino', 'Letto'] };
  const { client, requests } = fakeClient([
    modelResponse([{ functionCall: { name: 'look', args: {}, id: 'demo-call' } }]),
    modelResponse([{ text: 'The floorboards creak beneath your bed. On the bedside table, a candle stub waits in the moonlight.' }],
      'The floorboards creak beneath your bed. On the bedside table, a candle stub waits in the moonlight.'),
  ]);
  const agent = createAgent({
    client,
    systemInstruction: 'Use a spooky, suspenseful style.',
    tools: [lookTool],
    executeTool: () => room,
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
  ]);
  const ids: string[] = [];
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    tools: [lookTool],
    executeTool: (_name, args) => {
      ids.push(String(args.id ?? ids.length));
      return { ok: true };
    },
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
    tools: [lookTool],
    executeTool: () => {
      executed = true;
      return {};
    },
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
    tools: [{ name: 'examine', description: 'Inspect something.', parameters: {
      type: 'object',
      properties: { target: { type: 'string' } },
      required: ['target'],
    } }],
    executeTool: () => ({}),
  });

  await assert.rejects(agent.runTurn({ action: 'Examine it.' }), ToolArgumentsError);
});

test('surfaces tool executor failures', async () => {
  const { client } = fakeClient([modelResponse([{ functionCall: { name: 'look', args: {} } }])]);
  const agent = createAgent({
    client,
    systemInstruction: 'Be gentle.',
    tools: [lookTool],
    executeTool: () => {
      throw new Error('game state unavailable');
    },
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
    tools: [lookTool],
    executeTool: () => {
      calls += 1;
      return {};
    },
    maxToolRounds: 1,
  });

  await assert.rejects(agent.runTurn({ action: 'Look.' }), MaxToolRoundsError);
  assert.equal(calls, 1);
});
