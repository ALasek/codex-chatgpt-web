# ALasek fork policy

This fork intentionally differs from upstream in three ways:

- ChatGPT Web turns cannot spawn subagents. The bridge prompt forbids delegation, and the MCP boundary hides and rejects `spawn_agent`, including calls attempted through raw `exec`.
- The launcher has no automatic updater. Updates are reviewed and merged from `upstream/main`, then built manually.
- Onboarding ends after language and interaction-mode selection. It never asks users to star a repository or open a social profile.
- The Codex route lives only as long as the launcher's daemon. Native Codex models never depend on the bridge while it is not running: the launcher disconnects the route on quit, on Windows session end, and when daemon recovery gives up, and the daemon disconnects it itself when the launcher process disappears.

## Manual upstream update

```powershell
git fetch upstream
git merge upstream/main
bun install --frozen-lockfile
bun run typecheck
bun test ./tests
bun run --cwd launcher typecheck
node --test launcher/tests/*.test.cjs
bun run --cwd launcher package:win
```

Review conflicts carefully around the bridge prompt, MCP tool filtering, and launcher onboarding before rebuilding.
