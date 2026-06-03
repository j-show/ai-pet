# AI Pet

Tauri 2 desktop pet with Vue 3 frontend and optional Codex-style skin packages.

[中文说明](README_CN.md)

## Requirements

- Node.js **≥ 22**
- Rust toolchain (Tauri)
- Interactive terminal for `pnpm deploy` (TTY)

## Install & scripts

```bash
pnpm install
```

| Script | Description |
| --- | --- |
| `pnpm dev` | Tauri dev (Vite on port 1420) |
| `pnpm open aipet://…` | Open protocol URL (dev bridge or OS handler) |
| `pnpm build:app` / `pnpm build:mac` / `pnpm build:win` | Tauri bundles |
| `pnpm deploy` | Interactive install from `pet-skins/` to `~/.ai-pet/pets` |
| `pnpm lint` / `pnpm fix:eslint` | ESLint |
| `pnpm typecheck` | `vue-tsc --noEmit` |
| `pnpm test` | Vitest (protocol parsing) |

## Layout

| Path | Role |
| --- | --- |
| `src/` | Vue UI + pet runtime (TypeScript) |
| `src-tauri/` | Rust backend and Tauri config |
| `scripts/` | sync-pets, open URL, version sync |
| `pet-skins/<petId>/` | Deployable pet packages (`pet.json` + spritesheet) |
| `public/default/` | Bundled default pet (mochibot) |

Full protocol, env vars, and interaction details: [README_CN.md](README_CN.md).

Agent docs: [AGENTS.md](AGENTS.md), [docs/agents/](docs/agents/).
