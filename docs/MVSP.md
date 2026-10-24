# BadNight Minimum Viable Secure Product

This is the security baseline for the local hackfest prototype, informed by the [Minimum Viable Secure Product](https://mvsp.dev/) controls. It is a practical checklist, not a claim of formal certification.

## Controls

- **Secrets:** Keep `GEMINI_API_KEY`, `NVIDIA_API_KEY`, and compatible-provider keys passed through server-side agent options in the backend process or ignored root `.env`; never place them in Vite variables, browser code, logs, or commits. Revoke any key disclosed in chat or source control.
- **Provider configuration:** The harness reads `AGENT_PROVIDER`, `NVIDIA_BASE_URL`, and `NVIDIA_MODEL` for environment-based NVIDIA setup. Configure other compatible providers through server-side `openAICompatible` options so endpoint and credential selection stays explicit.
- **Input validation:** Validate WebSocket messages from the browser before using player input: JSON only, known `type`, non-empty `text`, at most 64 KiB per message, one turn at a time.
- **Least privilege:** Expose only the registered game tools to the agent. Validate tool names and arguments in the harness and keep game rules authoritative in the level engine.
- **Transport and exposure:** Bind the development API to loopback by default. Do not expose the API or API key to an untrusted network.
- **Data minimization:** Keep session state in memory for the local prototype. Do not persist player input or model conversations to disk.
- **Dependencies:** Pin dependency ranges in manifests and use the committed pnpm lockfile for reproducible installs.
- **Errors:** Return a generic API error to the browser; keep credentials and provider request headers out of responses.
- **Availability:** Bound request body size and agent tool rounds. Sessions are local and disposable; restart clears them.

## Not applicable yet

- **Accounts, authorization, and multi-tenant isolation:** The prototype has no user accounts and binds to loopback. Add these controls before exposing a shared or public server.
- **TLS and production deployment controls:** The app is intended for local hackfest use and has no production hosting configuration.
- **Persistent data backup and deletion workflows:** Game state exists only in process memory and is discarded on restart.
- **Automated vulnerability scanning and incident response:** This prototype has no production release pipeline or operator rotation. Add both before production use.

## Harness response retry

The harness treats provider output as untrusted, validates tool names and arguments, and retries empty model responses once with a corrective prompt. It fails with a typed error if the retry is also empty. This change adds no data storage, credentials, or network endpoint.

## Browser audio

- **User control:** The welcome screen lets the player enable or disable audio before starting. The browser mixer has separate master, music, player-key, and narration-key levels; browsers that block autoplay start playback after the first user interaction.
- **Data and permissions:** Audio uses local static assets. No audio is recorded, uploaded, or fetched from an external service; no new permission or API boundary is introduced.
- **Input validation:** Player typing sounds respond to ordinary character key events; narration typing sounds use a sparse cadence over displayed characters. Both use fixed local assets, and player text is not read or transmitted by the sound system.
- **Secrets and least privilege:** Not applicable; the feature uses no credentials, network access, or external service.
