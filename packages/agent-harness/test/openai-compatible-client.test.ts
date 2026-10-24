import assert from 'node:assert/strict';
import test from 'node:test';
import type { GenerateContentParameters } from '@google/genai';
import { createAgent, createToolRegistry } from '../src/index.js';
import { createOpenAICompatibleClient, toOpenAIRequest } from '../src/openai-compatible-client.js';

const request = {
  model: 'local-tool-model',
  contents: [
    { role: 'user', parts: [{ text: 'Look around.' }] },
    { role: 'model', parts: [{ functionCall: { id: 'look-1', name: 'look', args: {} } }] },
    { role: 'user', parts: [{ functionResponse: { id: 'look-1', name: 'look', response: { room: 'bedroom' } } }] },
  ],
  config: {
    systemInstruction: 'Use the registered game tools.',
    tools: [{ functionDeclarations: [{
      name: 'look',
      description: 'Describe the current room.',
      parametersJsonSchema: { type: 'object', properties: {} },
    }] }],
  },
} as unknown as GenerateContentParameters;

test('translates agent history and tool declarations to OpenAI Chat Completions format', () => {
  const payload = toOpenAIRequest(request);

  assert.equal(payload.model, 'local-tool-model');
  assert.deepEqual(payload.messages.map(({ role }) => role), ['system', 'user', 'assistant', 'tool']);
  assert.equal(payload.messages[2]?.tool_calls?.[0]?.id, 'look-1');
  assert.deepEqual(JSON.parse(payload.messages[3]?.content ?? '{}'), { room: 'bedroom' });
  assert.equal(payload.tools?.[0]?.function.name, 'look');
});

test('calls a compatible endpoint and normalizes its tool call response for the harness', async () => {
  let url = '';
  let headers: HeadersInit | undefined;
  let body: Record<string, unknown> | undefined;
  const client = createOpenAICompatibleClient({
    baseUrl: 'http://localhost:1234/v1/',
    apiKey: 'test-key',
    fetch: async (input, init) => {
      url = String(input);
      headers = init?.headers;
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: {
        content: null,
        tool_calls: [{ id: 'next-1', type: 'function', function: { name: 'look', arguments: '{}' } }],
      } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const response = await client.models.generateContent(request);

  assert.equal(url, 'http://localhost:1234/v1/chat/completions');
  assert.equal(new Headers(headers).get('authorization'), 'Bearer test-key');
  assert.equal(body?.model, 'local-tool-model');
  assert.equal(response.candidates?.[0]?.content?.parts?.[0]?.functionCall?.name, 'look');
  assert.equal(response.candidates?.[0]?.content?.parts?.[0]?.functionCall?.id, 'next-1');
});

test('does not include API credentials in compatible endpoint errors', async () => {
  const client = createOpenAICompatibleClient({
    apiKey: 'private-key',
    fetch: async () => new Response('provider detail', { status: 503 }),
  });

  await assert.rejects(
    client.models.generateContent(request),
    (error: Error) => error.message.includes('503') && !error.message.includes('private-key'),
  );
});

test('uses NVIDIA NIM environment settings with the OpenAI-compatible provider', async () => {
  const keys = ['NVIDIA_API_KEY', 'NVIDIA_BASE_URL', 'NVIDIA_MODEL', 'AGENT_PROVIDER'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.AGENT_PROVIDER = 'openai-compatible';
  process.env.NVIDIA_API_KEY = 'test-nim-key';
  process.env.NVIDIA_BASE_URL = 'https://nim.example/v1';
  process.env.NVIDIA_MODEL = 'deepseek-ai/deepseek-v4.1-flash';
  const requests: { url: string; authorization: string | null; model: string }[] = [];
  try {
    const agent = createAgent({
      systemInstruction: 'Narrate briefly.',
      registry: createToolRegistry(),
      openAICompatible: {
        fetch: async (input, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          requests.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization'), model: body.model });
          return new Response(JSON.stringify({ choices: [{ message: { content: 'A quiet creak comes from the hall.' } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    });
    await agent.runTurn({ action: 'Listen.' });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }

  assert.equal(requests.length, 1, 'one model for tools and narration: no second narration pass');
  assert.ok(requests.every(({ url }) => url === 'https://nim.example/v1/chat/completions'));
  assert.ok(requests.every(({ authorization }) => authorization === 'Bearer test-nim-key'));
  assert.ok(requests.every(({ model }) => model === 'deepseek-ai/deepseek-v4.1-flash'));
});

test('sends reasoning_effort only when configured, also from NVIDIA_REASONING_EFFORT', async () => {
  const bodies: Record<string, unknown>[] = [];
  const fetch = async (_input: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Ok.' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  await createOpenAICompatibleClient({ fetch }).models.generateContent(request);
  await createOpenAICompatibleClient({ fetch, reasoningEffort: 'none' }).models.generateContent(request);
  assert.equal('reasoning_effort' in (bodies[0] ?? {}), false);
  assert.equal(bodies[1]?.reasoning_effort, 'none');

  const keys = ['AGENT_PROVIDER', 'NVIDIA_MODEL', 'NVIDIA_REASONING_EFFORT'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.AGENT_PROVIDER = 'openai-compatible';
  process.env.NVIDIA_MODEL = 'gpt-6-luna';
  process.env.NVIDIA_REASONING_EFFORT = 'none';
  try {
    const agent = createAgent({ systemInstruction: 'Narrate briefly.', registry: createToolRegistry(), openAICompatible: { fetch } });
    await agent.runTurn({ action: 'Listen.' });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
  assert.ok(bodies.slice(2).length === 1 && bodies.slice(2).every((body) => body.reasoning_effort === 'none'));
});
