# AI Pet

Monorepo for a Tauri desktop pet and a Codex skin deploy CLI.

[中文说明](README_CN.md)

## Requirements

- Node.js **≥ 22** (`package.json` `engines`)
- Interactive terminal for `pnpm deploy` (TTY)

## Install & scripts

```bash
pnpm install
```

| Script | Description |
| --- | --- |
| `pnpm deploy` | Interactive copy from `packages/pet-skins/` to `~/.ai-pet/pets` |
| `pnpm pet:dev` | Run AI Pet (Tauri dev) |
| `pnpm pet:build` | Build AI Pet |
| `pnpm pet:open` | Open `aipet://` URL via dev bridge or OS handler |
| `pnpm lint` / `pnpm fix:eslint` | ESLint (with fix) |
| `pnpm typecheck` | TypeScript check for `packages/ai-pet` |
| `pnpm test` | `pet-skins` unit tests |

## Layout

| Path | Role |
| --- | --- |
| `packages/ai-pet/` | Tauri desktop app |
| `packages/pet-skins/<petId>/` | Deployable Codex pet packages |
| `packages/pet-skins/scripts/deploy.mjs` | Interactive install/uninstall CLI |

See [README_CN.md](README_CN.md) for `pet.json` fields, `runs/` pipeline notes, and adding new pets.

## Packages

- [`packages/ai-pet/README.md`](packages/ai-pet/README.md) — desktop app, protocol, env
- [`packages/pet-skins/README.md`](packages/pet-skins/README.md) — skin packages & deploy
