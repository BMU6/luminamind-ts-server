## About the App

**LuminaMind** is a self-tracking application for psychiatric/psychological inpatients, used during a hospital stay (typically 4–12 weeks). Its central purpose is to make the **correlation between medication and subjective health state visible over time** — for example, answering a question like: *"Two weeks ago we introduced a new medication and increased the dose weekly since — how did my subjective health state develop, day by day, during that period?"*

Throughout the day (typically twice or more), the patient creates a **report**: a short free-text message describing how they are feeling, linked to the medication(s) active for them at that time. Alongside the message, the patient rates a set of key indicators on a scale of **0–5**:

- Mood
- Drive/Energy
- Sleep
- Concentration
- Irritability

These reports accumulate over the course of the stay into a **timeline view** ("Home"), where each report appears linked to its point in time, alongside a **chart** plotting the rated indicators over the same period. This lets both the patient and psychologist look back and trace how subjective wellbeing developed relative to medication changes over weeks.

**AI Summary**: for a selected date range, the AI is given all reports written within that period and generates a summary of them. *(The specific rules/prompting strategy for how the AI should analyze and summarize this data are not yet defined — open item.)*

**Roles**: the app has two distinct user roles — **patient** and **treating psychologist**. The psychologist has their own view, showing the overall trend across several patients along their respective timelines, and can reach out to a patient directly via **live chat** if their data suggests a decline that warrants attention outside the regular weekly sessions.

### Scope for this bootcamp deliverable (2 developers)

**In scope:**
- Patient role: reports, medication list, timeline/chart view, AI summary
- Psychologist role: multi-patient trend overview, live chat with patients

**Out of scope for this bootcamp deliverable:**
- Encryption of live chat content (chat itself is in scope; encrypting it is not — to be reconsidered in a later phase)

\newpage

# LuminaMind — Technology Stack Overview (Final Project)

This document describes the planned technology stack for the **final bootcamp deliverable** (~3.5 weeks remaining): a web-based React client with an Express/MongoDB backend, providing similar functionality to the mobile proof-of-concept but delivered as a standard web application.

The working React Native/Expo mobile app (PostgreSQL/Prisma-based) remains in place as a demonstrated proof of concept, but is not the delivered artifact for final evaluation. Note: MongoDB was originally ruled out for the mobile PoC due to offline-sync considerations with local SQLite storage — that constraint doesn't apply to the web app, so MongoDB/Mongoose is a reasonable, consistent choice here and aligns with what's taught in the bootcamp.

---

## Database

| Technology | Role |
|---|---|
| MongoDB | Document database for the final web app backend. |
| Mongoose | ODM (Object Document Mapper) for MongoDB — defines schemas/models and handles queries from the Express backend. Written fresh for this project; does not reuse the PoC's Prisma schema. |

---

## Backend

| Technology | Role |
|---|---|
| Node.js | JavaScript/TypeScript runtime executing the backend server. |
| Express | Minimal HTTP framework — defines the API routes (e.g. `/auth/login`, `/records`) and handles requests/responses. |
| TypeScript | Static typing over JavaScript; catches type errors (wrong argument types, missing fields) at compile time rather than at runtime. |
| bcryptjs | One-way password hashing — the database never stores a reversible password. |
| jsonwebtoken (JWT) | Issues signed access tokens proving a request's identity; short-lived access tokens plus longer-lived, rotating refresh tokens. |
| zod | Schema validation for all incoming request data before it reaches business logic or the database. Independent of the DB layer, so unaffected by the Mongoose switch. |
| helmet | Sets security-related HTTP response headers, mitigating several common web attack classes. |
| cors | Restricts which origins are allowed to call the API. Requires `credentials: true` and an explicit (non-wildcard) origin to support the refresh-token cookie. |
| cookie-parser | Express middleware that parses the `Cookie` header into `req.cookies` — needed to read the refresh-token cookie server-side. |
| express-rate-limit | Rate-limits requests per IP, particularly on authentication endpoints, to slow brute-force attempts. |
| socket.io | Real-time bidirectional communication — powers the live chat between patient and treating psychologist. Runs alongside the Express HTTP server. |
| `crypto` (Node built-in) — **stretch goal** | AES-256-GCM encryption/decryption of sensitive fields (e.g. `name`) before they are written to the database. Not core scope; added at the end of the project if time remains. Mirrors the field-level encryption used on the mobile client. |
| Environment variable (`.env`, git-ignored) — **stretch goal** | Would hold the server-side AES encryption key, if/when encryption is implemented. *Documented limitation:* a production deployment would move this to a managed secrets service (AWS Secrets Manager, HashiCorp Vault, etc.) instead of a plain environment variable. |

