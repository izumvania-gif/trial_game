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
- `game.ts` is the orchestrator: owns the save, `DayClock`, `Knowledge`, `StoryEngine` and the four stages, and runs dawn → day → midnight → reset → dawn. At the end of a cycle all stages are disposed and rebuilt from a fresh `CycleState`; only `LoopMemory` survives.
- `core/save.ts` — two-layer save in localStorage: `LoopMemory` (facts, stele words, endings; survives resets) and `CycleState` (time, stage, position, ink state; wiped each cycle). `contentVersion` is a hash of the compiled story: when the story changes, the cycle state is dropped and memory kept. All storage access fails soft. Bump `SAVE_SCHEMA` and add a migration when `SaveFile` changes shape.
- `core/knowledge.ts` + `content/knowledge.ts` — the knowledge graph (facts, sources that teach them, endings that require them). Progress is knowledge only. `test/knowledge.test.ts` proves every fact and ending is reachable; `test/story.test.ts` checks every `learn("…")`/`knows("…")` in ink references a real fact.
- `story/*.ink` (repo root) is the English script, compiled by the Vite plugin in `apps/game/vite.config.ts` via `tools/ink.ts`. Knots are entered directly from game events (`host.interact('stele')`); every knot ends in `-> DONE`. Line tags: `#speaker:X`, `#hand`, `#log`, `#hint`, `#stage:<id>`, `#spend:<minutes>` — see `engine/story.ts`.
- `stages/*` implement `Stage` (`stages/types.ts`): `town` (third-person ¾, vase palette), `spiral` (first-person, 1-bit), `desk` (DOM only, clock stopped), `sea` (full color). A stage talks to the game only through `StageHost`.
- `render/DitherRenderer.ts` renders at 1/3 resolution and quantizes to the stage palette (`render/palettes.ts`) with Bayer dithering. Anything that writes alpha 0 bypasses the dither — only the sea material (`render/sea.ts`) does, and it is also the only code allowed to use `seaRandom()`; everything else must be deterministic from `seededRng`.
- All server calls go through `src/api.ts` and must fail soft (return `null`).

Server (`server`): Fastify app built in `src/app.ts` (`buildApp` takes a `Store`, so tests use `openStore(':memory:')` + `app.inject`). Persistence is `node:sqlite` (built-in, no native deps) in `src/db.ts`; the DB file is `$DATA_DIR/eferon.sqlite`. The server also serves `apps/game/dist` with an SPA fallback. Server TS runs directly via Node type stripping in dev/tests (hence `.ts` import specifiers and `erasableSyntaxOnly` — no parameter properties or enums) and is compiled with `tsc` for production. The global cycle counter starts at `CYCLE_RUN_FIRST = 1472` (the prologue's cycle number).

## Deploy

Pushes to `main` run `.github/workflows/ci.yml` (typecheck, tests, build, Docker build + smoke test). Amvera builds the root `Dockerfile` per `amvera.yml` (docker environment, persistent mount `/data`, port 3000) and deploys on the GitHub "Workflow runs" trigger, so only green CI deploys. The Dockerfile copies `apps/game`, `server` and `story` explicitly — add new top-level source dirs there.
