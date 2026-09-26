# EFERON: The Other Hand

A browser game about a Greek polis stuck in a loop, a scribe who learns he is a process, and operators who don't know they are one too. Design: [docs/concept.md](docs/concept.md).

```sh
npm ci
npm run dev          # client, http://localhost:5173
npm run dev:server   # API, http://localhost:3000
npm test
```

Deployed to Amvera from `main` via the `Dockerfile` and `amvera.yml`; SQLite lives on the persistent `/data` mount.
