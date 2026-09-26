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
- Single test file: `cd server && node --experimental-strip-types --test test/api.test.ts`; single test by name: add `--test-name-pattern "rate limited"`

## Architecture

- `apps/game` — Vite + TypeScript client. Currently a placeholder title screen (`spiral.ts` draws a 1-bit Bayer-dithered spiral; the Three.js dither pass in milestone 1 replaces it). All server calls go through `src/api.ts` and must fail soft (return `null`).
- `server` — Fastify app built in `src/app.ts` (`buildApp` takes a `Store`, so tests use `openStore(':memory:')` + `app.inject`). Persistence is `node:sqlite` (built-in, no native deps) in `src/db.ts`; the DB file is `$DATA_DIR/eferon.sqlite`. The server also serves `apps/game/dist` with an SPA fallback. Server TS is run directly by Node's type stripping in dev/tests (hence `.ts` import specifiers) and compiled with `tsc` for production.
- The global cycle counter starts at `CYCLE_RUN_FIRST = 1472` (the prologue's cycle number in the story).

## Deploy

Pushes to `main` run `.github/workflows/ci.yml` (typecheck, tests, build, Docker build + smoke test). Amvera builds the root `Dockerfile` per `amvera.yml` (docker environment, persistent mount `/data`, port 3000) and is connected to the GitHub repo with the "Workflow runs" trigger, so only green CI deploys. The `amvera.yml` format was written without access to Amvera docs; if a deploy fails on config, check it first.
