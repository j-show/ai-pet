# `aipet://` protocol

Load when editing `src/pet/protocol.ts`, `protocol-handler.ts`, text bubbles, or `scripts/aipet-open.mjs`.

## Dispatch flow

1. Deep link / dev bridge → `handleAipetUrls` in `protocol-handler.ts`
2. Text → `parseAipetTextAction` → `TextBubbleStack` (multi-`sid`)
3. Animations → `parseAipetCommand` → `DesktopPet.playProtocolAnimation`
4. `aipet://base` → `enterAutoPlay()`

## Text (`aipet://text`)

| URL | Behavior |
| --- | -------- |
| `aipet://text` | Dismiss **all** bubbles |
| `aipet://text?sid=X` | Dismiss session `X` only |
| `aipet://text?sid=X&tl=&txt=&icon=` | Show/update; same `sid` replaces, different `sid` stacks downward |

Params: `tl` (title), `txt` (body, `%0A` newlines), `icon` = `warn` \| `error` \| `info`. Default `sid` = `default` if omitted.

## Animation (`aipet://{key}`)

Keys: `waving`, `jumping`, `failed`, `waiting`, `running` (`runing` alias), `review`, `base`.

Query: `loop`, `count`, `default=true` (see `packages/ai-pet/README.md`).

## Debug

Enable logging of raw URL + parsed payload:

- `~/.ai-pet/.env`: `AI_PET_DEBUG_PROTOCOL=true` (restart app)
- Dev URL: `?debug=protocol`
- Opens DevTools when enabled (Rust `open_devtools`); also shows on-screen log panel (`#protocol-debug-log`)

**Not** visible in terminal where `pnpm pet:open` runs—use WebView console or overlay.

## Open from CLI

```bash
pnpm pet:open 'aipet://text?sid=1&txt=hello'
pnpm pet:open aipet://waving
```

### Windows `cmd` / `start`

`&` separates commands unless the URL is quoted. Wrong:

```bat
start aipet://text?tl=a&txt=b&sid=1
```

Right:

```bat
start "" "aipet://text?tl=a&txt=b&sid=1"
```

Prefer `pnpm pet:open` (passes the URL as one argument). For long bodies, write `~/.ai-pet/messages/<sid>.json` and open `aipet://text?sid=<sid>` only.

Dev: hits Vite `POST /__aipet/protocol?url=…` then HMR event `aipet-protocol`. Production: OS handler + single-instance forward.

## SSOT

- [packages/ai-pet/README.md](../../packages/ai-pet/README.md) — full protocol tables
