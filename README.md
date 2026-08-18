# Elevdokumentation

A Swedish-language web app for tracking students and generating a printable, duplex-friendly PDF form per student.

## Features

- **Elever** — add students one at a time, paste in a whole list from a spreadsheet (tab/comma/space-separated, with a preview before import), edit, delete, sort by förnamn/efternamn/klass, and select a subset (e.g. one klass) to print together.
- **Uppgifter** — manage a list of assignments per course; each shows up on the generated PDF with a box to hand-write its grade. Svenska 1 and Svenska 3 also have a toggleable **nationella prov** section (delprov + a summarized grade), on by default only when you switch it on for that course.
- **PDF export** — every student's PDF is exactly 2 A4 pages (so a duplex print gives one double-sided sheet per student): a title, the student's name/klass, each course's assignments with grade boxes, and ruled space for handwritten notes. Export one student, all students, or just the ones you've selected — all as a single merged, correctly paginated PDF.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript, PDF generation via `@react-pdf/renderer`
- Database: SQLite via Prisma ORM
- Sandbox: VS Code Dev Container (Docker)


## Persistence

The SQLite database lives at `data/studentracker.db`, inside the workspace bind mount. It survives container rebuilds because it lives on the host filesystem, not inside a container layer. Only the schema/migration history is committed to git — the database file itself is gitignored.

## Data model

- `Student` (förnamn, efternamn, klass), `Assignment` (per course), `CourseSetting` (the nationella prov toggle) — see `backend/prisma/schema.prisma`.
- The 5 courses and the nationella prov delprov per course are hardcoded (not stored in the database) in `backend/src/courses.ts`, duplicated in `frontend/src/courses.ts` for the UI. Changing the course list or delprov means editing both files, then adjusting `backend/src/pdf/StudentPdfDocument.tsx`'s page split (`PAGE_1_COURSES`/`PAGE_2_COURSES`) if needed, and re-verifying the PDF still lands on exactly 2 pages.

## Deployment

**Running it** — the root `docker-compose.yml` runs the published image (not a local build — that's what `.devcontainer/docker-compose.yml` is for). The database is bind-mounted at `./data` next to the compose file (same pattern as local dev) — easy to find and back up, and survives image updates; migrations run automatically on container start.

```
git clone https://github.com/socawi-ai/elevdokumentation.git
cd elevdokumentation
docker compose pull
docker compose up -d
```

`./data` must exist and be owned by the container's non-root user (uid 1000) before the first start — Docker Compose auto-creates a bind-mount source that doesn't exist yet, but as **root**, which then breaks the container's ability to write its own database (confirmed: it crash-loops with "unable to open database file"). Cloning this repo already avoids that, since `data/.gitkeep` is tracked and the directory exists (owned by whatever user ran `git clone`) before Compose ever runs. If you ever delete that folder, recreate it yourself first (`mkdir -p data`) rather than letting Compose create it.

To update to a newer image later, `docker compose pull && docker compose up -d` again — `prisma migrate deploy` runs on every start and only applies whatever's new.

Put this behind whatever reverse proxy + auth (e.g. TinyAuth forward-auth) you're already running on the server — the app itself has no authentication, by design, so it must never be reachable directly from outside that proxy. If the proxy reaches services over a shared Docker network rather than published host ports, drop the `ports:` block in `docker-compose.yml` and attach the service to that network instead.
