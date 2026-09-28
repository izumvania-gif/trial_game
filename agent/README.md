# EFERON for agents

Play EFERON: The Other Hand as an AI agent (or any program): the game in words, one action at a
time. Everything a human sees is described, and everything a human can do is an action with an id.

## How it works

The game has an **agent mode** (`?agent` in the URL). In it the page runs on a virtual clock
(nothing moves between your calls), sound is off, déjà vu can be finished at any moment, text
appears at once, and `window.eferonAgent` offers:

- `observe()` — the stage and the hour, what is around (people in sight, places, the line being
  spoken, any open card or screen), what happened since the last look (facts written in the
  chronicle, news, sounds), and the list of **actions**.
- `act(id, arg?)` — do one action, let the game run until it settles (a line written, a walk
  walked, a night played out), and look again.

Actions come from three places:

| Where | Examples |
|---|---|
| The dialogue | `continue`, `say:2`, `finish` (déjà vu: say the line before them) |
| The stage | prologue (a new game, after the cold open): `use:tablet`, `use:eion`, `use:door` or `skip` · town: `go:agora`, `meet:kora`, `talk:kora`, `talk:stele`, `wait` (minutes), `wait_until 18:00` · Hall: `carvings`, `turn:1 40`, `study l1`, `registry`, `leave` · board: `place:kora 3,1` · burning Hall: `strike:0` · relief: `approach:0`, `leave` |
| Anything on screen | `ui:<button>` (e.g. `ui:wake`), `choose:<list> <option>`, `type:<field> <text>` |

Always available in the world: `chronicle` (what you know and the open questions), `hint <n>`
(where to look next for question n), `book` (the Book of Strangers), `mask`, `lyre return|storms`,
`save` (a wax tablet: the whole save as a code).

Walking uses the town's streets and costs game time; people keep to their day while you walk.

## Running it

Build the game once (`npm ci && npm run build` in the repo root), then in this folder
`npm install` (Playwright; point `EFERON_CHROMIUM` at a Chromium if Playwright has none).

```sh
node agent/eferon.mjs serve            # headless game + HTTP on 127.0.0.1:7357
node agent/eferon.mjs observe          # look
node agent/eferon.mjs act ui:wake      # act
node agent/eferon.mjs act go:agora
node agent/eferon.mjs act wait_until 12:00
node agent/eferon.mjs act say:1
node agent/eferon.mjs new              # forget everything, back to the title
node agent/eferon.mjs shot view.png    # what a human would see
```

Options: `--url <deployed game>` (instead of the local build), `--profile <dir>` (where the save
lives between runs; default `agent/.profile`), `--port`, `--headed`, `--json`.
The local build is always served on `127.0.0.1:7358`: the save lives in the page's
localStorage, which belongs to that origin, so the next run finds it again.

HTTP: `GET /observe`, `POST /act {"id": "...", "arg": "..."}`, `POST /new`, `POST /load {"tablet"}`,
`GET /shot?path=`; add `?json` (or `Accept: application/json`) for the structured observation.

### MCP

`node agent/eferon.mjs mcp` is a Model Context Protocol server on stdio with the tools `observe`,
`act`, `new_game` and `load_tablet`. For Claude Code:

```sh
claude mcp add eferon -- node /path/to/trial_game/agent/eferon.mjs mcp
```

### Check

`node agent/selftest.mjs` runs through every stage (title, town, midnight and the next dawn, the
Hall, the board, the burning Hall, the Desk) using only observe/act.
