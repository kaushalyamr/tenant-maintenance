# Deploying to Vercel

The monorepo ships as **two Vercel projects** built from the same repository:

| Project | Root directory | What it runs |
| --- | --- | --- |
| `tenant-maintenance-api` | `apps/api` | The Express API as one Vercel Function (`index.js`) |
| `tenant-maintenance-web` | `apps/web` | The Next.js app, which also proxies `/api/*` to the API |

The proxy keeps the browser talking to a single origin, so the session cookie is
not a cross-site cookie. That is what makes login work reliably in Safari and
in Chrome's third-party-cookie modes.

## 1. Create a MongoDB database

Vercel Functions cannot reach the MongoDB service on your laptop, and their disk
is ephemeral. Use a remote MongoDB, such as a free MongoDB Atlas cluster:

1. Create a cluster and a database user that can read/write one database
   (`tenant_maintenance`).
2. Under **Network Access**, allow `0.0.0.0/0`. Vercel Functions have no fixed
   egress addresses; the dedicated database user and a strong password are the
   control that matters here.
3. Copy the `mongodb+srv://...` connection string.

Uploaded evidence is stored in MongoDB automatically on Vercel
(`EVIDENCE_STORAGE` defaults to `mongo` when `VERCEL=1`).

## 2. Deploy the API

Import the repository at <https://vercel.com/new>, then set:

- **Root Directory:** `apps/api`
- **Framework Preset:** Express (Vercel detects it; no build command is needed)

Environment variables for Production:

| Name | Value |
| --- | --- |
| `MONGODB_URI` | your Atlas connection string, including `/tenant_maintenance` |
| `JWT_SECRET` | 48+ random bytes, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `WEB_ORIGIN` | `https://<web-project>.vercel.app` (fill in after step 3) |
| `COOKIE_SECURE` | `true` |
| `SESSION_TTL_HOURS` | `12` |
| `EVIDENCE_MAX_BYTES` | `4000000` (Vercel caps a request body at 4.5 MB) |
| `TRIAGE_VERSION` | `triage-v1` |
| `TRIAGE_ESCALATION_THRESHOLD` | `0.6` |
| `SEED_PASSWORD` | `tenant1234` (demo only) |

Deploy, then note the production URL, for example
`https://tenant-maintenance-api.vercel.app`.

## 3. Deploy the web app

Import the same repository again as a second project:

- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js

Environment variables for Production:

| Name | Value |
| --- | --- |
| `API_PROXY_TARGET` | the API URL from step 2, e.g. `https://tenant-maintenance-api.vercel.app` |
| `NEXT_PUBLIC_API_BASE` | leave **unset**; empty means same-origin `/api` |

`API_PROXY_TARGET` is read by `next.config.mjs` at build time, so set it before
the first build (or redeploy after changing it).

Finally set `WEB_ORIGIN` on the API project to this web URL and redeploy the API
if you deployed it before the web URL existed.

## 4. Seed the demo data

Run the real seed script against Atlas from your machine:

```bash
MONGODB_URI="mongodb+srv://..." \
JWT_SECRET="the-same-secret-as-vercel" \
npm run seed --workspace apps/api
```

The seed uses the production services (triage, dispatch, close), so the
deployed app opens with the same six cases and eleven logins documented in the
README.

## 5. Verify

- `GET https://<api>/api/health` returns `{"status":"ok","database":"connected"}`.
- `https://<web>/login` accepts `nimali@greenmeadows.test` / `tenant1234`.
- Reporting a burst pipe returns a P1 result with a confidence score.
- Uploading a photo succeeds, and the photo renders in the case timeline.
- The dispatcher board shows ranked contractors and typed refusals.

## CLI alternative

```bash
npx vercel login
npx vercel --cwd apps/api --prod
npx vercel --cwd apps/web --prod
```

Set the environment variables in the Vercel dashboard (or with
`npx vercel env add NAME production`) before the first production deployment.

## Limits worth knowing

- **Evidence:** limited to 4 MB on Vercel because of the platform's request-body
  cap; the local default is 15 MB.
- **Cold starts:** the Express function reconnects to MongoDB on a cold start,
  which adds roughly a second to the first request after idle.
- **Sessions:** a redeploy or re-seed creates new user documents, so existing
  session tokens are rejected and users sign in again.
- **Demo credentials:** the seeded passwords are public by design. Do not reuse
  this seed for a production clinic.
