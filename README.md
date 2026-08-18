# StudentRacker

A web app for managing student records and generating printable forms.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Database: SQLite via Prisma ORM
- Sandbox: VS Code Dev Container (Docker)

## Getting started

1. Open this folder in VS Code with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed.
2. Command Palette → **Dev Containers: Reopen in Container**. This builds the container, installs dependencies, and generates the Prisma client.
3. In the container terminal, run the first migration:
   ```
   npm run prisma:migrate --workspace backend -- --name init
   ```
4. Start both dev servers:
   ```
   npm run dev
   ```
5. Open the forwarded port `5173` in your browser.

## Persistence

The SQLite database lives at `data/studentracker.db`, inside the workspace bind mount. It survives container rebuilds because it lives on the host filesystem, not inside a container layer.

## Extending

The `Student` model (`backend/prisma/schema.prisma`) currently holds only placeholder fields. Extend it and run `npm run prisma:migrate --workspace backend -- --name <change>` as real requirements (printable form types, additional fields, etc.) are defined.
