# Elevdokumentation

A Swedish-language web app for a teacher to keep track of students, assignments and grades, and generate a printable, duplex-friendly PDF form per student.

## What it does

- **Elever** — add students one at a time, or paste in a whole list from a spreadsheet with a preview before import. Search, filter by klass, and sort the list; select a subset (e.g. one klass) to print together. Duplicate students (same name + klass) are blocked automatically.
- **Uppgifter** — manage a list of assignments per course; each shows up on the generated PDF with a box for its grade. Svenska 1 and Svenska 3 also have a toggleable **nationella prov** section.
- **PDF export** — every student's PDF is exactly 2 A4 pages, so a duplex print gives one double-sided sheet per student. Export one student, all students, or just the ones you've selected, as a single merged PDF.

## Running it with Docker

```
git clone https://github.com/socawi-ai/elevdokumentation.git
cd elevdokumentation
docker compose pull
docker compose up -d
```

The app is then available at `http://localhost:3000`. The database is stored in `./data` next to the compose file, so it survives image updates and is easy to back up.

`./data` must exist and be owned by the container's non-root user before the first start — cloning this repo already takes care of that, since `data/.gitkeep` is tracked. If you ever delete that folder, recreate it yourself first (`mkdir -p data`) rather than letting Docker Compose auto-create it (it would do so as root, which breaks the container's ability to write its own database).

To update to a newer image later: `docker compose pull && docker compose up -d` — migrations run automatically on every start.

Put this behind whatever reverse proxy + auth (e.g. TinyAuth forward-auth) you already run — the app itself has no authentication built in, so it must never be reachable directly from outside that proxy.
