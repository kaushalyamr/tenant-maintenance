# Tenant Maintenance Triage & Dispatch

A simulated emergency line for residential buildings. It takes a tenant's water
call, separates a burst pipe from a minor leak, walks the caller through the
shutoff valve, keeps the photo evidence, and dispatches a contractor whose licence,
insurance, coverage and spare capacity all check out.

The point of the product is the first ten minutes of an emergency: the tenant is
standing in water, the building manager is asleep, and the difference between a
burst supply line and a dripping trap decides whether someone drives out tonight.

- **Frontend:** Next.js 16 (App Router, React 19, Tailwind CSS 4)
- **Backend:** Node.js + Express 4, Zod validation
- **Database:** MongoDB via Mongoose 9
- **Testing:** `node --test` — 52 tests, including HTTP-level auth/validation tests

## Why it is not an LLM wrapper

Every classification is produced by a **versioned, deterministic ruleset**
(`apps/api/src/domain/triage-v1.js`). The response carries the rule ids that
fired and a human-readable reason for each, plus a confidence score. Below the
configured threshold the case is handed to a person instead of being dispatched
automatically. The same call always grades the same way, which is what makes a
decision defensible to a landlord or an insurer afterwards.

An actual AI/telephony layer can be attached later through the documented relay
contract in [`docs/conversation-relay.md`](docs/conversation-relay.md) without
touching the engine.

## Quick start

Requirements: Node.js 22+, a running MongoDB (a local service on the default port
is fine).

```bash
npm install

# 1. Configure the API
cp .env.example apps/api/.env      # then edit JWT_SECRET and MONGODB_URI

# 2. Load demo data (wipes the collections it owns)
npm run seed

# 3. Run the API (:4000) and the web app (:3000) in two terminals
npm run dev:api
npm run dev:web
```

Open <http://localhost:3000>. `npm test` runs the suite; `npm run build` builds
the front end for production and `npm run start:api` runs the API without watch
mode.

**Deploying:** the API and the web app ship as two Vercel projects. Step-by-step
instructions, environment variables and the remote-MongoDB requirement are in
[`docs/deployment.md`](docs/deployment.md).

## Demo logins

Seeded by `npm run seed`. Password for every account: `tenant1234`.

| Role | Email | What they see |
| --- | --- | --- |
| Tenant | `nimali@greenmeadows.test` | A P1 burst pipe mid-repair, her case history |
| Tenant | `farhan@greenmeadows.test` | A routine drip waiting to be scheduled |
| Tenant | `amara@greenmeadows.test` | A sewage backup, escalated, guidance in progress |
| Tenant | `kasun@greenmeadows.test` | A completed repair and a closed duplicate |
| Tenant | `priya@greenmeadows.test` | A concealed ceiling leak already dispatched |
| Dispatcher | `dispatcher@greenmeadows.test` | The live board, contractor matching, all actions |
| Admin | `admin@greenmeadows.test` | Same board plus the admin-only transitions |
| Contractor | `desk@rapidreroute.test` | Two live work orders to accept, decline or close out |
| Contractor | `dispatch@drainworks.test` | An empty job list (proves the empty state) |
| Contractor | `sos@metroemergency.test` | A plumbing business whose licence lapses in 18 days |
| Contractor | `orders@oldtown.test` | A business at full capacity — never offered new work |

The seeded portfolio deliberately contains one contractor with an expired licence,
one that is suspended, one that is fully booked and one whose licence is about to
lapse. They exist so the compliance filter and the renewal warning are visible on
screen instead of only in the code.

### A five-minute demo

1. Sign in as **Nimali** → **Call** → *Start call* → answer *spraying out*, *near a
   socket*, *grandmother at home* → the engine returns **P1 burst pipe, 88%** with
   the rules that decided it.
2. Accept *Isolate electricity near the water* and confirm the four steps in order
   (the server refuses out-of-order confirmations). Attach a photo — confidence
   rises and the "send me a picture" follow-up disappears.
3. Sign in as **Dilhani** (dispatcher): the case is on the board. *Find a
   contractor* shows ranked, eligible firms, and a collapsible list of the firms
   the compliance filter refused and why. Dispatch the top match.
4. Sign in as that contractor → **My jobs** → *Accept and travel*, then *Mark the
   work complete* with a note. The case resolves and the tenant's timeline shows
   the whole story.
5. Open any case and read **Timeline** — every step is append-only with who did it.

## Project structure

```
apps/
  api/
    src/
      domain/        pure rules: triage-v1, mitigation scripts, state machine, matching
      http/          auth, validation, CORS, error translation
      models/        Mongoose schemas (User, Property/Unit, Contractor, Case, Job)
      routes/        Express routers
      services/      case lifecycle, dispatch, evidence, auth, relay
      seed.js        demo portfolio + six cases built through the real services
    tests/           domain tests + HTTP integration tests
  web/
    app/             App Router pages: /, /login, /call, /dashboard, /cases, /jobs
    components/      reusable UI (TriagePanel, MitigationGuide, EvidenceUploader, …)
    lib/             fetch wrapper and session context
docs/
  conversation-relay.md   telephony bridge contract
```

## Data model

- **Property / Unit** — units carry a zone (used for contractor coverage), the
  shutoff location and whether a tenant can reach it.
- **User** — one collection for tenants, dispatchers, admins and contractors.
  Passwords are scrypt hashes (`scrypt$N$r$p$salt$hash`), never plaintext, and the
  hash is `select: false` so it cannot leak through a populated document.
- **Contractor** — trades, licence and insurance expiry dates, coverage zones,
  concurrency cap and typical response time. These are the dispatch constraints.