---

## Web Client

| Technology | Role |
|---|---|
| Vite | Build tool and dev server for the React application. |
| React | UI library — component-based screens matching the planned GUI (Sign in/Log in, Medication list, New/Edit Entry, Home/dashboard). |
| TypeScript | Static typing, consistent with the backend and mobile codebases. |
| Tailwind CSS | Utility-first CSS styling. |
| DaisyUI | Component library built on top of Tailwind, for consistent pre-styled UI elements. |
| React Router v7 (`react-router` package) | Client-side routing between screens, without full page reloads. Chosen deliberately over a meta-framework (Next.js, Remix) to keep the setup scoped to routing only. |
| Native `fetch` + custom interceptor | HTTP client. A global `window.fetch` override (based on the bootcamp's own `fetchInterceptor` pattern) inspects each response for an expired-token signal (`WWW-Authenticate: token_expired`), transparently calls `/refresh`, and retries the original request once. Includes a single-in-flight-refresh guard to prevent concurrent requests from triggering duplicate, colliding refresh calls under refresh-token rotation. |
| Manual form handling (`useState`) | Form state and validation for the Sign in/Log in/New Entry/Medication forms, handled directly with React state rather than a form library. |
| zod | Same validation library as the backend; can still be reused client-side for manual validation logic even without a form-library resolver. |
| Chart.js | Renders the multi-series trend chart on the Home screen (Mood, Drive/Energy, Sleep, Concentration, Irritability over time). |
| i18next + react-i18next | English/German localization — web bindings of the same i18next setup used on mobile. |
| React Context API | Global state management for auth/user state. Deliberately not using Zustand/Redux, as the app's scope doesn't currently warrant it. |
| socket.io-client | Connects to the backend's socket.io server for the live chat feature between patient and psychologist. |

### Roles & Live Chat

The app has two user roles: **patient** and **treating psychologist**. Role is stored on the user record (Mongoose) and included as a claim in the JWT, so both the backend (route/socket authorization) and the frontend (which views/navigation a user sees) can branch on it without a separate lookup.

- **Patient**: creates reports, views own timeline/chart, sees own medication list, can chat with their assigned psychologist.
- **Psychologist**: sees an overview of assigned patients' trends along their timelines, can open a live chat with a patient — intended for cases where the data suggests a decline warranting attention outside the regular weekly sessions.

Live chat is implemented via **socket.io**, with role-based access enforced both on the API (Express middleware checking the JWT role claim) and on socket connections/rooms (a chat "room" per patient–psychologist pair, joined only by the two authorized participants).

**Out of scope for this bootcamp deliverable:** encryption of live chat content. The chat feature itself is in scope; end-to-end or at-rest encryption of chat messages is deferred to a later phase.

### Auth token storage (final)

- **Access token** — `localStorage`.
- **Refresh token** — `httpOnly` cookie, sent automatically by the browser (`credentials: 'include'`), never touched by JavaScript.

---

## Notes / Known Limitations (for instructor discussion)

- Field-level encryption of sensitive data is a stretch goal, not core scope; if not implemented, this is a documented gap versus the mobile PoC (which does encrypt the `name` field on-device).
- If encryption is added, the key lives in a `.env` file for this bootcamp timeline — not production-ready; a real deployment would use a managed secrets service.
- The fetch-interceptor pattern requires the backend to explicitly signal token expiry via a `WWW-Authenticate: token_expired` header on 401 responses — this needs deliberate handling in the auth middleware, not something JWT libraries provide by default.
- Access token in `localStorage` carries some XSS exposure risk; the refresh token (longer-lived, more sensitive) is protected via `httpOnly` cookie.
- Live chat content is not encrypted in this deliverable — a known, explicitly accepted gap for a feature handling sensitive health-related conversation, to be reconsidered in a later phase.
