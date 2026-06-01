# Database Redesign — Positions, Shifts & Screening Questions

> Separating positions, shifts, and screening questions out of the
> `restaurants` table into their own clean, normalized structure.
>
> **Status: ✅ Implemented.** All four tables exist, the system catalog is seeded,
> and existing restaurant data has been migrated. The old `position_*` /
> `screening_questions` JSON columns on `restaurants` are kept as **legacy** (the
> app still reads them) and can be dropped once the UI is switched over.
>
> **One deviation from the original proposal:** `restaurant_positions.requirements`
> is stored as **`jsonb`**, not `text[]`. The existing data already had a rich
> requirements object (age range, military status, experience level, weekend
> availability, shift commitment, plus a `custom` list), so `jsonb` preserves it
> exactly rather than flattening it.

---

## The Problem Today

Right now everything about jobs lives as JSON blobs on the `restaurants` row:

- `position_types` (text[])
- `position_salaries` (jsonb)
- `position_counts` (jsonb)
- `position_requirements` (jsonb)
- `screening_questions` (jsonb)
- `shifts` / `mandatory_shifts` (text[])

This works for "one restaurant, one set of conditions" but breaks down the moment a
restaurant has **5 different positions, each with its own pay, requirements, shifts,
and questions**. You can't query it cleanly, you can't attach an application to a
specific position, and the matching logic has to dig through nested JSON.

---

## The Core Idea: Two Layers

The cleanest way to model "system defaults that a restaurant can adopt and customize"
is to split everything into two layers:

| Layer | Owned by | Examples |
|---|---|---|
| **Catalog** (templates) | The system / platform | "Waiter", "Bartender", and their standard questions |
| **Instance** | A specific restaurant | "This restaurant's waiter role at ₪45/hr with these 3 questions" |

A restaurant **enables** a catalog position → that creates an instance it can then tune.
A restaurant can also create a **fully custom** instance with no catalog link at all.

This same pattern applies to both positions *and* screening questions.

---

## Proposed Tables

### Layer 1 — System Catalog (seeded once, shared by everyone)

#### `position_templates`
The library of standard positions every restaurant can pick from.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `key` | text UNIQUE | machine name: `waiter`, `bartender`, `cook` |
| `name` | text | display label: מלצר/ית, ברמן/ית |
| `icon` | text | optional emoji / icon name |
| `sort_order` | int | display order |

#### `screening_question_templates`
The standard questions that ship with each catalog position.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `position_template_id` | uuid FK → `position_templates` | which position this default belongs to |
| `question` | text | the question text |
| `answer_type` | text | `boolean` / `single_choice` / `multi_choice` / `scale` / `text` |
| `options` | jsonb | choices for the choice/scale types |
| `sort_order` | int | |

> These two tables are filled by us (the platform), not by restaurants. A restaurant
> never edits them — it copies from them.

---

### Layer 2 — Restaurant Instances (what a restaurant actually has)

#### `restaurant_positions`
One row per position a restaurant is hiring for. **Replaces** all the `position_*`
JSON columns on `restaurants`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK → `restaurants` | |
| `template_id` | uuid FK → `position_templates` **(nullable)** | `NULL` = a fully custom position |
| `name` | text | label (copied from template, or custom) |
| `hourly_rate` | int | pay **for this position** |
| `open_count` | int | how many people needed |
| `requirements` | text[] | requirements **for this position** |
| `shifts` | text[] | shifts **for this position** (see Shifts below) |
| `is_open` | boolean | currently hiring for this role |
| `created_at` | timestamptz | |

#### `position_screening_questions`
The questions attached to a single position — both adopted-from-system and custom.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `position_id` | uuid FK → `restaurant_positions` | |
| `template_id` | uuid FK → `screening_question_templates` **(nullable)** | `NULL` = custom question |
| `question` | text | text (can be edited even if it came from a template) |
| `answer_type` | text | `boolean` / `single_choice` / `multi_choice` / `scale` / `text` |
| `options` | jsonb | choices |
| `enabled` | boolean | restaurant can toggle a question on/off without deleting it |
| `is_required` | boolean | candidate must answer |
| `sort_order` | int | |

---

## How the Flows Work

**Restaurant enables a system position (e.g. Bartender):**
1. Insert a `restaurant_positions` row with `template_id` = the bartender template.
2. **Copy** that template's `screening_question_templates` into
   `position_screening_questions` (keeping `template_id` for provenance).
3. The restaurant now edits pay, requirements, shifts, and freely toggles / edits /
   reorders the copied questions.

