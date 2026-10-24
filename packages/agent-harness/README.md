# @badnight/agent-harness

Gemma 4 agent harness for Node.js applications. The 31B Dense model handles thinking and registered JSON Schema tool calls; the 26B A4B MoE model turns the resulting state into player-facing narration. The harness owns model requests, tool-call orchestration, and tool argument validation. The consuming application owns tool implementations, application state, and conversation history.

## Caller contract

The application using the harness is responsible for:

- Registering each available tool with its name, description, JSON Schema parameters, and an async or sync handler.
- Providing a `systemInstruction` and a registry when creating an agent.
- Passing the player's `action`, optional `thinking`, and that conversation's prior `history` to `runTurn`.
- Keeping the returned `history` with the conversation and passing it to the next turn.
- Binding handlers to the correct application state or session. A handler returns a JSON-serializable object; the harness validates its arguments and passes its result back to the model.

`runTurn` returns `{ text, history }`. `text` is the player-facing narration. `history` includes the new input, model replies, and tool results and should be treated as opaque conversation state. Create or configure registries so handlers can only access the state intended for that conversation.

```ts
import { createAgent, createToolRegistry } from '@badnight/agent-harness';

const registry = createToolRegistry();
registry.register({
  name: 'look',
  description: 'Describe the current room.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
}, () => ({ room: 'Foyer', exits: ['hallway'] }));

const agent = createAgent({
  systemInstruction: 'Describe the room using the registered tools.',
  registry,
});

const firstTurn = await agent.runTurn({ action: 'What can I see?' });
const history = firstTurn.history;
const nextTurn = await agent.runTurn({ action: 'Go to the hallway.', history });
```

Set `GEMINI_API_KEY` in the server-side process environment for Gemini AI Studio. NVIDIA NIM and other Chat Completions endpoints use the same registry through the OpenAI-compatible adapter. For NIM, set `AGENT_PROVIDER=openai-compatible` and `NVIDIA_API_KEY`; the default endpoint is `https://integrate.api.nvidia.com/v1` and the default model is `deepseek-ai/deepseek-v4.1-flash`. Set `NVIDIA_BASE_URL` or `NVIDIA_MODEL` to override them. Keep provider credentials in the server-side environment; do not expose them to browser clients. Tests inject fake clients, so they do not require credentials or tool implementations.

```sh
pnpm install
pnpm test
pnpm test:live
pnpm test:live:nim
pnpm build
```

`pnpm test:live` makes a real Gemma 4 API request and requires `GEMINI_API_KEY` in the environment or the repository-root `.env` file. It uses the registry with a tiny in-test `look` handler; the normal test command stays offline.

`pnpm test:live:nim` makes a real NVIDIA NIM request and requires `NVIDIA_API_KEY` in the environment or the repository-root `.env` file. It uses the registered `look` tool and checks that the model returns narration; the normal test command stays offline.
