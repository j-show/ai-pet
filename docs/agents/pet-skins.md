# Pet skins (`packages/pet-skins`)

Load when editing skin packages, `deploy.mjs`, or `lib/list-pets.mjs`.

## Layout

```
pet-skins/
├── lib/list-pets.mjs      # discover dirs with pet.json
├── scripts/deploy.mjs     # TTY install/uninstall
├── <petId>/
│   ├── pet.json
│   └── spritesheet.webp   # may be gitignored; bundled copy in ai-pet/public/default/
└── test/
```

## Deploy

```bash
pnpm deploy              # from repo root
# or cd packages/pet-skins && pnpm deploy
```

Copies package → `~/.ai-pet/pets/<petId>/` (must match desktop app loader).

Requires **interactive TTY** (`↑`/`↓`, `Enter`, `Ctrl+C`).

## Tests

```bash
pnpm test                # root: pet-skins only
cd packages/pet-skins && node --test test/**/*.test.mjs
```

## Sync into desktop app

`packages/ai-pet/scripts/sync-pets.mjs` runs before `tauri dev` / `tauri build`:

- Source: `../pet-skins/mochibot`
- Target: `packages/ai-pet/public/default/`
- **Merge copy** (does not delete existing files like committed `spritesheet.webp`)

## pet.json (minimal)

| Field | Notes |
| ----- | ----- |
| `id` | Matches directory name |
| `displayName`, `description` | Metadata |
| `spritesheetPath` | Relative path inside package |

Optional atlas/animations: see root README_CN and `packages/ai-pet/src/constants/pet.ts`.

## SSOT

- [packages/pet-skins/README.md](../../packages/pet-skins/README.md)
- [README_CN.md](../../README_CN.md) — field details
