import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgent, createToolRegistry } from '../src/index.js';

test('Gemma 4 calls the registered tool and returns narration', {
  skip: process.env.GEMINI_API_KEY ? false : 'Set GEMINI_API_KEY to run the live test.',
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
      return {
        room: 'Cameretta',
        description: 'A quiet bedroom. The toys make long shadows in the moonlight.',
      };
    },
  );

  const agent = createAgent({
    toolModel: 'gemma-4-31b-it',
    narrationModel: 'gemma-4-26b-a4b-it',
    systemInstruction: 'For this prototype, call look before narrating. Keep the narration short and spooky.',
    registry,
    maxToolRounds: 2,
  });
  const turn = await agent.runTurn({
    action: 'Look around the room.',
    thinking: 'I wonder why the toys have such long shadows.',
  });

  assert.ok(lookCalls > 0, 'Gemma 4 should use the registered look tool.');
  assert.ok(turn.text.length > 0, 'Gemma 4 should return narration.');
  t.diagnostic(`Tool calls: ${lookCalls}`);
  t.diagnostic(`Gemma 4: ${turn.text}`);
});
