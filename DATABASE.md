# ShiftMatch — Database Structure

> Supabase (PostgreSQL) · Project ID: `huwcyedlbcrugpbdcsdo`

---

## Tables Overview

| Table | Purpose |
|---|---|
| `restaurants` | Every restaurant on the platform |
| `profiles` | One profile per user (owners, staff, candidates) |
| `restaurant_members` | Team members per restaurant + their roles |
| `applications` | Candidate applications to restaurants |
| `interviews` | Scheduled interviews |
| `restaurant_events` | Analytics events (views, WhatsApp taps, calls) |
| `restaurant_invitations` | Email invitations to join a team |
| `saved_restaurants` | Restaurants saved by candidates |

---

## Table Details

### `restaurants`
The main table. One row per restaurant.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `owner_id` | uuid | → auth.users |
| `name` | text | Restaurant name |
| `type` | text | e.g. סושי, איטלקי, בר |
| `city` | text | |
| `area` | text | Neighbourhood |
| `address` | text | |
| `lat` / `lng` | float | Coordinates |
| `phone` | text | Owner contact |
| `recruitment_whatsapp` | text | WhatsApp number for candidates |
| `contact_name` | text | |
| `hourly_rate` | integer | Default hourly rate |
| `shifts` | text[] | Available shifts |
| `mandatory_shifts` | text[] | Required shifts |
| `shift_commitment_min/max` | integer | Shifts per week range |
| `position_types` | text[] | Roles being hired for |
| `position_open` | jsonb | `{ "מלצר": true, ... }` |
| `position_salaries` | jsonb | `{ "מלצר": 44, ... }` |
| `position_counts` | jsonb | `{ "מלצר": 2, ... }` |
| `position_requirements` | jsonb | Requirements per role |
| `screening_questions` | jsonb | Custom questionnaire array |
| `attributes` | jsonb | Restaurant features |
| `soft_attributes` | text[] | Culture/vibe tags |
| `images` | text[] | Photo URLs |
| `image_url` | text | Primary photo |
| `active` | boolean | Listing is live |
| `urgent` | boolean | Promoted listing |
| `urgent_price` | integer | |
| `urgent_until` | timestamptz | |
| `rating` | numeric | Default 4.5 |
| `verified_at` | timestamptz | |
| `google_place_id` | text | |
| `created_at` | timestamptz | |

---

### `profiles`
One row per user. Covers both candidates and restaurant staff.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = auth.uid() |
| `name` | text NOT NULL | |
| `email` | text | Synced from auth |
| `phone` | text | |
| `role` | text NOT NULL | `restaurant` or `candidate` |
| `city` | text | |
| `shifts` | text[] | Preferred shifts |
| `experience` | text | e.g. מתחיל, מנוסה |
| `languages` | text[] | |
| `position_types` | text[] | Roles candidate wants |
| `min_hourly_rate` | integer | |
| `max_distance` | integer | km |
| `onboarded` | boolean | Completed signup wizard |
| `suggested_restaurant_name` | text | Typed during wizard |
| `suggested_city` | text | |
| `deletion_requested_at` | timestamptz | Account deletion request |
| `created_at` | timestamptz | |

---

### `restaurant_members`
Who is on each restaurant's team, and at what permission level.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid | → restaurants |
| `user_id` | uuid | → auth.users |
| `role` | text | `owner` / `admin` / `manager` / `recruiter` / `viewer` |
| `status` | text | `pending` / `approved` |
| `invited_by` | uuid | Who sent the invite |
| `approved_by` | uuid | Who approved |
| `approved_at` | timestamptz | |
| `created_at` | timestamptz | |

**Role permissions:**

| Role | Can do |
|---|---|
| `owner` | Everything — including adding/removing accounts |
| `admin` | Add team, edit all details, manage jobs |
| `manager` | Edit jobs, WhatsApp, view & contact candidates |
| `recruiter` | Schedule interviews, view candidates |
| `viewer` | View candidates only |

