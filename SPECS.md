# ShiftMatch — Restaurant Owner App Specs
**מפרט מלא · אפליקציית בעלי המסעדה**

> Two-sided marketplace for Israeli restaurant recruitment. This document covers the **restaurant-owner side only**.
> The waiter side lives in a separate app sharing the same Supabase backend.

---

## 1. אימות והרשמה (Authentication)

### 1.1 הרשמה (Sign Up)
- אמייל + סיסמה בלבד (אין SSO בשלב הזה)
- בעת ההרשמה — היוזר יוצר **חשבון מסעדה** (Restaurant Account), לא חשבון אישי
- שדות חובה:
  - שם מלא (של היוזר הראשון)
  - אמייל
  - סיסמה (מינ׳ 8 תווים)
  - שם המסעדה
- היוזר שיוצר את חשבון המסעדה הופך אוטומטית ל-**Owner / Admin** של המסעדה

### 1.2 התחברות (Sign In)
- אמייל + סיסמה
- "שכחתי סיסמה" → אימייל reset דרך Supabase Auth
- שמירת sessions ב-localStorage (auto-login)

### 1.3 אישור משתמשים חדשים (First-time Approval)
- כשמשתמש חדש (לא Owner) מתחבר בפעם הראשונה לחשבון מסעדה קיים — הוא נכנס למצב **"ממתין לאישור"**
- הוא רואה מסך נעול עם הודעה: *"בקשתך נשלחה למנהל המסעדה. תקבל הודעה כשתאושר."*
- ה-Admin/Owner מקבל התראה ויכול:
  - לאשר את היוזר → בחירת תפקיד (Manager / Recruiter / Viewer)
  - לדחות → היוזר מקבל הודעה
- רק לאחר אישור — היוזר נכנס לדשבורד המלא

---

## 2. ניהול חשבון מסעדה רב-משתמשים (Multi-user Restaurant Account)

### 2.1 מודל היררכי
```
Restaurant Account
├── Owner (1)          ← יוצר החשבון, לא ניתן להסרה
├── Admin (0..n)       ← הרשאות מלאות חוץ ממחיקת חשבון
├── Manager (0..n)     ← פרסום משרות, ניהול מועמדים
├── Recruiter (0..n)   ← רק צפייה+פנייה למועמדים
└── Viewer (0..n)      ← קריאה בלבד
```

### 2.2 הרשאות לפי תפקיד

| פעולה                         | Owner | Admin | Manager | Recruiter | Viewer |
|------------------------------|:-----:|:-----:|:-------:|:---------:|:------:|
| הזמנת משתמשים                  | ✅    | ✅    | ❌      | ❌        | ❌     |
| אישור משתמשים ממתינים         | ✅    | ✅    | ❌      | ❌        | ❌     |
| הסרת משתמשים (Kick)           | ✅    | ✅*   | ❌      | ❌        | ❌     |
| שינוי תפקידים                  | ✅    | ✅*   | ❌      | ❌        | ❌     |
| יצירת/עריכת/סגירת משרה        | ✅    | ✅    | ✅      | ❌        | ❌     |
| הגדרת טלפון לגיוס              | ✅    | ✅    | ✅      | ❌        | ❌     |
| צפייה במועמדים                 | ✅    | ✅    | ✅      | ✅        | ✅     |
| יצירת קשר עם מועמד             | ✅    | ✅    | ✅      | ✅        | ❌     |
| עריכת שאלוני סינון             | ✅    | ✅    | ✅      | ❌        | ❌     |
| מחיקת חשבון מסעדה              | ✅    | ❌    | ❌      | ❌        | ❌     |

*Admin לא יכול להסיר/לשנות את ה-Owner

### 2.3 הזמנת משתמשים חדשים
- Owner/Admin → דף "צוות" → "הזמן משתמש"
- מזין אמייל + תפקיד מוצע
- נשלח אימייל עם קישור הצטרפות (token + restaurant_id)
- היוזר נרשם → מצב "ממתין לאישור" → Owner/Admin מאשר → תפקיד מוקצה

### 2.4 Kick / הסרת משתמש
- Owner/Admin → דף "צוות" → לחיצה על שלוש נקודות ליד יוזר → "הסר מהמסעדה"
- היוזר מאבד גישה מיידית
- מקבל אימייל: *"גישתך לחשבון [שם מסעדה] בוטלה"*
- ה-`user_id` נשאר ב-DB (לצורך היסטוריית audit) אבל ה-`restaurant_user` row נמחק

---

## 3. ניהול משרות פתוחות (Job Postings)

