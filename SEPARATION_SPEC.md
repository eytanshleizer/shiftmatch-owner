# Registration ↔ Onboarding Separation
**מפרט: הפרדה בין הרשמה לבין הגדרת המסעדה + ולידציה של זהות**

> מסמך זה מתאר את דרישות יותם מ-26.5.2026 וכיצד להטמיע אותן באפליקציית
> ShiftMatch הקיימת. המסמך משלים את `SPECS.md` הראשי ואינו מחליף אותו.

---

## 1. מה צריך להשתנות?

### 1.1 המצב הנוכחי
1. משתמש לוחץ "צור חשבון מסעדה" → ממלא שם פרטי + שם מסעדה + אמייל + סיסמה.
2. AuthScreen יוצר רשומה ב-`auth.users` + שורה ב-`profiles`.
3. App.jsx מזהה שאין רשומת `restaurants` עם `owner_id = uid` → מציג מיד את
   `WizardOnboarding` שבו המשתמש מגדיר סוג מסעדה, עיר, תפקידים, שכר וכו׳.
4. בסיום ה-wizard נוצרת רשומת `restaurants`.
5. רק אחר כך המשתמש רואה את ה-Dashboard.

**הבעיות:**
- שני התהליכים תקועים יחד — אם המשתמש סוגר את ה-wizard, הוא מאבד מקום.
- אין אימות שהמסעדה אמיתית — כל אחד יכול להירשם בשם של מסעדה קיימת.
- אין בדיקה של שמות כפולים — שתי "מסה" אפשריות עכשיו.
- אין דרך לגשת לפרופיל ולמחוק חשבון לפני שיש לך מסעדה.

### 1.2 המצב הרצוי
1. **הרשמה (Sign Up)** = יוצרת רק את ה-user.
   - שדות: שם מלא · אמייל · סיסמה · **שם מסעדה מוצע**.
   - בהרשמה נבדק שהמסעדה (לפי שם + עיר/כתובת אם זמין) **אמיתית** ושאינה תפוסה.
2. **Landing באפליקציה** מיד אחרי הרשמה — אם אין `restaurants` משויכת:
   - **Empty State** עם CTA אחד גדול: *"בואו נגדיר את המסעדה שלך"*.
   - המשתמש יכול לגשת לפרופיל, לשנות סיסמה, **למחוק חשבון**, להתנתק.
3. **Onboarding** = תהליך נפרד (`WizardOnboarding`) — מתחיל מה-CTA, ניתן לסגירה
   בכל שלב. סגירה ⇒ חזרה ל-Empty State (בלי לאבד מה שכבר נכתב — שמירה ב-localStorage).
4. **מניעת שמות כפולים** — אין שתי מסעדות עם אותו `name + city`.
5. **אנטי-פייק** — מנגנון אימות שמרבד את האפשרות לפתוח 50 חשבונות מזויפים.

---

## 2. דרישות מפורטות (מתורגמות מהוואטסאפ)

| # | דרישה | סטטוס נוכחי | פעולה |
|---|---|---|---|
| 2.1 | לבדוק שהמסעדה אמיתית | ❌ | חיפוש Google Places / yad2 / rest.co.il לפני יצירת החשבון |
| 2.2 | להפריד הרשמה מ-onboarding | ⚠️ חלקי | פצל ל-2 מסכים נפרדים עם state נפרד |
| 2.3 | בהרשמה לבקש סיסמה + שם מסעדה | ✅ קיים | להוסיף **עיר** + בדיקת קיום |
| 2.4 | אחרי לחיצת "המשך" — לבדוק קיום ולבצע הרשמה | ❌ | API חדש: `POST /api/verify-restaurant` |
| 2.5 | אחרי הרשמה — להגיע ל-Empty State אם אין מסעדה | ❌ | חדש: `EmptyState.jsx` |
| 2.6 | מ-Empty State אפשר להפעיל את ה-onboarding | ❌ | כפתור גדול → mount `WizardOnboarding` |
| 2.7 | סגירת ה-wizard — חזרה ל-Empty State, לא לדף נחיתה | ❌ | wire-up ב-App.jsx |
| 2.8 | גישה לפרופיל גם ב-Empty State | ❌ | תפריט פרופיל פשוט (מחיקת חשבון, סיסמה) |
| 2.9 | שלא ייפתחו שתי מסעדות באותו שם | ❌ | UNIQUE קונסטרינט DB + בדיקה ב-API |
| 2.10 | מניעת התחברות וזיוף | ❌ | אימות אמייל חובה + reCAPTCHA + rate limit |

