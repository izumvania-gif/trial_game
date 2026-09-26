# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

EFERON: The Other Hand — a desktop browser game (English only) about a time-looping Greek polis whose scribe Leont discovers he is a process in a simulation run by operators who are themselves unaware AI agents. The full design lives in `docs/concept.md` (written in Russian); read it before adding gameplay, story or visuals. Key design rules from it: each stage is a different genre with its own perspective and palette; the sea is the only non-dithered, non-deterministic thing in the game; the online counter/player lines are part of the plot and the game must keep working when the server is unreachable.

## Commands

Run from the repo root (npm workspaces: `apps/game`, `server`; Node >= 22.13).

- `npm ci` — install
- `npm run dev` + `npm run dev:server` — Vite client on :5173 (proxies `/api` to :3000) and Fastify server on :3000
- `npm run typecheck` / `npm test` / `npm run build`
- `npm start` — serve the built client and API from the compiled server (`DATA_DIR`, `PORT`, `STATIC_DIR` env vars)
- Single test file: `cd apps/game && node --experimental-strip-types --test test/save.test.ts` (same pattern in `server/`); single test by name: add `--test-name-pattern "wax tablet"`
- Open the game with `?debug` for the debug panel (time speed, jump to 23:58, stage jumps, export/wipe save); it also exposes the `Game` as `window.eferon`.

## Architecture

Client (`apps/game`, Vite + TypeScript + Three.js + inkjs, no UI framework — DOM via `ui/dom.ts`):
- `game.ts` is the orchestrator: owns the save, `DayClock`, `Knowledge`, `StoryEngine`, the seven stages and the modal UI (dialogue, lyre, carving, stele lines, endings). It runs dawn → day → midnight / Song of Return / ending → reset → dawn. On every reset all stages are disposed and rebuilt from a fresh `CycleState`; only `LoopMemory` survives.
- Stages (`stages/*`, interface in `stages/types.ts`) talk to the game only through `StageHost` (knowledge, memory, cycle, `notice()` for anomalies + wind, `patches()`, `loseMechanic()`, `ending()`…): `town` (third-person, vase palette, residents on schedules), `spiral` (first-person 1-bit, ring alignment + registry of past Leonts), `relief` (walk inside a frozen carving), `desk` (DOM-only operator terminal: tickets → patches), `board` (tactical night plan), `strikes` (five blows that remove mechanics), `sea` (full color).
- Content lives in `content/`: `knowledge.ts` (facts/sources/endings graph), `residents.ts` (schedules; `core/schedule.ts` + `core/streets.ts` resolve positions deterministically), `leonts.ts` (registry answers; `core/registry.ts` confirms three at a time), `tickets.ts` (Desk queue and patch ids), `lexicon.ts` (stele words), `endings.ts`. Patch ids decided on the Desk take effect from the next cycle and are read with `patches()` / ink `patched()`.
- `core/save.ts` — two-layer save in localStorage (`LoopMemory` vs `CycleState`), `contentVersion` = hash of the compiled story (story change → cycle state dropped, memory kept). Bump `SAVE_SCHEMA` and add a migration when `SaveFile` changes shape; new fields with defaults in `freshMemory`/`freshCycle` are filled automatically.
- `story/*.ink` (repo root) is the English script, compiled by the Vite plugin in `apps/game/vite.config.ts` via `tools/ink.ts`. Knots are entered directly (`host.interact('stele')`); every knot ends in `-> DONE`. Tags: `#speaker:X`, `#hand`, `#log`, `#hint`, `#stage:<id>`, `#spend:<min>`, `#dejavu:<id>` (+ `^` before the cue word), `#action:carve|stele_lines|board|ending:<id>`. Game-provided EXTERNALs are declared (with fallbacks) in `story/main.ink` and bound in `Game.inkFunctions()`; they are bound non-lookahead-safe so ink evaluates them only when reached (déjà vu results depend on timing).
- `render/DitherRenderer.ts` renders at 1/3 resolution and quantizes to the stage palette with Bayer dithering. Anything that writes alpha 0 bypasses the dither — only the sea material (`render/sea.ts`) does, and only sea-bound things may use `seaRandom()` (the sea material, Glaucus's spot on the shore); everything else must be deterministic (`seededRng`).
- Tests (`apps/game/test`) cover the knowledge graph reachability, ink compile + fact/action references, saves, schedules, registry confirmation and the board simulation. The `?debug` panel has "prep night" to jump straight to the board.
- All server calls go through `src/api.ts` and must fail soft (return `null`).

Server (`server`): Fastify app built in `src/app.ts` — `/api/counter` (global CYCLE RUN) and `/api/stele` (lines built only from the fixed vocabulary in `src/stele.ts`, rate-limited per IP) (`buildApp` takes a `Store`, so tests use `openStore(':memory:')` + `app.inject`). Persistence is `node:sqlite` (built-in, no native deps) in `src/db.ts`; the DB file is `$DATA_DIR/eferon.sqlite`. The server also serves `apps/game/dist` with an SPA fallback. Server TS runs directly via Node type stripping in dev/tests (hence `.ts` import specifiers and `erasableSyntaxOnly` — no parameter properties or enums) and is compiled with `tsc` for production. The global cycle counter starts at `CYCLE_RUN_FIRST = 1472` (the prologue's cycle number).

## Deploy

Pushes to `main` run `.github/workflows/ci.yml` (typecheck, tests, build, Docker build + smoke test). Amvera builds the root `Dockerfile` per `amvera.yml` (docker environment, persistent mount `/data`, port 3000) and deploys on the GitHub "Workflow runs" trigger, so only green CI deploys. The Dockerfile copies `apps/game`, `server` and `story` explicitly — add new top-level source dirs there.
