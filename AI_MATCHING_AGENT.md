# AI Matching Agent — "Smart Candidate Feed"

> An agent that watches incoming candidate data, matches it against each
> restaurant's per-position standards, and drops a plain-language message on the
> restaurant's page:
> *"היי — ישראל, בן 18, זמין ל-3 משמרות, ניסיון של שנה כמלצר…"* — with a one-tap
> **"קבע ראיון"** button that books a meeting between the two sides.

This builds directly on the tables that already exist (`profiles`, `applications`,
`restaurant_positions`, `position_screening_questions`, `interviews`), so it's an
addition, not a rewrite.

---

## 1. What the restaurant sees (the end result)

A new card appears in the restaurant's feed the moment a strong candidate applies:

```
┌─────────────────────────────────────────────┐
│ 🟢  התאמה גבוהה · 92%            מלצר/ית      │
│                                               │
│  היי! ישראל ישראלי, בן 18, מתל אביב.          │
│  • זמין ל-3 משמרות בשבוע (בוקר, ערב)          │
│  • ניסיון של שנה במלצרות                       │
│  • זמין לסופי שבוע ✓                           │
│  • עברית + אנגלית                              │
│                                               │
│  ✓ עומד ב-5 מתוך 5 הדרישות שלך למשרה זו        │
│                                               │
│  [ 📅 קבע ראיון ]      [ צפה בפרופיל ]   [ ✕ ] │
└─────────────────────────────────────────────┘
```

- **Headline** — match score + which position it's for.
- **Body** — a short, human summary the agent wrote from the candidate's data.
- **Fit line** — how many of *this position's* requirements they meet.
- **Primary button "קבע ראיון"** — opens a time picker and creates an interview.
- Secondary: open full profile, or dismiss.

---

## 2. How it plugs into the current database

| Source | What the agent reads |
|---|---|
| `profiles` | age, city, experience, shifts, languages, `position_types`, `min_hourly_rate`, `max_distance` |
| `applications` | the `answers` jsonb + the `position_id` they applied to |
| `restaurant_positions` | `requirements` jsonb (age, military, experience, weekends, shift commitment, custom) + `hourly_rate` + `shifts` |
| `position_screening_questions` | the questions + expected answers for scoring |
| `restaurants` | `mandatory_shifts`, `soft_attributes` |

The deterministic score already has a home in `src/lib/matching.js` (`computeMatch`)
and `applications.match_score` — the agent reuses that, then adds the **written
summary** and the **feed message** on top.

### One new table — `match_messages`

The generated cards need somewhere to live:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK → `restaurants` | whose feed this lands in |
| `application_id` | uuid FK → `applications` | the application it summarizes |
| `position_id` | uuid FK → `restaurant_positions` | which role |
| `candidate_user_id` | uuid FK → `auth.users` | the candidate |
| `match_score` | int | 0–100, from `computeMatch` |
| `summary` | text | the agent-written blurb (Hebrew) |
| `highlights` | jsonb | bullet facts: `[{icon, text}]` |
| `met_count` / `req_count` | int | "5 of 5 requirements" |
| `status` | text | `new` / `viewed` / `scheduled` / `dismissed` |
| `created_at` | timestamptz | |

> RLS mirrors the other tables: a restaurant only sees its own messages
> (`can_edit_restaurant(restaurant_id)` for write, membership for read).

---

## 3. The agent pipeline

```
candidate applies
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 1. COLLECT   gather profile + application answers          │
│ 2. MATCH     run computeMatch() vs the position's          │
│              requirements + screening questions → score    │
│ 3. GATE      score ≥ threshold (e.g. 70)?  if not, stop    │
│ 4. SUMMARIZE ask the LLM to write the friendly blurb       │
│              + extract highlight bullets                    │
│ 5. NOTIFY    insert a row into match_messages (status=new) │
└──────────────────────────────────────────────────────────┘
        │
        ▼
  card appears on the restaurant's page
        │
        ▼
  owner taps "קבע ראיון"  →  creates an `interviews` row
                              + sets message status = scheduled
```

---

## 4. Step 4 in detail — writing the message

**Two layers, so it never depends entirely on the model:**

1. **Deterministic facts** (always correct, pulled straight from the data):
   age, city, shifts/week, weekend availability, experience, languages, and the
   `met_count / req_count` fit line.

2. **LLM phrasing** (Claude turns those facts into one warm Hebrew paragraph).

Sketch of the prompt:

```
System: You write short, friendly Hebrew intros for restaurant owners about job
candidates. 2–3 sentences, warm but factual. Never invent data not provided.

User (structured facts):
{
  "name": "ישראל ישראלי",
  "age": 18,
  "city": "תל אביב",
  "position": "מלצר/ית",
  "shifts_per_week": 3,
  "shifts": ["בוקר","ערב"],
  "experience": "1_plus",
  "weekends": true,
  "languages": ["עברית","אנגלית"],
  "score": 92,
  "met": 5, "req": 5
}
```

If the LLM call fails, fall back to a templated sentence built from the same facts —
the card still works, just less polished.

---

## 5. The "קבע ראיון" button → interview

The button reuses the existing `interviews` table — no new infra:

```
on tap:
  1. open a time picker (date + time + duration)
  2. INSERT into interviews {
        restaurant_id, application_id, position_id,
        candidate_user_id, candidate_name, candidate_phone,
        scheduled_at, duration_min, status: 'scheduled', created_by
     }
  3. UPDATE match_messages SET status = 'scheduled'
  4. (optional) notify the candidate
```

It already shows up in the existing **ראיונות** tab afterward.

---

## 6. Where the agent runs

A **Supabase Edge Function** is the natural home:

- **Trigger:** a database webhook on `INSERT INTO applications` (fires per new
  application), or a cron sweep every few minutes for anything unprocessed.
- **Does:** steps 1–5 above (collect → match → gate → summarize → insert message).
- **Secrets:** the Claude API key lives in the edge function's env — never in the
  client, never in the database.

This keeps the client app dumb: it just reads `match_messages` and renders cards.

---

## 7. Build checklist

- [ ] Create the `match_messages` table + RLS.
- [ ] Move/confirm `computeMatch` returns score **and** the per-requirement breakdown.
- [ ] Write the edge function: collect → match → gate → summarize → insert.
- [ ] Add the Claude summary prompt + a deterministic fallback.
- [ ] Wire the database webhook on `applications` insert.
- [ ] Build the feed card UI (HomeTab or a new "התאמות" section).
- [ ] Wire the "קבע ראיון" button to the interview flow + status update.
- [ ] Set a sensible score threshold (start ~70, tune from data).

---

## 8. Privacy & trust notes

- The agent only ever surfaces a candidate who **actively applied** to that
  restaurant — it never scrapes or shares profiles across restaurants.
- The summary states **only facts the candidate provided**; the prompt forbids
  inventing details.
- No contact info is auto-sent anywhere — a meeting is created only when the owner
  taps the button.
- The Claude key stays server-side in the edge function.