---

### `applications`
A candidate applied to a restaurant.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Candidate → auth.users |
| `restaurant_id` | uuid | → restaurants |
| `status` | text | `new` / `viewed` / `shortlisted` / `rejected` |
| `answers` | jsonb | Answers to screening questions |
| `match_score` | integer | Algorithm match % |
| `created_at` | timestamptz | |

---

### `interviews`
A scheduled interview between a restaurant and a candidate.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid | → restaurants |
| `application_id` | uuid | → applications |
| `candidate_user_id` | uuid | → auth.users |
| `candidate_name` | text | |
| `candidate_phone` | text | |
| `scheduled_at` | timestamptz | |
| `duration_min` | integer | Default 30 |
| `location` | text | |
| `notes` | text | |
| `status` | text | `scheduled` / `completed` / `cancelled` |
| `created_by` | uuid | Staff member who booked it |
| `created_at` | timestamptz | |

---

### `restaurant_events`
Analytics. One row per user interaction.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid | → restaurants |
| `user_id` | uuid | Who triggered it |
| `event_type` | text | e.g. `view`, `whatsapp`, `call`, `apply` |
| `source` | text | Where it came from |
| `created_at` | timestamptz | |

---

### `restaurant_invitations`
Email invitations sent to people to join a restaurant team.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid | → restaurants |
| `email` | text | Invitee's email |
| `role` | text | Role they'll get on acceptance |
| `invited_by` | uuid | → auth.users |
| `accepted_at` | timestamptz | null = not yet accepted |
| `created_at` | timestamptz | |

---

### `saved_restaurants`
Restaurants a candidate bookmarked.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | → auth.users |
| `restaurant_id` | integer | (legacy — not UUID) |
| `created_at` | timestamptz | |

---

## Entity Relationships

```
auth.users
    │
    ├──► profiles                (1:1 — created on signup via trigger)
    │
    ├──► restaurants             (owner_id — one owner per restaurant)
    │         │
    │         ├──► restaurant_members      (team — many users per restaurant)
    │         ├──► applications            (candidates who applied)
    │         │         └──► interviews    (scheduled from applications)
    │         ├──► restaurant_events       (analytics per restaurant)
    │         └──► restaurant_invitations  (pending email invites)
    │
    └──► applications            (candidate side — what they applied to)
```

---

## Server-Side Functions (all SECURITY DEFINER)

These run as admin and bypass RLS — used for operations that require elevated access.

| Function | Returns | Purpose |
|---|---|---|
| `get_team_members(p_restaurant_id)` | table | Fetch all approved team members with profile info |
| `create_team_member(email, password, name, restaurant_id, role, requester_id)` | json | Create auth account + profile + member row atomically |
| `remove_team_member(member_id, requester_id)` | json | Remove member and delete their auth account |
| `is_restaurant_member(restaurant_uuid)` | boolean | Is current user an approved member of this restaurant? |
| `is_restaurant_owner(restaurant_uuid)` | boolean | Is current user the owner of this restaurant? |
| `delete_my_account()` | void | User deletes their own account |
| `handle_new_user()` | trigger | Creates profile row on auth.users insert |
| `add_owner_to_members()` | trigger | Adds owner row to restaurant_members when restaurant is created |
| `sync_profile_email()` | trigger | Keeps profiles.email in sync with auth.users.email |

---

## Row Level Security (RLS)

RLS is enabled on all tables. Key policies on `restaurant_members`:

| Operation | Policy |
|---|---|
| SELECT | `user_id = auth.uid()` — users see only their own row |
| INSERT | `user_id = auth.uid()` — users can only add themselves |
| UPDATE | `is_restaurant_owner(restaurant_id)` AND not updating owner row |
| DELETE | `is_restaurant_owner(restaurant_id)` AND not deleting owner row |

> The full team list is only accessible via `get_team_members()` (SECURITY DEFINER), which bypasses RLS safely.
