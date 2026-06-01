# pet-skins

Deployable Codex pet packages (`pet.json` + spritesheet). Each pet is a **direct subdirectory** of this package (for example `sugarwing/`).

## Commands

```bash
# From repo root
pnpm deploy

# Or in this package
pnpm deploy
pnpm test
```

`deploy` copies selected packages into `~/.ai-pet/pets/<petId>/` (interactive TTY required).

## Layout

```
pet-skins/
├── lib/list-pets.mjs    # discover directories with pet.json
├── scripts/deploy.mjs   # interactive install/uninstall
├── sugarwing/
│   ├── pet.json
│   └── spritesheet.webp
└── test/
```

## Add a pet

1. Create `packages/pet-skins/<petId>/` with `pet.json` and the spritesheet file referenced in the manifest.
2. Run `pnpm deploy` from the repo root and install the new entry.

[中文说明](../../README_CN.md)
