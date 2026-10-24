# @badnight/agent-harness

Gemma 4 function-calling loop for the Node.js game engine. Callers register each JSON Schema tool definition with its handler; game tools remain in `@badnight/level`.

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
pnpm build
```
