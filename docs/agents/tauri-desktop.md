# Tauri desktop (`packages/ai-pet`)

Load when editing `src-tauri/`, Tauri config, or window/drag behavior.

## Stack

- Tauri **2**, `tauri-plugin-deep-link`, `tauri-plugin-single-instance` (with `deep-link` feature)
- Window: transparent, frameless, always-on-top; macOS uses `ActivationPolicy::Accessory`
- Frontend built with Vite → `../dist`; dev URL `http://localhost:1420`

## Commands (`packages/ai-pet`)

```bash
pnpm dev                    # tauri dev (runs sync-pets + vite)
pnpm build                  # build:msi && build:portable:win && export
pnpm build:msi              # tauri build (installers)
pnpm build:portable:win     # tauri build --no-bundle --config src-tauri/tauri.portable.conf.json
pnpm export                 # copy exe + bundle → repo root dist/
pnpm clean                  # remove dist, src-tauri/target, src-tauri/gen
pnpm sync-pets              # merge pet-skins/sugarwing → public/default/
pnpm sync-version           # package.json version → Cargo.toml + tauri conf
cargo test                  # from src-tauri/
```

Root shortcuts: `pnpm pet:dev`, `pnpm pet:build`, `pnpm pet:sync`.

## Key paths

| Path | Role |
| ---- | ---- |
| `src-tauri/src/lib.rs` | Plugins, commands, setup |
| `src-tauri/src/pet_store.rs` | Load `~/.ai-pet/pets/<id>`, path checks |
| `src-tauri/src/user_env.rs` | Parse/merge `~/.ai-pet/.env` |
| `src-tauri/tauri.conf.json` | Main bundle (app/dmg/msi) |
| `src-tauri/tauri.portable.conf.json` | Portable build overlay (`bundle.active: false`) |
| `src/pet/desktop-pet.ts` | Drag, animations, text stack, window resize |
| `src/config/window-position.ts` | Save/restore position (top-right anchor) |

## Window position

Saved to `~/.ai-pet/.env` after drag ends:

- `AI_PET_WINDOW_RIGHT` — screen X of outer frame **top-right**
- `AI_PET_WINDOW_TOP` — screen Y of outer frame top

Restore on startup after `resizeWindow()`. Resize keeps top-right fixed when bubbles change size.

## Windows drag

`startDragging()` blocks normal `mouseup`. Release detected via Rust command `is_primary_mouse_button_down` (poll in `desktop-pet.ts`).

## Single instance

Second `aipet://` launch routes to existing instance (`tauri-plugin-single-instance` before deep-link plugin).

## SSOT

- [packages/ai-pet/README.md](../../packages/ai-pet/README.md) — build and interaction
- [Tauri v2](https://v2.tauri.app/)