- **Case** — the reproducible record: the intake signals, the triage snapshot
  (version, confidence, matched rules), mitigation scripts with per-step
  confirmations, evidence metadata, the dispatch snapshot and an append-only
  `events` array.
- **Job** — the work order handed to one contractor. A partial unique index
  (`{case: 1}` where the job is `open` or `accepted`) makes "one live work order
  per case" a database invariant rather than a UI rule.

## How the rules engine decides

Rules have priorities; the lowest priority that matches decides the headline
diagnosis, and *aggravators* can raise severity, add trades and add safety scripts
without renaming it.

| Priority | Rule | Result |
| --- | --- | --- |
| 10 | Gas smell or smoke | P1 life safety (outranks everything) |
| 20 | Sewage backing up | P1, drainage + plumbing |
| 30 | Water under pressure (`gushing`) | P1 burst pipe |
| 40 | Steady stream | P2 active leak |
| 50 | Ceiling or wall damage | P2 concealed leak |
| 60 | Pooling or spreading | P2 |
| 70 | Slow drip | P3 |
| 80 | Flow cannot be determined | Unknown, transfers to a human |
| 100 | No water present | Leaves the emergency queue |

Aggravators include water near electrical fittings, an unreachable shutoff, a
vulnerable occupant in the unit and the number of units affected. Confidence starts
from the deciding rule and moves with the evidence: an uploaded photo adds,
"cannot tell" and unknown source/shutoff subtract.

Mitigation scripts are ordered by safety, not by rule order — evacuate and isolate
electricity before touching a valve.

## Contractor matching

Eligibility is checked before a score is computed, so an attractive contractor who
cannot legally do the job never appears:

`inactive → trade mismatch → licence expired → insurance expired → capacity full →
out of coverage → response time misses the SLA window`

Eligible firms are scored out of 100: trade fit 30, response fit 25, spare capacity
20, rating 15, compliance runway 10. The endpoint returns both the ranked matches
and the typed rejections with a reason, so the dispatcher can see *why* a familiar
name is missing.

Matching is always re-run server-side at dispatch time: dispatching a contractor
the fresh shortlist no longer contains is refused with that same reason.

## Security and correctness

- Sessions are JWTs in an `httpOnly`, `SameSite=Lax` cookie; the token is re-checked
  against the user record on every request, so deactivating an account takes effect
  immediately. `COOKIE_SECURE=true` marks the cookie `Secure` for HTTPS.
- Authorization is role- and ownership-based: tenants see only their own cases,
  contractors only cases with a live job of theirs, dispatchers and admins the
  whole portfolio. Tenant dispatch attempts return `403`.
- Every request body, query string and path parameter is validated with Zod; the
  error response names the offending field. Mongo duplicate-key and cast errors are
  translated into `409`/`400` instead of leaking a stack trace.
- Evidence is stored under a server-generated name with an extension derived from
  the detected MIME type — never from the uploaded filename — and each item stores
  a SHA-256 of its bytes. Bytes go to disk on a normal server and to MongoDB on a
  serverless host, which has no persistent disk.
- Because the local MongoDB runs standalone (no multi-document transactions), the
  dispatch flow compensates: the job is deleted if the case transition fails, and a
  unique index enforces one live job per case.

## API at a glance

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/login`, `/api/auth/logout`, `/api/auth/register` | public |
| GET | `/api/auth/me` | any session |
| POST | `/api/auth/staff` | dispatcher / admin |
| POST | `/api/cases` | tenant, dispatcher |
| GET | `/api/cases`, `/api/cases/:id` | role-scoped |
| POST | `/api/cases/:id/mitigation/acknowledge`, `/mitigation/steps` | tenant, staff |
| POST | `/api/cases/:id/evidence`, GET `/evidence/:evidenceId` | anyone who can see the case |
| GET | `/api/cases/:id/matches` | dispatcher, admin |
| POST | `/api/cases/:id/dispatch` | dispatcher, admin |
| POST | `/api/cases/:id/reassess`, `/escalate`, `/cancel`, `/close`, `/reopen` | role-scoped |
| GET | `/api/jobs/mine` | contractor |
| POST | `/api/jobs/:id/accept`, `/decline`, `/complete`, `/notes` | contractor |
| GET/POST | `/api/properties`, `/api/contractors`, `/api/units` | registry |
| GET | `/api/mitigation-scripts`, `/api/triage-rules`, `/api/health` | ruleset is readable |
| POST | `/api/call/relay` | dispatcher, admin (telephony bridge) |

## Design decisions and trade-offs

- **Deterministic rules over a model.** Explainability and repeatability beat a
  smoother-sounding transcript. The engine is small enough to unit-test (52 tests)
  and can be replaced later without changing the API.
- **One monorepo, two apps.** The Next.js app talks to Express over HTTP with
  credentials, exactly as it would in production; there is no build-time coupling.
- **Evidence is an engine input, not an attachment.** Uploading a photo raises
  confidence and suppresses the follow-up question that asks for one.
- **The relay is a contract, not a stub.** The simulated call screen and a future
  Twilio bridge both end in the same triage function.

### Known limitations

- The phone call itself is simulated; no PSTN provider is wired up (no API keys are
  required anywhere in the project).
- The relay's free-text reading is lexical, not semantic. Unusual phrasing falls to
  "unknown" and is transferred to a human by design.
- Single-tenant deployment: the property register is global rather than scoped to
  an organisation. Multi-tenancy would key cases and contractors by organisation.
- Evidence lives on local disk in development and in MongoDB on Vercel; a larger
  deployment would use object storage with signed URLs.