### 3.1 יצירת משרה
לאחר הכניסה לדשבורד → "פרסם משרה חדשה"
שדות:
- **תפקיד (חובה):** בחירה מתוך רשימה — *מלצר/ית · ברמן/ית · מארח/ת · רץ/ה · טבח/ית · עוזר/ת מטבח · שוטף/ת כלים · מנהל/ת משמרת · בריסטה*
- **כמות משרות פתוחות** (1–20)
- **שכר לשעה** (אופציונלי, או טווח)
- **משמרות מועדפות:** בוקר / צהריים / ערב / לילה / סופ"ש (multi-select)
- **דרישות:** ניסיון מינימלי, גיל מינימלי, רישוי (לברמנים), עברית/אנגלית
- **הטבות:** טיפים · ארוחת עובד · נסיעות · חנייה · בונוסים · קידום פנימי · ביגוד
- **תיאור חופשי**
- **דחוף?** (תשלום נוסף ₪29 — מציג את המשרה בראש החיפושים עם תגית 🔥)

### 3.2 סגירת משרה
- כל משרה בדשבורד הראשי יש בה toggle **"פתוחה / סגורה"**
- סגירה → המשרה נעלמת מחיפושים אצל המלצרים, אבל היסטוריית הפניות נשמרת
- ניתן לפתוח מחדש בכל רגע
- אם נסגרת אוטומטית (אחרי 60 יום ללא activity) — המערכת שולחת מייל: *"המשרה שלך סגורה. רוצה לפתוח שוב?"*

### 3.3 עריכה
- כל שדה ניתן לעריכה בכל רגע
- שינויים בשכר/דרישות → מסומנים ל-"עודכן" ומלצרים שכבר הגישו מועמדות מקבלים התראה

---

## 4. טלפון/וואטסאפ לגיוס (Recruitment Contact)

### 4.1 הגדרה ראשונית
- בעת onboarding ראשוני (chat AI) — בעל המסעדה מזין מספר וואטסאפ ייעודי לגיוס
- שדה DB: `restaurants.recruitment_whatsapp`
- ניתן להגדיר טלפון שונה לכל משרה (אופציונלי) או לכל המסעדה

### 4.2 שימוש בטלפון
- כשמלצר לוחץ "💬 צור קשר בוואטסאפ" — נפתח wa.me/972XXXXX עם הודעה מובנית מראש
- המספר מוצג רק לאחר שהמלצר מילא פרופיל מלא (anti-spam)
- כל לחיצה נרשמת ב-`restaurant_events` (event_type: `whatsapp`)

### 4.3 שינוי טלפון
- Owner/Admin/Manager → הגדרות → "טלפון לגיוס"
- שינוי מיידי, אין דרישת אימות SMS (בשלב זה)

---

## 5. שאלוני סינון (Screening Questionnaires)

### 5.1 ספריית שאלות מובנות מראש
המערכת מספקת **מאגר** של שאלות סטנדרטיות לכל תפקיד. דוגמאות:

#### מלצר/ית
- ☐ כמה שנות ניסיון יש לך כמלצר/ית?
- ☐ האם עבדת במסעדה דומה (יוקרתית / שף / מהירה / קזואל)?
- ☐ באילו ימים/שעות זמין/ה?
- ☐ האם יש לך תעודת בריאות בתוקף?
- ☐ עברית ברמת שפת אם? אנגלית?
- ☐ ניסיון עם מערכות POS (Tabit / Restigo / Bynet)?
- ☐ עובד/ת היום במקום אחר?

#### ברמן/ית
- ☐ ניסיון מאחורי הבר (שנים)
- ☐ יודע/ת להכין קוקטיילים קלאסיים?
- ☐ יש קורס ברמנים?
- ☐ עבודה תחת לחץ — דוגמה
- ☐ זמינות לסופ"שים ולילות

#### טבח/ית
- ☐ ניסיון במטבח (שנים + סוג מטבח)
- ☐ תחנות עבודה — סלטים / חמים / קר / פטיסרי
- ☐ תעודת בריאות
- ☐ עברית / רוסית / ערבית / אחר

(וכו׳ לכל תפקיד)

### 5.2 שאלון מותאם אישית (Custom)
- בעל מסעדה יכול:
  - לבחור שאלות מהמאגר (checkbox interface)
  - להוסיף שאלות משלו (טקסט חופשי / רב-ברירה / כן-לא / מספרי)
  - לסדר את הסדר (drag & drop)
  - לסמן שאלות כ-"חובה" או "אופציונלי"
- שמירה ברמת **משרה** או ברמת **תבנית** (template)
- ניתן להעתיק שאלון בין משרות