**Restaurant creates a custom position:**
1. Insert a `restaurant_positions` row with `template_id = NULL` and a custom `name`.
2. It starts with no questions; the restaurant adds custom ones
   (`position_screening_questions` rows with `template_id = NULL`).

**Restaurant adds a custom question to *any* position:**
- Just insert a `position_screening_questions` row with `template_id = NULL`.

> **Why copy-on-enable instead of referencing templates live?**
> Because it keeps editing dead simple: every question a restaurant sees is a real row
> it owns and can change. We never have to merge "template + overrides" at read time.
> The `template_id` is kept only so we know where it originally came from.

---

## Shifts

Shifts move **onto the position** (the `shifts text[]` column on `restaurant_positions`),
because the whole point is that a bartender's shifts differ from a cook's.

Shifts are a fixed vocabulary, so an array column is the simplest clean choice:

```
'morning'  בוקר
'noon'     צהריים
'evening'  ערב
'night'    לילה
'weekend'  סופ"ש
```

> **If you later need per-shift detail** (e.g. "2 bartenders needed on Friday night
> specifically"), promote it to a junction table `position_shifts(position_id,
> shift_key, count)`. Until then, the array is enough — don't over-build it.

---

## Changes to Existing Tables

#### `applications`
Add a link to the specific position applied for:

| Column | Type | Notes |
|---|---|---|
| `position_id` | uuid FK → `restaurant_positions` | **new** — which role they applied to |

`answers` (jsonb) stays, but is now keyed by `position_screening_questions.id`, so each
answer maps cleanly to its question.

#### `interviews`
| Column | Type | Notes |
|---|---|---|
| `position_id` | uuid FK → `restaurant_positions` | **new, optional** — which role the interview is for |

#### `restaurants`
The `position_types`, `position_salaries`, `position_counts`, `position_requirements`,
and `screening_questions` columns become **legacy** — migrate their data into the new
tables, then drop them. `shifts` / `mandatory_shifts` can stay as a restaurant-wide
default or also be retired in favor of per-position shifts.

---

## Entity Relationship Diagram

```
  ┌─────────────────────┐         ┌──────────────────────────────┐
  │  position_templates │         │ screening_question_templates │
  │     (system)        │1───────<│          (system)            │
  └─────────┬───────────┘         └──────────────┬───────────────┘
            │ enable & copy                       │ copy
            │                                     │
            ▼                                     ▼
  ┌─────────────────────┐         ┌──────────────────────────────┐
  │ restaurant_positions│1───────<│ position_screening_questions │
  └─────────┬───────────┘         └──────────────────────────────┘
            │ belongs to
            ▼
       ┌──────────┐
       │restaurants│
       └──────────┘
            ▲
            │ position_id
  ┌─────────┴────────┐
  │   applications   │──< (answers keyed by question id)
  └─────────┬────────┘
            │ position_id
       ┌────┴─────┐
       │interviews│
       └──────────┘
```

---

## Worked Example

**"Benedict" enables Waiter + Bartender, and adds a custom "Sushi Chef" role:**

`restaurant_positions`
| id | template | name | rate | open | shifts |
|---|---|---|---|---|---|
| p1 | waiter | מלצר/ית | 45 | 3 | morning, evening |
| p2 | bartender | ברמן/ית | 50 | 1 | evening, night |
| p3 | *(custom)* | סושימן | 65 | 1 | noon, evening |

`position_screening_questions`
| position | from template? | question | type | enabled |
|---|---|---|---|---|
| p1 | ✅ waiter Q1 | ניסיון קודם במלצרות? | boolean | ✅ |
| p1 | ❌ custom | זמינות לסופ"ש? | boolean | ✅ |
| p2 | ✅ bartender Q1 | ידע בקוקטיילים? | scale | ✅ |
| p2 | ✅ bartender Q2 | תעודת הגשת אלכוהול? | boolean | ❌ (toggled off) |
| p3 | ❌ custom | שנות ניסיון בסושי? | scale | ✅ |

Clean, queryable, and every position is fully independent.

---

## Why This Design

- **Simple mental model** — catalog vs. instance, applied consistently to positions and questions.
- **Everything a restaurant sees is a row it owns** — no template-merging at read time.
- **Each position is fully independent** — its own pay, shifts, requirements, questions.
- **Applications map to a real position and real questions** — matching gets much cleaner.
- **Extensible without rework** — custom positions and custom questions are just rows
  with a `NULL` template link; per-shift detail is one junction table away if ever needed.
