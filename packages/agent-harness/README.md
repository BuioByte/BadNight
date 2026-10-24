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

Set `GEMINI_API_KEY` in the backend environment for Gemini AI Studio. NVIDIA NIM and other Chat Completions endpoints use the same registry through the OpenAI-compatible adapter. For NIM, set `AGENT_PROVIDER=openai-compatible` and `NVIDIA_API_KEY`; the default endpoint is `https://integrate.api.nvidia.com/v1` and the default model is `deepseek-ai/deepseek-v4.1-flash`. Set `NVIDIA_BASE_URL` or `NVIDIA_MODEL` to override them. All credentials stay server-side. Callers keep `turn.history` and pass it into the next turn. Tests inject fake clients, so they do not require credentials or tool implementations.

```sh
pnpm install
pnpm test
pnpm test:live
pnpm test:live:nim
pnpm build
```

`pnpm test:live` makes a real Gemma 4 API request and requires `GEMINI_API_KEY` in the environment or the repository-root `.env` file. It uses the registry with a tiny in-test `look` handler; the normal test command stays offline.

`pnpm test:live:nim` makes a real NVIDIA NIM request and requires `NVIDIA_API_KEY` in the environment or the repository-root `.env` file. It uses the registered `look` tool and checks that the model returns narration; the normal test command stays offline.
