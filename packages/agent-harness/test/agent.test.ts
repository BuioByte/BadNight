import assert from 'node:assert/strict';
import test from 'node:test';
import type { Content, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import {
  MaxToolRoundsError,
  ToolArgumentsError,
  UnknownToolError,
  createAgent,
  type AgentTool,
} from '../src/agent.js';

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
  const { client } = fakeClient([modelResponse([{ text: 'A cozy room.' }], 'A cozy room.')]);
  const agent = createAgent({ client, systemInstruction: 'Be gentle.', tools: [], executeTool: () => ({}) });

  const result = await agent.runTurn({ input: 'What do I see?' });

  assert.equal(result.text, 'A cozy room.');
  assert.deepEqual(result.history.map((item) => item.role), ['user', 'model']);
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

  const result = await agent.runTurn({ input: 'Look around.' });

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
  assert.equal(firstRequest.config.systemInstruction, 'Be gentle.');
  assert.equal(firstRequest.config.tools[0]?.functionDeclarations[0]?.name, 'look');
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

  const result = await agent.runTurn({ input: 'Look twice.' });

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

  await assert.rejects(agent.runTurn({ input: 'Run a tool.' }), UnknownToolError);
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

  await assert.rejects(agent.runTurn({ input: 'Examine it.' }), ToolArgumentsError);
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

  await assert.rejects(agent.runTurn({ input: 'Look.' }), /game state unavailable/);
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

  await assert.rejects(agent.runTurn({ input: 'Look.' }), MaxToolRoundsError);
  assert.equal(calls, 1);
});
