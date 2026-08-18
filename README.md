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

The root `Dockerfile` (not `.devcontainer/Dockerfile`, which is dev-only) builds a single production image: compiled backend + built static frontend, served together by one Express process on port 3000. On every push to `main`/`master`, `.github/workflows/docker-publish.yml` builds and publishes it to `ghcr.io/socawi-ai/elevdokumentation:latest` (also tagged with the commit SHA).

**First time only**: after the first successful workflow run, the GitHub package defaults to private — go to the package's settings on GitHub and set visibility to however you want to pull it (public, or keep private and `docker login ghcr.io` with a PAT that has `read:packages` on your server).

**Running it** — the database lives in `/app/data` inside the container; mount that as a volume so it survives image updates. Migrations run automatically on container start.

```
docker run -d \
  --name elevdokumentation \
  -p 3000:3000 \
  -v elevdokumentation-data:/app/data \
  ghcr.io/socawi-ai/elevdokumentation:latest
```

Put this behind whatever reverse proxy + auth (e.g. TinyAuth forward-auth) you're already running on the server — the app itself has no authentication, by design, so it must never be reachable directly from outside that proxy.
