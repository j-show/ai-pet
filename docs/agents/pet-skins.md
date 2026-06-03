# Pet skins (`pet-skins/`)

## Layout

```
pet-skins/
├── mochibot/
│   ├── pet.json
│   └── spritesheet.webp
└── sugarwing/
    ├── pet.json
    └── spritesheet.webp

scripts/
└── deploy_skin.mjs   # interactive deploy CLI (repo root)
```

## Deploy CLI

```bash
pnpm deploy
# or: node scripts/deploy_skin.mjs
```

Interactive TTY: pick a package, toggle install into `~/.ai-pet/pets/<petId>/` (full directory copy).

## Tests

Root `pnpm test` runs Vitest protocol tests in `test/` (not under `pet-skins/`).

## Sync into app bundle

`scripts/sync-pets.mjs` runs before `tauri dev` / `tauri build`:

- Source: `pet-skins/mochibot`
- Target: `public/default/` (merge copy)

## `pet.json` (minimal)

| Field | Role |
| ----- | ---- |
| `id` | Pet id (directory name) |
| `displayName`, `description` | Metadata |
| `spritesheetPath` | Relative path inside package |

Optional atlas/animations: see `src/constants/pet.ts`.

## SSOT

- [README_CN.md](../../README_CN.md)
