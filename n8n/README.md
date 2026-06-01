# Smart Candidate Feed — n8n Workflow

This workflow is the AI matching agent from `AI_MATCHING_AGENT.md`, built for n8n.
When a candidate applies, it scores them against the position's requirements, asks
Claude to write a short Hebrew intro, and inserts a card into the `match_messages`
table that the restaurant's page reads.

```
Webhook → Fetch context (Postgres) → Compute match (Code) → Gate (≥70?)
        → Claude summary (HTTP) → Build message (Code) → Insert match_message (Postgres)
```

The `match_messages` table already exists in the database (created via migration).

---

## 1. Import the workflow

In n8n: **Workflows → Import from File →** select
`smart-candidate-feed.workflow.json`.

Two credentials show as "not found" after import — set them up below, then re-select
them on the highlighted nodes.

---

## 2. Create the two credentials

### a) Supabase Postgres  (used by "Fetch context" and "Insert match_message")
- **Type:** Postgres
- Get the connection details from **Supabase → Project Settings → Database →
  Connection info** (use the **Session/Direct** connection, not the pooler, or the
  pooler on port 6543 — either works).
  - Host: `db.huwcyedlbcrugpbdcsdo.supabase.co`
  - Database: `postgres`
  - User: `postgres`
  - Port: `5432`
  - SSL: **Require**
- **You** enter the database password in n8n — I never handle it.

> The Postgres connection runs as the `postgres` role, which bypasses RLS, so the
> agent can insert into `match_messages` for any restaurant.

### b) Anthropic x-api-key  (used by "Claude · write summary")
- **Type:** Header Auth (HTTP Header Auth)
- **Name:** `x-api-key`
- **Value:** your Anthropic API key
- Again — **you** paste the key into the n8n credential. It is never stored in this
  repo, the workflow JSON, or the database.

---

## 3. Point Supabase at the webhook

Copy the **Production URL** from the Webhook node (looks like
`https://<your-n8n>/webhook/new-application`). Then in Supabase:

**Database → Webhooks → Create a new hook**
- Table: `applications`
- Events: **Insert**
- Type: **HTTP Request**, method **POST**
- URL: the n8n webhook URL
- (no extra headers needed)

Supabase sends `{ type, table, record, old_record }`; the workflow reads
`record.id` (the new application's id) and looks everything else up itself.

> While testing you can keep the workflow in **manual** mode and use the Webhook
> node's "Listen for test event", then insert a row into `applications`. Flip the
> workflow to **Active** to go live.

---

## 4. What each node does

| Node | Role |
|---|---|
| **Webhook · new application** | Receives the Supabase insert event |
| **Fetch context** | One SQL query: application + candidate profile + position (requirements, pay, shifts) + enabled screening questions |
| **Compute match** | Deterministic score (0–100) + `met/req` counts + highlight bullets, from the per-position requirements |
| **Gate · score ≥ 70** | Only strong matches continue; weak ones hit "skip" and stop |
| **Claude · write summary** | Sends the structured facts to Claude for a warm 2–3 sentence Hebrew intro. Set to *continue on error* |
| **Build message** | Merges score + summary; if Claude failed, builds a deterministic fallback sentence |
| **Insert match_message** | Writes the card into `match_messages` (status `new`) |

---

## 5. Tuning

- **Threshold:** edit the `Gate` node (default `70`).
- **Model:** edit `model` in the "Claude · write summary" node's JSON body
  (`claude-3-5-haiku-latest` is fast & cheap; swap for a larger model for nicer prose).
- **Scoring rules:** all in the "Compute match" Code node — experience, shifts/week,
  weekends, wage fit, and position interest. Add dimensions there as needed.

---

## 6. The "קבע ראיון" button

That button lives in the **app** (not n8n). It reads `match_messages`, and on tap
inserts an `interviews` row and flips the message `status` to `scheduled`. Building
that UI is a separate front-end task.