---

## 3. תכנון טכני — שינויים בקוד

### 3.1 שינויי DB (Supabase)

```sql
-- 3.1.1 שמות מסעדה ייחודיים לפי שם + עיר
-- (LOWER כדי שלא תהיה רגישות לאותיות גדולות/קטנות בעברית/אנגלית)
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_unique_name_city_idx
  ON restaurants (LOWER(name), LOWER(city))
  WHERE active = true AND owner_id IS NOT NULL;

-- 3.1.2 מטה-דאטה לאימות
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_source TEXT,        -- "google_places" / "manual" / "rest_co_il"
  ADD COLUMN IF NOT EXISTS google_place_id     TEXT,
  ADD COLUMN IF NOT EXISTS suggested_at_signup BOOLEAN DEFAULT FALSE;

-- 3.1.3 שדה הצעת מסעדה ב-profiles (לפני שהמסעדה עצמה קיימת)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS suggested_restaurant_name TEXT,
  ADD COLUMN IF NOT EXISTS suggested_city            TEXT,
  ADD COLUMN IF NOT EXISTS deletion_requested_at     TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
```

### 3.2 Edge Function חדש: `/api/verify-restaurant`

תפקיד: לקבל `{ name, city }` ולהחזיר:
```json
{
  "exists_on_web":      true,            // נמצא ב-Google Places / מאגר ציבורי
  "verification_source": "google_places",
  "google_place_id":    "ChIJ...",
  "already_taken":      false,           // יש כבר owner_id למסעדה הזו
  "address":            "הארבעה 19, תל אביב",
  "lat": 32.07, "lng": 34.78
}
```

**אסטרטגיה:**
1. שאילתה ל-Google Places API: `findplacefromtext` עם `${name} ${city} restaurant`.
2. אם נמצא — מחזירים `exists_on_web: true` + `google_place_id`.
3. שאילתה ל-DB: `SELECT 1 FROM restaurants WHERE google_place_id = ? AND owner_id IS NOT NULL` →
   אם קיים, `already_taken: true`.
4. fallback אם אין מפתח Google: רק בדיקת DB.

### 3.3 שינויי UI

#### 3.3.1 AuthScreen (הרשמה)
- הוספת **שדה עיר** (חובה ל-signup).
- כפתור "המשך" → קודם קורא ל-`/api/verify-restaurant`:
  - אם `already_taken` → הצגת הודעה: *"מסעדה בשם זה כבר רשומה. אם זו המסעדה
    שלך — נא לפנות לתמיכה."*
  - אם `exists_on_web === false` → הצגת מסך אישור: *"לא הצלחנו לאתר את
    המסעדה הזו ברשת. האם להמשיך?"* (allow override עם לוג).
  - אחרת — `supabase.auth.signUp(...)` + שמירת `suggested_restaurant_name` +
    `suggested_city` ב-`profiles`.

#### 3.3.2 חדש: `EmptyState.jsx`
מסך נחיתה למשתמש שיש לו חשבון אבל אין מסעדה משויכת.

```jsx
<EmptyState user={user} onStart={() => setOnboardingOpen(true)} onSignOut={...} />
```

- כותרת גדולה: *"בואו נגדיר את המסעדה שלך"*
- אם יש `suggested_restaurant_name` → *"רוצים להמשיך עם '${name}'?"*
- כפתור CTA שחור גדול: *"התחל הגדרה"*
- מתחת — *תפריט פרופיל*:
  - שינוי סיסמה
  - מחיקת חשבון (אישור double-confirm)
  - התנתקות

#### 3.3.3 `App.jsx` — לוגיקת ניתוב מעודכנת
```js
if (!session)                        → AuthScreen
if (invitation)                      → InvitationScreen        // ללא שינוי
if (membership && !approved)         → PendingApprovalScreen   // ללא שינוי
if (membership && approved)          → Dashboard               // ללא שינוי
if (!restaurant && !onboardingOpen)  → EmptyState              // ← חדש
if (!restaurant && onboardingOpen)   → WizardOnboarding        // אופציה: סגירה → setOnboardingOpen(false)
```

#### 3.3.4 `WizardOnboarding` — הוספת "X" סגירה
- כפתור X בפינה ימינה למעלה → `onClose()` → חוזרים ל-EmptyState.
- שמירת state ב-`localStorage` תחת `wizard_draft_<user_id>` כדי שלא יאבד.
- בכניסה הבאה — אם יש draft → הצעה "להמשיך מאיפה שעצרת?"

