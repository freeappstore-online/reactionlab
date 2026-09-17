# ReactionLab

Four reaction-time and focus tests with millisecond-accurate timing, built as an
installable, fully offline PWA. Nothing you record ever leaves your device.

- **Simple Reaction** — one stimulus, one response. Raw sensorimotor latency.
- **Choice Reaction** — four targets, hit the one that lights up. Adds a decision stage.
- **Go / No-Go** — respond to blue, withhold on red. Measures response inhibition.
- **Aim Trainer** — clear a run of targets. Visual search plus pointing.

---

## Environment

- Node **20.19** or newer
- pnpm **10.30** or newer

Both are declared under `engines` in the root and `web/` package manifests.

## Running it

From the workspace root (or from `web/` — both work):

```bash
pnpm install
```

```bash
pnpm dev        # http://localhost:5173
```

```bash
pnpm build      # typecheck + production build into web/dist
```

```bash
pnpm preview    # serve the production build (needed to exercise the service worker)
```

```bash
pnpm check      # frozen install + typecheck + build — the pre-PR gate
```

```bash
pnpm icons      # regenerate the PWA PNG icons from the vector mark
```

The service worker is only registered in production builds — a cached shell during
development would hide your source changes behind stale assets.

### Layout

A pnpm workspace with `web/` as the frontend package, following the FreeAppStore
handbook's Standalone structure:

```
.
├── web/                       the frontend package
│   ├── build/sw-plugin.ts     emits dist/sw.js with a precache manifest at build time
│   ├── public/                manifest.json, icons, offline fallback
│   └── src/
│       ├── App.tsx            composition, routing boundary, shell layout
│       ├── index.css          Tailwind imports, platform variables, app accent colour
│       ├── types.ts           shared interfaces and domain models
│       ├── components/        reusable UI and shell-level elements
│       ├── hooks/             stateful reusable hooks (store subscriptions, routing)
│       ├── services/          localStorage adapter, stats, scoring, timing, sw registration
│       ├── tests/             the four test engines + shared stage machinery
│       ├── views/             one module per screen
│       └── styles/            base, layout, components, stage (imported by index.css)
└── scripts/generate-icons.mjs dependency-free PNG icon generator
```

