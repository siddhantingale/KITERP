# EduTrack (self-hosted)

Attendance, batches, faculty, assignments, timetables and analytics for colleges and training programs —
QR + geofenced attendance with proxy detection, student portal, Excalidraw teaching notes, reports and alerts.

This version runs entirely on your own machine or server. It has **no Base44 dependency**:
the frontend talks to its own Node.js server, and all data lives in a local SQLite database.

## Requirements

- **Node.js 18.18 or newer** (20 or 22 recommended) — https://nodejs.org
- That's it. No database server to install.

## Quick start

```bash
npm install          # installs everything (also copies the whiteboard assets)
npm run dev          # starts the API (port 3001) + the app (port 5173)
```

Open **http://localhost:5173**, click **Log In → Sign up**.
**The first account you create becomes the admin.**

## Production

```bash
npm run build        # builds the frontend into dist/
npm start            # one server on http://localhost:3001 serving the app + API
```

To keep it running on a server, use a process manager, e.g. `npx pm2 start server/index.js --name edutrack`,
and put Nginx/Caddy in front of port 3001 for HTTPS.
QR attendance needs HTTPS on phones (browsers only allow GPS on secure pages, except on `localhost`).

## Configuration

Copy `.env.example` to `.env` and fill in only what you need — everything is optional:

| Setting | What it enables |
|---|---|
| `EMAIL_USER`, `EMAIL_PASS` (Gmail App Password) or `SMTP_*` | Attendance alerts, reports, announcements by email |
| `ADMIN_EMAIL` | Who receives admin reports |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL` | AI features: PDF/photo attendance import (OCR), AI timetable, AI report distribution, AI notifications |
| `VITE_MAPBOX_ACCESS_TOKEN` | 3D live-tracking map (the 2D map works without it) |
| `ALLOW_SIGNUP=false` | Stop public sign-ups |
| `ADMIN_LOGIN_EMAIL`, `ADMIN_LOGIN_PASSWORD` | Create the admin account automatically on first start |
| `JWT_SECRET` | Fixed secret for login sessions (auto-generated if empty) |
| `PUBLIC_URL` | Your public address, when running behind a domain/reverse proxy |

Without email or AI keys the app still works; those features show a clear "not configured" message.

## Accounts and roles

- **Admin** – the first account, or anyone an admin promotes. Sees the admin menu.
- **Faculty** – any other account. New faculty accounts start as *inactive* until an admin activates them
  in **Manage Faculty** (same behaviour as before).
- **Students** – sign up with the **same email** that is on their student record; they are taken to the
  Student Portal automatically. Students marking attendance by QR code do **not** need an account.

Admins manage login accounts on the **User Accounts** page (admin menu): create accounts, make someone
an admin, reset a forgotten password, or delete an account.

## Where things are

```
src/                     React frontend (pages, components)
  api/client.js          API client used by every page (entities, auth, uploads, functions)
  entities/all.js        Shortcuts: import { Student, Batch, User } from "@/entities/all"
  integrations/Core.js   UploadFile, InvokeLLM, ExtractDataFromUploadedFile, SendEmail
  functions/             Frontend wrappers for the backend functions
  pages/Login.jsx        Email + password login / sign-up
server/
  index.js               Express server: REST API, uploads, realtime, functions, serves dist/
  lib/db.js              SQLite storage (one table per entity)
  lib/query.js           Filter/sort engine ($in, $regex, $gt, $or, ...)
  lib/auth.js            Accounts (bcrypt) and sessions (JWT)
  lib/integrations.js    Email (SMTP), AI (Anthropic / OpenAI-compatible), file reading
  lib/sdk.js             Client object the backend functions use
  entities/*.json        Data model: 32 entities and their fields
  functions/*.js         The 14 backend functions (QR attendance, proxy detection, invoices, alerts, reports...)
data/                    Created on first run: edutrack.db + uploads/  ← back this folder up
```

## Backups

Everything (database + uploaded files) is in the `data/` folder. Stop the server and copy that folder.

## API overview

All endpoints except login/sign-up, the QR functions and `/api/config` need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Get a token |
| GET/PUT | `/api/auth/me` | Current user / update profile |
| GET | `/api/entities/:Entity?q={json}&sort=-created_date&limit=50&skip=0` | List / filter |
| GET | `/api/entities/:Entity/:id` | Get one |
| POST | `/api/entities/:Entity` · `/api/entities/:Entity/bulk` | Create one / many |
| PUT, DELETE | `/api/entities/:Entity/:id` | Update / delete |
| GET | `/api/realtime?entities=A,B&token=...` | Live changes (Server-Sent Events) |
| POST | `/api/integrations/UploadFile` (multipart `file`) | Upload → `{ file_url }` |
| POST | `/api/integrations/:name` | InvokeLLM, ExtractDataFromUploadedFile, SendEmail |
| POST | `/api/functions/:name` | Run a backend function |

## Notes

- The Excalidraw whiteboard, QR codes and all app code are served locally. Map tiles (OpenStreetMap / Mapbox)
  need an internet connection.
- Data from the old hosted app is not included; re-import students through the **Upload** page.
