# @badnight/agent-harness

Gemma 4 agent harness for the Node.js game engine. The 31B Dense model handles thinking and registered JSON Schema tool calls; the 26B A4B MoE model turns the resulting game state into player-facing narration. Callers register tool definitions with handlers; game tools remain in `@badnight/level`.

```ts
import { createAgent, createToolRegistry } from '@badnight/agent-harness';
import { toolDefinitions } from '@badnight/level';

const registry = createToolRegistry();
for (const tool of toolDefinitions) {
  registry.register(tool, (args) => game.call(tool.name, args));
}

const agent = createAgent({
  systemInstruction: 'Use a spooky, suspenseful style.',
  registry,
});

const turn = await agent.runTurn({
  action: 'Can I look around?',
  thinking: 'Maybe I can find a light.', // optional
});
```

Set `GEMINI_API_KEY` in the backend environment. Callers keep `turn.history` and pass it into the next turn. Tests inject a fake Gemini client, so they do not require credentials or tool implementations.

```sh
pnpm install
pnpm test
pnpm test:live
pnpm build
```

`pnpm test:live` makes a real Gemma 4 API request and requires `GEMINI_API_KEY` in the environment or the repository-root `.env` file. It uses the registry with a tiny in-test `look` handler; the normal test command stays offline.