### 3.4 מניעת התחברויות פייק

| מנגנון | יישום |
|---|---|
| **אימות אמייל חובה** | להפעיל ב-Supabase Dashboard → Auth → email confirmation = ON |
| **reCAPTCHA v3** | להוסיף ל-AuthScreen את `react-google-recaptcha-v3`; שולחים את הציון ל-edge function שדוחה אם score < 0.5 |
| **Rate limit** | Supabase מגביל כברירת מחדל; אם צריך — להוסיף `pg_net` / Cloudflare WAF |
| **שדה SMS verification** | אופציונלי בעתיד — `auth.users.phone` + Twilio |

### 3.5 מחיקת חשבון
מסך ב-EmptyState או בפרופיל:
```sql
-- DELETE_USER RPC (security definer)
CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
```
ב-UI כפתור אדום עם double-confirm: *"זה ימחק את החשבון לתמיד. להמשיך?"*

---

## 4. תהליך הטמעה — שלב אחר שלב

### Phase A — DB & API (חצי יום)
1. הוסף מיגרציה (3.1) — `restaurants_unique_name_city_idx` + עמודות verified.
2. בנה edge function `/api/verify-restaurant` (3.2).
3. הוסף RPC `delete_my_account` (3.5).
4. הפעל email confirmation ב-Supabase Auth.

### Phase B — Refactor הרשמה (יום)
1. עדכן `AuthScreen.jsx`:
   - שדה עיר חדש.
   - הוסף קריאה ל-`/api/verify-restaurant` בלחיצת המשך.
   - הצגת `already_taken` / `not_found` עם UX מתאים.
2. עדכן `profiles.upsert` ב-AuthScreen: לשמור `suggested_restaurant_name + suggested_city`.

### Phase C — Empty State + Wizard Decoupling (יום)
1. בנה `EmptyState.jsx`.
2. עדכן `App.jsx` עם הלוגיקה החדשה (3.3.3).
3. הוסף X סגירה ל-`WizardOnboarding` + localStorage draft.
4. בנה מסך פרופיל מינימלי במצב Empty (מחיקה, סיסמה).

### Phase D — Anti-fake (חצי יום)
1. הוסף `react-google-recaptcha-v3`.
2. כתוב edge function שמתעדף את ה-recaptcha token.
3. (אופציונלי) הוסף SMS verification ל-Settings.

### Phase E — Testing
1. ניסיון להירשם פעמיים עם אותו שם מסעדה + עיר ⇒ צריך להיכשל באלגנטיות.
2. ניסיון להירשם עם שם מסעדה מומצא ⇒ צריך להציג fallback.
3. הרשמה ⇒ סגירת wizard ⇒ פתיחה חדשה ⇒ בדיקה ש-draft נטען.
4. הרשמה ⇒ מחיקת חשבון ⇒ הרשמה מחדש ⇒ צריך לעבוד נקי.

---

## 5. דברים שלא להכניס עכשיו (Out of Scope)

- אינטגרציית CRM חיצונית
- אישור בעל המסעדה מול הרשות המקומית
- KYC עסקי (העלאת תעודת זהות / רשם החברות)
- Multi-restaurant ownership (משתמש שמחזיק כמה מסעדות בו זמנית)

---

## 6. שאלות פתוחות שכדאי לחזור לדבר עליהן

1. **Google Places API key** — האם יש לנו אחד? אם לא, נצטרך לפתוח חשבון
   (יש 200$ קרדיט חודשי חינם — מספיק לאלפי בדיקות).
2. **רשימת מסעדות "סלילי"** — האם נרצה לאמת מול mishlohim / rest.co.il
   במקביל? יכול להגדיל דיוק.
3. **מה קורה אם משתמש מנסה להירשם בשם מסעדה שלא קיימת ברשת אבל אמיתית
   (חדשה לגמרי)?** — צריך flow ידני: "אנא שלח/י תמונה של שלט המסעדה".
4. **תוקף ה-suggested_restaurant_name** — האם להציג אותו כברירת מחדל
   ב-wizard, או רק כהצעה? המלצה: ברירת מחדל עם אפשרות לשינוי.

---

*עודכן: 2026-05-26 · יוצר: באישור יותם, מסמך מלווה ל-SPECS.md.*
