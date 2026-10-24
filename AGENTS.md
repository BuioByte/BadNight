# Project guidance

## Scope

- Keep the hackfest prototype small and focused on the one-level BadNight game.
- Keep the agent harness independent of game rules and tool implementations; consumers register tools and own their application state and conversation history.
- Keep provider credentials in the server-side process that uses the harness. Never expose them to browser clients.
- Keep API request and response contracts in `shared/contracts/*.json`; derive frontend TypeScript types from those schemas.
- Use pnpm and TypeScript for the web UI. Keep the harness on the Node.js LTS version in `.nvmrc`.

## Security baseline

Before adding a user-facing feature or changing an API boundary, create or update `docs/MVSP.md` with the Minimum Viable Secure Product controls that apply to the change. Check the MVSP baseline at <https://mvsp.dev/>: protect secrets, validate untrusted input, use least privilege, and document security-relevant behavior. Record controls that do not apply with a brief reason.

## Changes and commits

- Make each incremental change a git commit.
- Use commit subjects in the form `type(component): Desc` and include a body describing the change.
- Keep code comments in the form `type(component): Desc`, followed by a larger description in the body when needed. Prefer clear code over comments.
