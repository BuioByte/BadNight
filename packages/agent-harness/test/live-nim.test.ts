import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgent, createToolRegistry } from '../src/index.js';

test('NVIDIA NIM makes a tool call and returns narration', {
  skip: process.env.NVIDIA_API_KEY ? false : 'Set NVIDIA_API_KEY to run the live NIM test.',
  timeout: 120_000,
}, async (t) => {
  const registry = createToolRegistry();
  let lookCalls = 0;
  registry.register(
    {
      name: 'look',
      description: 'Describe the current room.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    () => {
      lookCalls += 1;
      return { room: 'Cameretta', description: 'A quiet bedroom, with long shadows in the moonlight.' };
    },
  );

  const agent = createAgent({
    provider: 'openai-compatible',
    systemInstruction: 'Call look before narrating. Keep the story short, spooky, and suitable for a young child.',
    registry,
    maxToolRounds: 2,
  });
  const turn = await agent.runTurn({ action: 'Look around the room.' });

  assert.ok(lookCalls > 0, 'NIM should use the registered look tool.');
  assert.ok(turn.text.length > 0, 'NIM should return narration.');
  t.diagnostic(`Tool calls: ${lookCalls}`);
  t.diagnostic(`NIM: ${turn.text}`);
});