### 5.3 פורמט שאלה
```json
{
  "id": "uuid",
  "type": "select | text | number | boolean | multiselect",
  "label": "כמה שנות ניסיון יש לך?",
  "required": true,
  "options": ["0", "1-2", "3-5", "5+"],   // לסוגי select/multiselect
  "min": 0, "max": 50,                     // לסוג number
  "source": "library | custom",            // האם מתוך המאגר או custom
  "library_key": "experience_years"        // אם מתוך המאגר
}
```

### 5.4 תצוגת תשובות אצל בעל המסעדה
- בדשבורד הפניות (Applications) — לחיצה על מועמד פותחת צד עם:
  - פרופיל בסיסי (שם, גיל, עיר, ניסיון)
  - **התשובות לשאלון** — מסומנות 🟢 ירוק אם תואמות העדפה, 🔴 אדום אם לא
  - אינדיקציה ויזואלית של "התאמה כללית" (%)

---

## 6. תכונות מותאמות אישית של המסעדה (Restaurant Attributes)

### 6.1 בחירת מאפיינים
המסעדה בוחרת תגיות מתוך רשימה (multi-select):
- **סוג מטבח:** איטלקי · אסייתי · ישראלי · אמריקאי · ים תיכוני · שף · קזואל · מזון מהיר · ברסרי · פיצה · המבורגרים · סושי
- **אווירה:** יוקרתי · משפחתי · רומנטי · עסקי · ספורט-בר · פאב · מסעדת שף · בית קפה
- **שעות פעילות:** בוקר · צהריים · ערב · לילה · 24/7 · רק סופ"ש
- **כשרות:** כשר (רבנות) · כשר (בד"ץ) · לא כשר · טבעוני
- **גודל:** עד 30 מקומות · 30–80 · 80–150 · 150+
- **תכונות עובד:** טיפים · ביגוד · ארוחה · מונית · בונוסים · קידום

### 6.2 שימוש בתגיות
- ה-AI שמתאים מלצרים למסעדות מתבסס על תגיות אלה
- מלצרים יכולים לסנן לפי תגיות
- מוצגות בכרטיס המסעדה

### 6.3 מאפייני "סגנון עבודה" (Soft Attributes)
בעל המסעדה יכול לבחור (multi-select):
- ☐ מעדיף ניסיון רב
- ☐ מעדיף עובד יציב לטווח ארוך (מינ׳ 6 חודשים)
- ☐ פתוח גם למתחילים
- ☐ דורש עברית ברמת שפת אם
- ☐ דורש אנגלית עסקית
- ☐ מעדיף סטודנטים
- ☐ מעדיף עובד עם רכב

המאפיינים הללו נכנסים לאלגוריתם ההתאמה.

---

## 7. סכמת מסד נתונים (Database Schema)

### 7.1 טבלאות עיקריות
```sql
-- חשבונות מסעדה (כבר קיים, להרחיב)
restaurants (
  id uuid PK,
  name text,
  recruitment_whatsapp text,
  attributes jsonb,           -- סוג מטבח, אווירה וכו'
  soft_attributes jsonb,      -- העדפות עובד
  position_salaries jsonb,    -- כבר קיים
  owner_id uuid → auth.users,
  created_at timestamptz
);

-- חברים בחשבון המסעדה (חדש)
restaurant_members (
  id uuid PK,
  restaurant_id uuid → restaurants ON DELETE CASCADE,
  user_id uuid → auth.users ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','manager','recruiter','viewer')),
  status text CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  invited_by uuid → auth.users,
  approved_by uuid → auth.users,
  approved_at timestamptz,
  created_at timestamptz,
  UNIQUE(restaurant_id, user_id)
);

-- משרות פתוחות (חדש או הרחבת restaurants)
job_postings (
  id uuid PK,
  restaurant_id uuid → restaurants ON DELETE CASCADE,
  position_type text,
  open_positions int DEFAULT 1,
  hourly_rate numeric,
  shifts text[],
  requirements jsonb,
  benefits text[],
  description text,
  is_open boolean DEFAULT true,
  is_urgent boolean DEFAULT false,
  urgent_paid_at timestamptz,
  closed_at timestamptz,
  recruitment_whatsapp_override text,
  questionnaire_id uuid → questionnaires,
  created_by uuid → auth.users,
  created_at timestamptz
);

-- שאלוני סינון (חדש)
questionnaires (
  id uuid PK,
  restaurant_id uuid → restaurants ON DELETE CASCADE,
  name text,                  -- "ברמן ערב"
  questions jsonb,            -- [{id, type, label, required, options, ...}]
  is_template boolean DEFAULT false,
  created_by uuid → auth.users,
  created_at timestamptz
);

-- ספריית שאלות מערכת (read-only, seeded)
question_library (
  id uuid PK,
  position_type text,
  question_key text,
  default_question jsonb       -- {type, label, options, ...}
);

-- תשובות מועמדים (הרחבת applications)
applications (
  id uuid PK,
  user_id uuid → auth.users,
  restaurant_id uuid → restaurants,
  job_posting_id uuid → job_postings,
  status text,
  answers jsonb,               -- {question_id: answer}
  match_score int,             -- 0-100 מחושב
  created_at timestamptz
);
```

### 7.2 Row Level Security (RLS)
- `restaurant_members.SELECT` — רק חברים מאושרים של המסעדה
- `restaurants.UPDATE` — רק owner/admin/manager
- `restaurant_members.DELETE` — רק owner/admin (לא יכולים למחוק את עצמם)
- `job_postings.INSERT/UPDATE` — owner/admin/manager
- `applications.SELECT` — כל חברי המסעדה הרלוונטית

---

## 8. UX Flows

### 8.1 First-time Onboarding (Owner חדש)
1. דף נחיתה → "צרף את המסעדה שלך"
2. הזנת אמייל + סיסמה + שם פרטי
3. AI Chat onboarding:
   - שם המסעדה?
   - כתובת? (geocoding ל-lat/lng)
   - סוג מטבח / אווירה
   - טלפון וואטסאפ לגיוס
   - אילו תפקידים פתוחים?
   - שכר לכל תפקיד
   - תגיות / הטבות
4. כניסה לדשבורד

### 8.2 הזמנת איש צוות
1. דשבורד → "צוות" → "+ הזמן"
2. הזנת אמייל + בחירת תפקיד מוצע
3. נשלח אימייל → המוזמן נרשם
4. נכנס למצב "Pending"
5. Owner מקבל badge בצוות → "1 ממתין/ים לאישור"
6. אישור + בחירת תפקיד סופי → המוזמן מקבל גישה

### 8.3 פרסום משרה + שאלון
1. דשבורד → "+ משרה חדשה"
2. בחירת תפקיד → המערכת מציעה שאלון ברירת מחדל
3. עריכת שאלון (הוספה/הסרה/שינוי סדר/custom)
4. מילוי פרטי המשרה (שכר, משמרות, הטבות)
5. publish
6. המשרה זמינה למלצרים מיידית

### 8.4 ניהול מועמדים
1. דשבורד → "פניות"
2. רשימה מסודרת לפי תאריך + match_score
3. לחיצה על מועמד → פרופיל + תשובות לשאלון + לחצן וואטסאפ
4. סטטוס: חדש → נצפה → יצרתי קשר → דחיתי / קיבלתי
5. אנליטיקה בזמן אמת על העמוד הראשי

---

## 9. דשבורד אדמין-על (Super Admin)

קיים כבר ב-`/admin` (פנימי):
- כל המסעדות
- כל המלצרים
- כל הפניות
- אנליטיקה: views / clicks / WhatsApp
- ייצוא CSV
- אבחון תקלות במסד נתונים

---

## 10. סטטוס נוכחי ומה צריך לבנות

### ✅ כבר קיים
- אימות אמייל+סיסמה (Supabase Auth)
- מסעדה אחת לכל owner_id
- AI chat onboarding
- WhatsApp recruitment
- פרסום משרה בסיסי
- פניות + אנליטיקה
- דשבורד אדמין

### 🔨 צריך לבנות
1. **טבלת `restaurant_members`** + RLS policies
2. **דף "צוות"** — הזמנה, אישור, kick, שינוי תפקיד
3. **מסך "ממתין לאישור"** ליוזרים חדשים
4. **טבלת `job_postings`** נפרדת + הפרדה מ-`restaurants`
5. **toggle "פתוחה/סגורה"** למשרות
6. **טבלת `questionnaires`** + `question_library`
7. **עורך שאלון** (drag-drop, custom questions)
8. **תצוגת תשובות שאלון** בכרטיס מועמד
9. **חישוב `match_score`** אוטומטי
10. **תגיות מסעדה** (attributes / soft_attributes)
11. **רישום audit log** של פעולות admin

### עדיפויות פיתוח
1. ראשית: `restaurant_members` + צוות + אישורים — בלי זה אין רב-משתמשים
2. שנית: `job_postings` נפרד + toggle סגירה — להפרדה נקייה ממסעדה
3. שלישית: שאלונים — אופציה גדולה אבל יקרה לבנות
4. רביעית: תגיות + match_score

---

## 11. הערות טכניות

- **השפה הראשית של הממשק:** עברית (RTL)
- **תמיכה במובייל:** PWA — מתקין כאפליקציה
- **רספונסיביות:** mobile-first, מותאם לטאבלט
- **אנליטיקה:** כל פעולה משמעותית נרשמת ב-`restaurant_events`
- **התראות:** כרגע by-email בלבד; בעתיד push notifications

---

*עודכן: 2026-05-24*
