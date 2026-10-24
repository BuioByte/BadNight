# BadNight

Una piccola storia horror a bivi, delicata e adatta a un bambino di circa sei anni. Il bambino si è svegliato nella sua cameretta e attraversa una casa infestata di tre stanze per raggiungere il lettone dei genitori. Fantasmi, scricchiolii e ombre fanno un po' paura, senza scene violente.

## Setup and tests

Serve Node.js LTS (`nvm use`) e pnpm tramite Corepack.

```sh
corepack pnpm install
```

For live provider tests, set `GEMINI_API_KEY` or configure NVIDIA NIM in the server-side environment:

```sh
GEMINI_API_KEY=...
```

Per NVIDIA NIM, usa la chiave generata su NVIDIA Build:

```sh
AGENT_PROVIDER=openai-compatible
NVIDIA_API_KEY=...
NVIDIA_MODEL=deepseek-ai/deepseek-v4.1-flash
```

When `AGENT_PROVIDER=openai-compatible`, the harness uses `https://integrate.api.nvidia.com/v1` and `deepseek-ai/deepseek-v4.1-flash` by default. Override them with `NVIDIA_BASE_URL` or `NVIDIA_MODEL`. Keep provider credentials server-side. Run the optional live check with `corepack pnpm test:live:nim`.

## Provider AI

Gemini AI Studio è il provider predefinito. Il modello Gemma 4 31B Dense gestisce ragionamento e tool call; Gemma 4 26B A4B MoE genera la narrazione. I nomi sono quelli supportati dal Gemini Developer API.

Il tool adapter OpenAI-compatible del harness supporta endpoint che implementano Chat Completions. Per selezionarlo, configura `.env` così:

```sh
AGENT_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=http://localhost:1234/v1
OPENAI_COMPATIBLE_API_KEY=
OPENAI_COMPATIBLE_TOOL_MODEL=nome-modello-tools
OPENAI_COMPATIBLE_NARRATION_MODEL=nome-modello-narratore
```

La chiave è facoltativa per server locali che non richiedono autenticazione. `OPENAI_BASE_URL`, `OPENAI_API_KEY` e `OPENAI_MODEL` sono fallback compatibili. Le impostazioni specifiche di ragionamento non sono standardizzate tra endpoint OpenAI-compatible: il loro comportamento dipende dal provider.

## Struttura

- `webui/`: interfaccia React + TypeScript, compilata e minificata da Vite.
- `shared/contracts/`: JSON Schema per i contratti del client; i tipi TypeScript frontend derivano dagli stessi schemi.
- `packages/agent-harness/`: registry dei tool e loop Gemini/OpenAI-compatible.
- `packages/level/`: livello YAML, regole della partita e tool `look`, `examine`, `act`, `move`, `talk`.
- `docs/MVSP.md`: baseline di sicurezza minima del prototipo.

The API server is not included on this branch. The Web UI requires a compatible API service to play.

## Comandi

```sh
corepack pnpm test           # test engine, harness e tipi web
corepack pnpm build          # build TypeScript del harness e bundle web minificato
corepack pnpm test:live      # test live con Gemini AI Studio e GEMINI_API_KEY
corepack pnpm test:live:nim  # test live NVIDIA NIM con NVIDIA_API_KEY
```
