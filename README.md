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

## Getting started

1. Open this folder in VS Code with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed.
2. Command Palette → **Dev Containers: Reopen in Container**. This builds the container, installs dependencies, and generates the Prisma client.
3. In the container terminal, apply the committed migrations to create the local database:
   ```
   npm run prisma:migrate --workspace backend
   ```
4. Start both dev servers:
   ```
   npm run dev
   ```
5. Open the forwarded port `5173` in your browser.

## Persistence

The SQLite database lives at `data/studentracker.db`, inside the workspace bind mount. It survives container rebuilds because it lives on the host filesystem, not inside a container layer. Only the schema/migration history is committed to git — the database file itself is gitignored.

## Data model

- `Student` (förnamn, efternamn, klass), `Assignment` (per course), `CourseSetting` (the nationella prov toggle) — see `backend/prisma/schema.prisma`.
- The 5 courses and the nationella prov delprov per course are hardcoded (not stored in the database) in `backend/src/courses.ts`, duplicated in `frontend/src/courses.ts` for the UI. Changing the course list or delprov means editing both files, then adjusting `backend/src/pdf/StudentPdfDocument.tsx`'s page split (`PAGE_1_COURSES`/`PAGE_2_COURSES`) if needed, and re-verifying the PDF still lands on exactly 2 pages.
