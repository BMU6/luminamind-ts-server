# API tests (Postman collections + Newman)

Two collections, both run automatically from the terminal with Newman:

| File | What it tests | Command |
|---|---|---|
| `luminamind-auth.postman_collection.json` | register, login, me, refresh, logout | `npm run test:auth` |
| `luminamind-api.postman_collection.json` (folders 0-6) | reports, medications, home, doctor link, chat, roles, ownership | `npm run test:api` |
| `luminamind-api.postman_collection.json` (folder 9) | gaps found while writing the tests, they FAIL on purpose | `npm run test:known-issues` |

`npm test` runs auth + api.

## One-time setup

1. `npm install -D newman`
2. Create `.env.test.local` (it is ignored by git, like all `.env*` files):
   copy `.env.development.local` and change **DB_NAME** (for example `luminamind-test`).
   Keep the same `ACCESS_JWT_SECRET`, the expired-token test in the auth collection needs it.
   The tests create users, reports and messages, so they must never run against your real data.

## Run

```
npm run dev:test     # terminal 1: server with the test database
npm test             # terminal 2: all automatic tests
```

Every run creates its own patients A and B and its own doctor (unique e-mail addresses), so old data in the test database does not matter.
Ollama is not needed, the AI summary is not part of the automatic tests.

## Expired token for the auth collection

The check "Me - expired token" needs a token that is already expired but signed with YOUR `ACCESS_JWT_SECRET`.
Create it in the server folder and paste it as `expiredAccessToken` into `luminamind-auth.postman_environment.json`:

```
node --env-file=.env.test.local -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({roles:['patient']},process.env.ACCESS_JWT_SECRET,{subject:'64b000000000000000000001',expiresIn:-60}))"
```

Repeat this if you ever change the secret.

## Encryption on and off

The tests only look at the API answers, so they must give the same result in both modes:
set `ENCRYPTION_ENABLED=true` and an `ENCRYPTION_KEY` in `.env.test.local`, restart `npm run dev:test`, run `npm run test:api` again.

## In the Postman app

Import the two collections and the two environment files, select the environment, run a collection with the Runner.
For the api collection run the folders 0 to 6 in order (folder 0 creates the users).

## Known issues (folder 9)

Requests that describe how the API should behave but does not yet. When one is fixed,
move its request into the normal folders so it protects the fix from now on.
