# AI Pet — Agent Instructions

For humans: see [README.md](README.md) and [README_CN.md](README_CN.md).

## Project

pnpm monorepo: **Tauri 2** desktop pet (`packages/ai-pet`) + **pet-skins** deploy CLI. Frontend is Vite + TypeScript; backend is Rust (`src-tauri`). Custom URL scheme `aipet://` drives animations and stacked text bubbles. User config lives in `~/.ai-pet/.env` (created on first run).

## Environment

- Node.js **≥ 22** (`package.json` `engines`); pnpm **10** (CI)
- Rust toolchain required for `packages/ai-pet` Tauri builds
- User env: `~/.ai-pet/.env` (see `packages/ai-pet/env.example`); pets dir `~/.ai-pet/pets/`
- Dev server: Vite **1420** when `pnpm pet:dev` / `tauri dev`

## Commands

Run from repository root unless noted:

| Command | Effect |
| ------- | ------ |
| `pnpm install` | Install workspace deps (runs `husky` via `prepare`) |
| `pnpm lint` | ESLint check entire repo |
| `pnpm fix:eslint` | ESLint with `--fix` |
| `pnpm fix:prettier` | Prettier write all |
| `pnpm fix:all` | Prettier then ESLint fix |
| `pnpm typecheck` | `tsc --noEmit` in `packages/ai-pet` |
| `pnpm test` | `pet-skins` unit tests (`node --test`) |
| `pnpm pet:dev` | Tauri dev (`packages/ai-pet`) |
| `pnpm pet:build` | MSI + portable exe + export to repo `dist/` (Windows-oriented) |
| `pnpm pet:open <url>` | Open `aipet://…` (dev bridge or OS handler) |
| `pnpm pet:sync` | Sync `package.json` version → Cargo/Tauri configs |
| `pnpm deploy` | Interactive install skins to `~/.ai-pet/pets` (TTY) |

Package-local (`cd packages/ai-pet`): `pnpm dev`, `pnpm build`, `pnpm clean`, `pnpm sync-pets`, `pnpm sync-version`, `pnpm export`, `pnpm open`.

## Structure

| Path | Role |
| ---- | ---- |
| `packages/ai-pet/` | Tauri app: `src/` UI, `src-tauri/` Rust, `scripts/` |
| `packages/pet-skins/` | Skin packages (`<petId>/pet.json` + spritesheet), `lib/`, `deploy` CLI |
| `dist/` | Release artifacts copied by `export-dist.mjs` (gitignored) |
| `.github/workflows/pr-check.yml` | CI: lint, typecheck, test |

## Boundaries

### Always do

- Run `pnpm lint` and `pnpm typecheck` after TS changes; `pnpm test` if touching `pet-skins`.
- Use exact `pnpm -F <package>` or root `pnpm pet:*` scripts—do not invent `npm run` variants.
- Keep pet deploy target `~/.ai-pet/pets` aligned with app loader (not `~/.codex/pets`).
- Match existing patterns in `packages/ai-pet/src/pet/` for protocol and window resize logic.

### Ask first

- Change `aipet://` protocol semantics, `pet.json` schema, or deep-link registration.
- Add/remove Tauri plugins, change `tauri.conf.json` bundle targets, or enable new cargo features.
- Commit lockfile-only churn, delete `public/default/spritesheet.webp`, or force-push.
- Create commits or open PRs unless the user asks.

### Never do

- `git config` changes; `git push --force` to `main`/`master`.
- Commit secrets, `.env` with tokens, or user `~/.ai-pet/` contents.
- Skip pre-commit hooks (`--no-verify`) unless user explicitly requests.
- Run full `pnpm pet:build` on non-Windows expecting all steps to succeed without documenting gaps.

## Verification

After changes:

1. `pnpm lint`
2. `pnpm typecheck` (if `packages/ai-pet` TS touched)
3. `pnpm test` (if `packages/pet-skins` touched)
4. `cargo test` in `packages/ai-pet/src-tauri` (if Rust touched)
5. `pnpm pet:dev` + `pnpm pet:open aipet://base` for manual protocol smoke (desktop)

## Known fixes

| Symptom | Fix |
| ------- | --- |
| Protocol logs only in terminal | Logs are in **WebView DevTools** (`Ctrl+Shift+I`), not shell; enable `AI_PET_DEBUG_PROTOCOL=true` in `~/.ai-pet/.env` and restart app |
| `pnpm pet:build` fails off Windows | `build` includes MSI/portable/export; use `cd packages/ai-pet && pnpm dev` on macOS/Linux |
| `sync-pets` removed spritesheet | Source `pet-skins/sugarwing` may lack `spritesheet.webp`; merge copy preserves `public/default/` assets |
| Drag end animation missing on Windows | Native drag blocks `mouseup`; app polls `is_primary_mouse_button_down` (Rust command) |
| CI vs local lint mismatch | CI runs `pnpm lint` + `pnpm typecheck` from root—mirror before PR |

## Document map

| Doc | Purpose |
| --- | ------- |
| [README.md](README.md) | Human overview (EN) |
| [README_CN.md](README_CN.md) | Human overview (ZH) |
| [packages/ai-pet/README.md](packages/ai-pet/README.md) | Desktop app: protocol, build, env |
| [packages/pet-skins/README.md](packages/pet-skins/README.md) | Skin packages and deploy |
| [docs/agents/tauri-desktop.md](docs/agents/tauri-desktop.md) | Tauri/Rust build, window, drag |
| [docs/agents/protocol.md](docs/agents/protocol.md) | `aipet://` URLs, text `sid`, debug |
| [docs/agents/pet-skins.md](docs/agents/pet-skins.md) | Skin layout, deploy CLI, tests |
| [Tauri v2 docs](https://v2.tauri.app/) | Framework SSOT (do not paste) |

## Done checklist

- [ ] Lint + typecheck pass for touched packages
- [ ] No secrets or home-dir paths committed
- [ ] Protocol/README mentions updated if behavior changed
