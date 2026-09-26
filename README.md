# EFERON: The Other Hand

A browser game about a Greek polis stuck in a loop, a scribe who learns he is a process, and operators who don't know they are one too. Design: [docs/concept.md](docs/concept.md).

```sh
npm ci
npm run dev          # client, http://localhost:5173
npm run dev:server   # API, http://localhost:3000
npm test
```

Deployed to Amvera from `main` via the `Dockerfile` and `amvera.yml`; SQLite lives on the persistent `/data` mount.

## Playing

WASD walk · E talk · F finish someone's sentence (déjà vu) · C chronicle · B Book of Strangers · M mask · R lyre · O settings · Esc step back.

Settings (title screen or O): volume, sound captions, large text, déjà vu without timing, reduced motion, a longer last day (18/24/30 minutes), picture quality and "less meta" (keeps the tab title and favicon ordinary).

The last day runs 06:00–midnight (~18 minutes). What you learn survives the reset; nothing else does. Ten people live the last day on fixed schedules; the Book of Strangers records what you have watched. Twelve past Leonts are carved on the spiral in the Hall of Anamnesis (Tab — registry); identifying them frees masks that change how Eferon treats you. If you are stuck, read the line at the bottom of the chronicle at dawn. Main endings: Exception Handled, Revolution, Sisyphus, The Aoidos, The Centre, Promotion (plus Awaiting Curator after the full Night of Anamnesis). The true ending, Diary Without Dates, needs all thirty-six Leonts, all twelve shards of the spiral, an awake Curator and a perfect night — and then continues in real time, one day at a time.

## Moderating player notes

Set `ADMIN_TOKEN` (in Amvera: project environment variables) and open `/admin`. Notes written in the epilogue are shown to other players only after approval.
