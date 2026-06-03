# AI Pet — Agent Instructions

For humans: see [README.md](README.md) and [README_CN.md](README_CN.md).

## Project

**Tauri 2** desktop pet with skin deploy CLI at `scripts/deploy_skin.mjs` (`pnpm deploy`). Frontend is Vue 3 + Vite + TypeScript; tests use Vitest; backend is Rust (`src-tauri`). Custom URL scheme `aipet://` drives animations and stacked text bubbles. User config lives in `~/.ai-pet/.env` (created on first run).

## Environment

- Node.js **≥ 22** (`package.json` `engines`)
- Rust toolchain required for Tauri builds
- User env: `~/.ai-pet/.env` (see `env.example`); pets dir `~/.ai-pet/pets/`
- Dev server: Vite **1420** when `pnpm dev` / `tauri dev`

## Commands

Run from repository root:

| Command | Effect |
| ------- | ------ |
| `pnpm install` | Install deps (runs `husky` via `prepare`) |
| `pnpm lint` | ESLint check |
| `pnpm fix:eslint` | ESLint with `--fix` |
| `pnpm fix:prettier` | Prettier write all |
| `pnpm fix:all` | Prettier then ESLint fix |
| `pnpm typecheck` | `vue-tsc --noEmit` |
| `pnpm test` | Vitest protocol tests |
| `pnpm dev` | Tauri dev |
| `pnpm build:app` | Tauri bundle |
| `pnpm build:mac` / `pnpm build:win` | Platform-oriented build scripts |
| `pnpm open <url>` | Open `aipet://…` (dev bridge or OS handler) |
| `pnpm sync-version` | Sync `package.json` version → Cargo/Tauri configs |
| `pnpm deploy` | Interactive install skins to `~/.ai-pet/pets` (TTY) |

Also: `pnpm sync-pets`, `pnpm clean`, `pnpm icon`, `pnpm build` (vite), `pnpm build:portable`.

## Structure

| Path | Role |
| ---- | ---- |
| `src/` | Vue UI, `src/pet/` protocol and desktop pet |
| `src-tauri/` | Rust backend |
| `scripts/` | sync-pets, aipet-open, version sync |
| `pet-skins/<petId>/` | Skin packages (`pet.json` + spritesheet) |
| `dist/` | Release artifacts (gitignored) |
| `.github/workflows/pr-check.yml` | CI: lint, typecheck, test |

## Boundaries

### Always do

- Run `pnpm lint` and `pnpm typecheck` after TS changes; `pnpm test` when touching protocol/parsing.
- Keep pet deploy target `~/.ai-pet/pets` aligned with app loader.
- Match existing patterns in `src/pet/` for protocol and window resize logic.

### Ask first

- Change `aipet://` protocol semantics, `pet.json` schema, or deep-link registration.
- Add/remove Tauri plugins, change `tauri.conf.json` bundle targets, or enable new cargo features.
- Commit lockfile-only churn, delete `public/default/spritesheet.webp`, or force-push.

### Never do

- `git config` changes; `git push --force` to `main`/`master`.
- Commit secrets, `.env` with tokens, or user `~/.ai-pet/` contents.
- Skip pre-commit hooks (`--no-verify`) unless user explicitly requests.
- Run full Windows MSI/portable/export pipeline on macOS/Linux without documenting gaps.

## Verification

After changes:

1. `pnpm lint`
2. `pnpm typecheck` (if TS touched)
3. `pnpm test` (if protocol tests relevant)
4. `cargo test` in `src-tauri` (if Rust touched)
5. `pnpm dev` + `pnpm open aipet://base` for manual protocol smoke (desktop)

## Known fixes

| Symptom | Fix |
| ------- | --- |
| Protocol logs only in terminal | Logs are in **WebView DevTools** (`Ctrl+Shift+I`); enable `AI_PET_DEBUG_PROTOCOL=true` in `~/.ai-pet/.env` |
| Windows build steps fail on macOS/Linux | Use `pnpm dev` locally; full MSI/portable is Windows-oriented |
| `sync-pets` removed spritesheet | Source `pet-skins/mochibot` may lack `spritesheet.webp`; merge copy preserves `public/default/` assets |
| Drag end animation missing on Windows | Native drag blocks `mouseup`; app polls `is_primary_mouse_button_down` (Rust command) |

## Document map

| Doc | Purpose |
| --- | ------- |
| [README.md](README.md) | Human overview (EN) |
| [README_CN.md](README_CN.md) | Human overview (ZH) |
| [docs/agents/tauri-desktop.md](docs/agents/tauri-desktop.md) | Tauri/Rust build, window, drag |
| [docs/agents/protocol.md](docs/agents/protocol.md) | `aipet://` URLs, text `sid`, debug |
| [docs/agents/pet-skins.md](docs/agents/pet-skins.md) | Skin layout, deploy CLI |
| [Tauri v2 docs](https://v2.tauri.app/) | Framework SSOT |

## Done checklist

- [ ] Lint + typecheck pass
- [ ] No secrets or home-dir paths committed
- [ ] Protocol/README mentions updated if behavior changed
