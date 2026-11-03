# Conversation relay contract (`call-intake-v1`)

The web app simulates the phone call on screen. A real deployment puts a telephony
bridge (Twilio, Exotel, Plivo …) in front of the same intake, so nothing about the
engine changes: the bridge collects the answers and this endpoint decides the
severity, the trades, the mitigation script and whether a human has to take over.

- **Endpoint:** `POST /api/call/relay`
- **Auth:** session cookie or `Authorization: Bearer <jwt>`; the role must be
  `dispatcher` or `admin` (the bridge runs as a service account).
- **Content type:** `application/json`

## Request

```json
{
  "callId": "CA-8f2a1c",
  "transcript": "Water is spraying out from under the sink and there is a socket right there",
  "evidenceUploaded": true,
  "answers": {
    "flow": "gushing",
    "nearElectrical": true,
    "shutoffAccessible": "no",
    "vulnerableOccupant": "my grandmother is alone",
    "affectedUnits": 2
  }
}
```

Everything is optional, but at least one of `transcript` or `answers` should be
present — an empty body is graded as an unknown call and transferred to a human.
`answers` is strictly validated; unknown keys are rejected with `400`.

Structured `answers` always win over anything inferred from the transcript. Use
them whenever the IVR already knows the answer; use the transcript for free speech.

## Response

```json
{
  "protocol": "call-intake-v1",
  "callId": "CA-8f2a1c",
  "signals": { "waterPresent": true, "flow": "gushing", "...": "..." },
  "triage": {
    "version": "triage-v1",
    "classification": "burst_pipe",
    "severity": "P1",
    "confidence": 0.88,
    "escalateToHuman": false,
    "dispatchWindowMinutes": 60,
    "requiredTrades": ["plumbing", "electrical"],
    "mitigationScriptIds": ["electrical-safety", "stop-water-main-shutoff", "contain-water", "document-damage"],
    "matchedRuleIds": ["v1-burst-pipe", "v1-near-electrical"],
    "reasons": [{ "ruleId": "v1-burst-pipe", "text": "…" }],
    "followUpQuestions": ["…"]
  },
  "directives": [
    { "intent": "speak", "text": "P1 — burst pipe with 88% confidence. A contractor is needed within 1 hours." },
    { "intent": "guide", "scriptId": "electrical-safety", "firstStep": "Only move toward the breaker panel if your hands and feet are dry…" },
    { "intent": "ask", "text": "Send me one photo of the wet area so I can confirm how much water we are dealing with." },
    { "intent": "hold", "dispatchWindowMinutes": 60 }
  ]
}
```

Directive order is the order the bridge should speak them: the headline first, then
each safety script in the ruleset's safety order, then any follow-up questions, then
`transfer` (only when `escalateToHuman` is true) and finally `hold`, which tells the
bridge how long the caller should be kept on the line before a contractor must be
on site.

## How the transcript is read

Inference is lexical and deterministic — the same sentence always produces the
same signals, which is what makes the grade defensible afterwards.

| Signal | Words that set it |
| --- | --- |
| `flow` = `gushing` | gush, spray, burst, jet, pour, flood, shoot |
| `flow` = `pooling` | pool, puddle, standing water, water everywhere, flooded |
| `flow` = `steady` | stream, trickle, steady, running, keeps coming |
| `flow` = `drip` | drip, drop, slow leak, seep, occasional, every few |
| `flow` = `none` | no water, not water, dry, stopped leaking |
| `waterPresent` | water, leak, flood, dripping |
| `nearElectrical` | socket, wiring, electric, power, appliance |
| `ceilingOrWallDamage` | ceiling, wall, stain, bulge, plaster |
| `hotWaterOrBrown` | hot, brown, rust, discoloured |
| `sewage` | sewage, sewer, toilet overflow, drain coming back, smells like a drain |
| `gasOrSmoke` | gas, smoke, burning smell, hissing |
| `vulnerableOccupant` | child, baby, elderly, grandma, grandpa, wheelchair, cannot walk, alone |
| `shutoffAccessible` = `no` | can't reach, cannot reach, valve is stuck, no valve, don't know where the valve |

Anything not heard stays unknown and the engine lowers its confidence instead of
guessing. A signal below `TRIAGE_ESCALATION_THRESHOLD` (default `0.6`) sets
`escalateToHuman`, which is what produces the `transfer` directive.

## What the bridge still owns

- Creating the case with the confirmed `signals` (`POST /api/cases`) once the call
  ends, so the board, evidence and audit trail are attached to a real record.
- Turning `guide` directives into speech and recording the caller's confirmation of
  each step (`POST /api/cases/:id/mitigation/steps`) — the server enforces step
  order, so the bridge cannot skip a safety step.
- Uploading camera frames or clips as evidence (`POST /api/cases/:id/evidence`,
  multipart, JPEG/PNG/WebP/MP4/WebM only). Evidence raises confidence and is kept
  with the case for the insurance claim.

## Versioning

`protocol` and `triage.version` are echoed on every response. Add a new ruleset
version rather than editing `triage-v1`, so cases decided last month can still be
explained with the rules that were live at the time.
