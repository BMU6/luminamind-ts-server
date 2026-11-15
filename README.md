# LuminaMind – Server

REST API and chat backend for **LuminaMind**, a self-tracking app for psychiatric inpatients. It stores check-ins (five ratings, a note, active medication), medication lists and doctor ↔ patient links, and produces a weekly AI summary. The React client lives in [luminamind-web-client](https://github.com/BMU6/luminamind-web-client).

**Live demo (client):** https://luminamind-web-client.onrender.com  
The API runs on a free hosting plan, so the first request after a pause can take about 30 seconds. The demo data is fake.  
Demo accounts: `patient@test.com` and `doctor@test.com`, both with the password `Password@12345`. To try both roles at once, use two browsers or a private window.

## Tech stack

Node.js 24 (runs TypeScript directly) · Express 5 · MongoDB with Mongoose 9 · Zod 4 for validation · JWT · bcryptjs · Vercel AI SDK with Ollama (local model) · Postman/Newman tests

## What it does

- **Auth**: register, login, refresh and logout. Short-lived access token (JWT) in the `Authorization` header plus a rotating refresh token in an httpOnly cookie. Roles: `patient` and `doctor`.
- **Reports**: create, read, update (partial) and delete daily check-ins. A patient only sees their own.
- **Medication list**: per patient. A doctor can read and change the list of a **linked** patient only.
- **Doctor link**: the doctor generates a one-time code, the patient redeems it.
- **Chat**: messages between linked users.
- **Weekly summary**: the server computes the facts (averages, best and worst check-in, medication changes) and a local language model (Ollama, `llama3.1:8b`) turns them into text. Rate limited.
- **Optional field encryption** (AES-256-GCM) for notes, medication data and chat messages, switched on with an environment variable. It is off in the demo.

### Routes (overview)

| Area | Path |
|---|---|
| Auth | `/auth` |
| Reports | `/reports` |
| Medications | `/medicationlist` |
| Home / summary | `/home` |
| Doctor link and dashboard | `/doctor` |
| Chat | `/chat` |

Errors are always returned as `{ "error": "<message>" }` with the status codes 400, 401, 403 or 404. Invalid ids give 400, not 500.

## Tests

The API is covered by Postman collections that run with Newman:

- **116 requests, 196 assertions** across auth, reports, medications, doctor access, chat and error cases
- every run creates its own patients and doctor, so it can be repeated
- the tests pass with encryption on and off

```bash
npm run test:auth     # auth only
npm run test:api      # reports, medications, doctor, chat
npm run test            # everything
```

Run them against a **test database** (`npm run dev:test`, see `postman/README.md`). The collections are in [`postman/`](postman/).

## Run it locally

You need Node.js 24, a MongoDB database (local or Atlas) and, for the summary, [Ollama](https://ollama.com) with `ollama pull llama3.1:8b`.

```bash
npm install
npm run dev
```

Create `.env.development.local` in the project folder. These are the variables (values are your own):

| Variable | Meaning |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `DB_NAME` | database name |
| `ACCESS_JWT_SECRET` | secret for the access token, at least 64 random characters |
| `CLIENT_BASE_URL` | address of the client (for CORS), default `http://localhost:5173` |
| `ENCRYPTION_ENABLED` | `true` or `false` (default `false`) |
| `ENCRYPTION_KEY` | 32 bytes, base64, only needed for encryption |
| `AI_MODEL`, `OLLAMA_BASE_URL` | model and address for the summary (optional) |

Never commit `.env` files.

### Demo data

A seed script fills a user with 21 days of fake check-ins and two medications (the course of the data tells a small story: a rough start, a medication change after 11 days, then recovery):

```bash
node --env-file=.env.development.local --conditions development \
  src/scripts/seedReports.ts patient@test.com --replace
```

`--replace` deletes the existing reports of that user first.

## Security notes

- Passwords are hashed with bcrypt. The API checks ownership on every report and medication.
- A doctor can only reach patients that are linked with a code.
- Field encryption exists, but is **off** in the demo (all data is fake).
- Known limit: the chat is not end-to-end encrypted.

## Project history

LuminaMind started as the final project of the WBS Coding School bootcamp *Software Engineering & AI* (2026) and is now developed further by me. The original planning document is in [`docs/`](docs/). I plan a second backend in Java with Spring Boot that must pass the same test collections.

I built this project together with an AI assistant (Claude) as a pair-programming partner. I review, test and understand the code that goes into it.
