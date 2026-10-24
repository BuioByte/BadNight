# @badnight/agent-harness

Gemma 4 function-calling loop for the Node.js game engine. The harness takes tool declarations and an executor from its caller; game tools remain in `@badnight/level`.

```ts
const agent = createAgent({
  systemInstruction: 'Guide the player gently through the game.',
  tools: toolDefinitions,
  executeTool: (name, args) => game.call(name, args),
});

const turn = await agent.runTurn({ input: 'Can I look around?' });
```

Set `GEMINI_API_KEY` in the backend environment. Callers keep `turn.history` and pass it into the next turn. Tests inject a fake Gemini client, so they do not require credentials or tool implementations.

```sh
pnpm install
pnpm test
pnpm build
```
