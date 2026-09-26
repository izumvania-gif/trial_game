# EFERON: The Other Hand

A browser game about a Greek polis stuck in a loop, a scribe who learns he is a process, and operators who don't know they are one too. Design: [docs/concept.md](docs/concept.md).

```sh
npm ci
npm run dev          # client, http://localhost:5173
npm run dev:server   # API, http://localhost:3000
npm test
```

Deployed to Amvera from `main` via the `Dockerfile` and `amvera.yml`; SQLite lives on the persistent `/data` mount.

## Playing the Cycle Zero demo

WASD walk · E talk · F finish someone's sentence (déjà vu) · C chronicle · B Book of Strangers · M mask · R lyre · Esc step back.

The last day runs 06:00–midnight (~18 minutes). What you learn survives the reset; nothing else does. Talk to Aristion before the fourth hour, watch Cleon's speech twice, read the stele under the moss, study the carved scribes in the Hall of Anamnesis (Tab — registry), and find the mark. Endings in the demo: Exception Handled, The Aoidos, Awaiting Curator.
