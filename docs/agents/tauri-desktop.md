# Tauri desktop (repo root)

## Stack

- **Frontend**: Vue 3 + Vite (`src/`), dev port **1420**
- **Backend**: Rust in `src-tauri/`
- **Config**: `src-tauri/tauri.conf.json` — `beforeDevCommand` / `beforeBuildCommand` run from repo root (paths like `scripts/sync-pets.mjs`, `vite`)

## Commands (repo root)

```bash
pnpm dev
pnpm build:app
pnpm sync-pets
pnpm sync-version
```

## Window

- Transparent, undecorated, always on top
- Resizes with pet + text bubbles; anchor top-right when growing
- Position persisted: `AI_PET_WINDOW_RIGHT`, `AI_PET_WINDOW_TOP` in `~/.ai-pet/.env`

## Drag (Windows)

Native drag may not deliver `mouseup` to WebView; release polling via Rust `is_primary_mouse_button_down`.

## Single instance

Second `aipet://` launch routes to existing instance (`tauri-plugin-single-instance` before deep-link plugin).

## SSOT

- [README_CN.md](../../README_CN.md) — build and interaction
- [Tauri v2](https://v2.tauri.app/)
