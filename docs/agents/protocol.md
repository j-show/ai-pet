# `aipet://` protocol

## Flow

1. OS / dev bridge delivers URL
2. `protocol-handler.ts` → `parseAipetTextAction` / `parseAipetCommand`
3. `DesktopPet` show/dismiss text, play animation, or `enterAutoPlay()`
4. `aipet://base` → `enterAutoPlay()`

## Text (`aipet://text`)

| URL | Effect |
| --- | --- |
| `aipet://text` | Dismiss **all** bubbles |
| `aipet://text?sid=X` | Dismiss session `X` only |
| `aipet://text?sid=X&tl=&txt=&icon=` | Show/update; same `sid` replaces, different `sid` stacks downward |

## Animation (`aipet://{key}`)

Query: `loop`, `count`, `default=true` (see [README_CN.md](../../README_CN.md)).

## Debug

`AI_PET_DEBUG_PROTOCOL=true` in `~/.ai-pet/.env` or `?debug=protocol` in dev URL.

**Not** visible in terminal where `pnpm open` runs—use WebView console or overlay.

```bash
pnpm open 'aipet://text?sid=1&txt=hello'
pnpm open aipet://waving
```

### Windows `start` caveat

```bat
start aipet://text?tl=a&txt=b&sid=1
```

`&` splits argv; Rust reconstructs via `collect_deep_link_urls`. Prefer `pnpm open` (single argument).

## SSOT

- [README_CN.md](../../README_CN.md) — full protocol tables
- `src/pet/protocol.ts` — parsers