`index.css` is the only stylesheet entry. It wires Tailwind as theme + utilities
(preflight is left out so it cannot fight the app's own base layer), defines every
platform variable and the single accent token, and imports the partials into
cascade layers. Unused utilities and theme variables are pruned at build time, so
Tailwind adds well under 1 KB gzipped until something actually uses it.

---

## What is stored, and where

Everything lives in this browser's `localStorage`, under three keys. There is no
server, no account, no sync and no export that happens without you clicking it.
Clearing your browser's site data removes all of it.

Every read and write goes through `src/services/storage.ts` — no component calls
`localStorage` directly, so the schema, the validation and the size cap all have
exactly one home.

### `reactionlab.v1.sessions`

A JSON array of completed runs, newest first, capped at the **500 most recent**.
Each entry:

| Field        | Type                | Meaning                                                           |
| ------------ | ------------------- | ----------------------------------------------------------------- |
| `id`         | `string`            | `crypto.randomUUID()` where available, else a time-based fallback |
| `mode`       | `TestMode`          | `simple` \| `choice` \| `gonogo` \| `aim`                         |
| `startedAt`  | `number`            | Wall-clock epoch ms — used only to date the run, never subtracted |
| `durationMs` | `number`            | Elapsed run time, from `performance.now()` deltas                 |
| `trials`     | `Trial[]`           | One entry per stimulus: `{ index, outcome, rtMs }`                |
| `stats`      | `SessionStats`      | The derived figures below                                         |
| `score`      | `number`            | 0–1000, see [Scoring](#scoring)                                   |
| `config`     | `SessionConfig`     | Snapshot of `trials` / `minDelayMs` / `maxDelayMs` at run time    |
| `version`    | `1`                 | Schema version                                                    |

`config` is snapshotted deliberately: changing your settings later must not
silently reinterpret runs you already recorded.

Trial outcomes are `hit`, `wrong`, `miss`, `falseAlarm`, `correctReject` and
`falseStart`. `rtMs` is `null` whenever no input was made.

### `reactionlab.v1.settings`

```jsonc
{
  "trials": 8,              // 3–20 stimuli per session (Aim runs 2x this many targets)
  "minDelayMs": 1200,       // 500–6000
  "maxDelayMs": 3500,       // 500–6000, clamped so it can never fall below minDelayMs
  "perTrialFeedback": true, // show the millisecond result after each trial
  "version": 1
}
```

### `reactionlab.v1.streak`

```jsonc
{
  "current": 3,           // consecutive local calendar days with a completed run
  "longest": 11,
  "lastDay": "2026-09-02", // YYYY-MM-DD, local time
  "version": 1
}
```

The displayed streak is recomputed on read: a stored `current` older than
yesterday shows as `0` rather than as a number that has quietly gone stale.

### Reading is defensive

Storage can be disabled (private mode, locked-down browsers), full, or hold data
written by an older build. Every read is wrapped: unparseable entries are dropped,
out-of-range numbers are clamped, unknown modes are discarded, and a corrupt key
is removed rather than left to fail every future read. If `localStorage` is
unavailable, the app falls back to in-memory storage for the session and says so
on the home and results screens instead of pretending the run was saved.

---

## Timing

All measurement uses `performance.now()` — a monotonic, sub-millisecond clock
that is unaffected by the system clock being adjusted mid-session. `Date.now()`
appears in exactly one place: labelling a session with a calendar date. It never
takes part in a subtraction.

**Scheduling the stimulus.** `services/timing.ts` polls animation frames rather
than using `setTimeout`. A timeout fires at an arbitrary point inside a frame and
leaves the stimulus waiting up to another whole frame to be painted, with no
record of when that happened. Polling frames means the callback runs *inside* the
frame that will paint the stimulus, and the `requestAnimationFrame` timestamp it
receives — on the same clock as `performance.now()` — is that frame's own.

**Painting it.** In that callback, the stage's `data-phase` attribute is written
straight to the DOM before React is told anything. Every phase's colour and copy
is already in the document and selected by CSS alone, so the stimulus appears on
that frame and never waits for a React commit. No transition or animation is
allowed to touch the stage, since easing a colour change would smear the very
moment being measured.

**Reading the response.** Reaction time is the input event's own `timeStamp` —
captured by the browser before any of this app's code runs — minus the recorded
onset.

**Guards.**

- **False start.** Input during the wait phase is recorded as `falseStart`, never
  as a reaction. The trial is retried and does not consume a trial slot; the false
  start still counts against accuracy.
- **Double input.** A `responded` flag is set the instant a stimulus is answered,
  so a second press on the same stimulus is dropped.
- **Bleed-through.** Input within 250 ms of a phase change is swallowed, so the
  tail of the press that ended one trial cannot register as a false start on the
  next.
- **Backgrounded tab.** Animation frames stop when the page is hidden, so an armed
  stimulus would otherwise fire on the first frame after you return — before you
  are looking. Every mode treats a visibility change as a paused trial, discards
  it, and waits for a deliberate tap to resume. Aim also subtracts the paused time
  from its run duration.
- **Negative delta.** If an event somehow timestamps before the onset, the result
  is discarded as a false start rather than stored as nonsense.

---

## Scoring and statistics

### Per-session statistics

Computed in `services/stats.ts` over the trials that produced a usable reaction
time — outcomes `hit` and `wrong`. Misses, correct rejections and false starts
have no reaction time and are counted separately.

| Figure       | Definition                                                       |
| ------------ | ---------------------------------------------------------------- |
| `scored`     | Count of trials with a reaction time                             |
| `mean`       | Arithmetic mean of those times                                    |
| `median`     | Middle value; mean of the middle two when the count is even       |
| `best`       | Fastest                                                           |
| `worst`      | Slowest                                                           |
| `sd`         | **Population** standard deviation; `null` below two samples       |
| `accuracy`   | 0–1, defined per mode (below)                                     |
| `falseStarts` / `misses` / `falseAlarms` | Counts of those outcomes              |

Anything undefined for a run is `null`, not `0` — a run with no scored trials
reports "no usable trials" rather than a page of zeroes.

### Accuracy, per mode

| Mode      | Accuracy                                                    |
| --------- | ----------------------------------------------------------- |
| Simple    | `hits / all trials` (false starts and misses are in the denominator) |
| Choice    | `hits / all trials` — a response to the wrong target is not a hit |
| Go / No-Go| `(hits + correct rejections) / all trials` — withholding scores as heavily as reacting |
| Aim       | `on-target clicks / all clicks` — clicks that miss cost you           |

### Session score

Each run gets a single figure out of 1000:

```
score = 1000 × speed × accuracy

speed = clamp((ceilMs − mean) / (ceilMs − floorMs), 0, 1)
```

Both factors run 0–1, so a fast but sloppy run cannot outrank a clean one on speed
alone. The band is per mode, chosen from the typical human range for that task and
never tuned to an individual:

| Mode       | floorMs (full marks) | ceilMs (zero) | Headline metric   |
| ---------- | -------------------- | ------------- | ----------------- |
| Simple     | 150                  | 500           | Mean reaction     |
| Choice     | 250                  | 750           | Mean reaction     |
| Go / No-Go | 250                  | 700           | Mean on go trials |
| Aim        | 350                  | 1200          | Time per target   |

Go / No-Go averages **go hits only** — a false alarm is stored with its reaction
time for the record but is excluded from the mean, so guessing early on no-go
stimuli cannot flatter your speed. Aim's "time per target" is measured hit to hit,
which means an off-target click costs you real time as well as accuracy.

The trend line on History and on each test's landing screen plots the mean of your
most recent runs **within a single mode**. The modes have different baselines, so
a combined chart is deliberately not offered.

---

## Privacy

- No analytics, no telemetry, no cookies, no tracking of any kind.
- No network requests after first load. The only external resource the app ever
  requests is the Google Fonts stylesheet in `index.html`; the service worker
  caches it and its font files on first load and serves them from cache after that.
- No third-party scripts.
- Export produces a JSON file built and downloaded entirely in the page — it is
  never uploaded anywhere.

---

## PWA and offline

- `public/manifest.json` — name, description, `start_url`, `scope`, theme colour
  and 192/512/maskable icons.
- `apple-mobile-web-app-capable` and friends are set in `index.html`, alongside
  light and dark `theme-color` entries.
- `build/sw-plugin.ts` emits `dist/sw.js` at build time with a precache manifest
  of every asset Vite produced plus the files served from `public/`, and a cache
  version hashed from that list.
- **Cache strategy:** the app shell document is stale-while-revalidate (instant
  load, updated in the background for the next visit); hashed build assets are
  cache-first, since a hit is always the right bytes; the font CDN gets its own
  stale-while-revalidate cache that survives app updates; `offline.html` is the
  last-resort fallback. Old versioned caches are deleted on activate.

The app is fully usable with no connection after its first load — verified by
stopping the server and reloading.

---

## Quality bar

- TypeScript **strict**, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Zero `any`. `pnpm build` is clean with no warnings.
- Core JS bundle **≈76 KB gzipped**, under the 100 KB budget. The trend chart is a
  hand-rolled SVG polyline rather than a charting dependency; icons are inline
  paths.
- Responsive from 320 px through 1440 px+ with no horizontal overflow on any
  screen. Sidebar layout at ≥1024 px, app header + bottom dock below it.
- The final background colour is inlined in `<head>` so the first paint is correct
  and there is no flash or layout shift once the stylesheet lands.
- Dark mode via `prefers-color-scheme` only, as a straight design-token swap.

## Pre-PR checklist

Mirrors the FreeAppStore handbook's testing and quality table. Run the gate, then
walk the manual items against `pnpm preview`:

```bash
pnpm check
```

| Area        | Confirm                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Functional  | A full run in each mode; false start, miss, false alarm and off-target paths; Home/History empty states; Settings → erase |
| Responsive  | 320 px, tablet and ≥1024 px: no horizontal scroll, dock below 1024 px, sidebar above                     |
| PWA         | Install prompt appears; launches standalone; stop the server and reload — app and fonts still load       |
| Privacy     | DevTools Network after load: no requests except the app's own assets and the one font stylesheet         |
| Performance | Build output stays near the sizes above; no new dependencies without a size and maintenance reason       |

Pull requests should carry a summary, mobile and desktop screenshots, a privacy
impact note (this app's baseline: none — no data leaves the device) and the test
evidence from the table above.

### Privacy impact

Baseline for every change: **no data leaves the device**. Any PR that adds a
network request, a cookie, a third-party script or a new `localStorage` key must
say so explicitly and update the [What is stored](#what-is-stored-and-where)
section.

---

## License

MIT — see [LICENSE](LICENSE).
