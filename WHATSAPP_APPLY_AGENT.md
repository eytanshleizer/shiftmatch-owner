# WhatsApp Apply Agent — אישור/דחייה מועמד דרך WhatsApp

> כשמלצר/ית מגיש/ה מועמדות למסעדה, סוכן n8n שולח את **אותו כרטיס** שמופיע באתר
> (פרטי המועמד + 🎯 התאמה לדרישות המשרה) ל‑WhatsApp של המסעדה, עם שני כפתורים:
> **✅ אישור** / **❌ דחייה**. רק אם המסעדה מאשרת — נשלחים אליה פרטי הקשר של
> המועמד, ובמקביל נשמר במסד הנתונים שהמועמד אושר (`status='accepted'`).
>
> זו בדיוק אותה לוגיקת gating שכבר בנינו ב‑`ApplicationsTab.jsx` — רק שעכשיו היא
> זמינה גם ב‑WhatsApp, בלי שהמסעדה תצטרך להיכנס לאתר.

---

## 1. מה המסעדה רואה ב‑WhatsApp (התוצאה הסופית)

**הודעה 1 — מיד כשמתקבלת מועמדות (Template מאושר):**

```
📩 מועמד/ת חדש/ה ל-"סטודיו תל אביב"

👤 ישראל ישראלי · תל אביב
💼 ניסיון: שנה+    💰 ציפיית שכר: ₪45/שעה

🎯 התאמה לדרישות המשרה — 75%
🟢 🎉 סופי שבוע — מוכן/ה
🔴 🌙 לילות — לא מוכן/ה
🟢 📅 חגים — מוכן/ה
🟢 🌅 בוקר מוקדם — מוכן/ה

פרטי ההתקשרות יחשפו רק לאחר אישור 👇

      [ ✅ אישור ]      [ ❌ דחייה ]
```

**הודעה 2 — רק אחרי לחיצה על ✅ (free-form, נפתח חלון 24 שעות):**

```
✅ אישרת את ישראל ישראלי!

📞 טלפון: 050-1234567
💬 WhatsApp: https://wa.me/972501234567

בהצלחה! הפנייה סומנה כ"אושר" במערכת.
```

**אחרי ❌:**

```
❌ דחית את המועמד/ת. הפרטים לא נחשפו והפנייה סומנה כ"נדחה".
```

> שימו לב: ההודעה הראשונה **לא מכילה טלפון**. זה אותו עיקרון של ה‑gating באתר —
> המידע נחשף רק אחרי החלטה אקטיבית.

---

## 2. ארכיטקטורה

```
[Waiter app] מגיש מועמדות
      │  INSERT לטבלת applications
      ▼
[Supabase Database Webhook]  (Insert על applications)
      │  POST { record: {id,...} }
      ▼
┌─────────────────── n8n — Workflow A (Outbound) ───────────────────┐
│ Webhook → Fetch context (Postgres) → Compute req-match (Code)      │
│         → Build WhatsApp template (Code) → Twilio: Send template   │
└────────────────────────────────────────────────────────────────────┘
      │  Twilio שולח ל-recruitment_whatsapp של המסעדה
      ▼
   📱 בעל המסעדה לוחץ ✅ / ❌
      │  Twilio inbound webhook (ButtonPayload = "accept:<app_id>")
      ▼
┌─────────────────── n8n — Workflow B (Inbound) ────────────────────┐
│ Webhook (Twilio) → Parse payload (Code) → Switch accept/reject     │
│   ├─ accept → UPDATE status='accepted' → Twilio: send contact info │
│   └─ reject → UPDATE status='rejected' → Twilio: send confirmation │
└────────────────────────────────────────────────────────────────────┘
```

שני workflows נפרדים כי יש שתי כניסות שונות (Supabase מצד אחד, Twilio מצד שני).

---

## 3. נתונים — אילו עמודות בשימוש (כבר קיימות)

| טבלה | עמודה | שימוש |
|---|---|---|
| `applications` | `id`, `user_id`, `restaurant_id`, `status`, `answers` (jsonb), `match_score` | הטריגר + מצב הפנייה |
| `restaurants` | `recruitment_whatsapp` (text), `name`, `mandatory_shifts` (array), `shift_commitment_min/max` | יעד ה‑WhatsApp + הדרישות |
| `profiles` | `name`, `phone`, `city`, `experience`, `min_hourly_rate` | פרטי המועמד |

- **`recruitment_whatsapp`** כבר קיים בטבלת `restaurants` — זה היעד שאליו נשלחת
  ההודעה. צריך לוודא שהוא מאוכלס (אחרת אין לאן לשלוח — ראו "מכשולים").
- **התאמת הדרישות** מחושבת בדיוק כמו באתר: `answers.req_weekend / req_nights /
  req_holidays / req_early_morning / req_commitment` (boolean) מול
  `restaurants.mandatory_shifts`. הלוגיקה ב‑`src/lib/requirements.js`
  (`computeReqMatch`) — נשכפל אותה ל‑Code node ב‑n8n (זהה ל‑`smart-candidate-feed`).

---

## 4. שני ה‑Workflows — מה כל node עושה

### Workflow A — Outbound (מועמדות חדשה → הודעת WhatsApp)

| Node | תפקיד |
|---|---|
| **Webhook · new application** | מקבל את אירוע ה‑Insert מ‑Supabase (`record.id`) |
| **Fetch context** (Postgres) | שאילתה אחת: application + profile + restaurant (כולל `recruitment_whatsapp`, `mandatory_shifts`, commitment) |
| **Gate · has whatsapp + has reqs** | אם אין `recruitment_whatsapp` — עוצרים (אין לאן לשלוח) |
| **Compute req-match** (Code) | משכפל את `computeReqMatch` — מחזיר `score`, רשימת שורות 🟢/🔴/⚫ |
| **Build template vars** (Code) | בונה את משתני ה‑ContentTemplate (שורת כותרת, גוף, payload לכפתורים = `accept:<app_id>` / `reject:<app_id>`) |
| **Twilio · send template** (HTTP) | שולח הודעת WhatsApp מבוססת Content Template מאושר |

### Workflow B — Inbound (לחיצת כפתור → עדכון + חשיפת פרטים)

| Node | תפקיד |
|---|---|
| **Webhook · twilio inbound** | מקבל את ה‑POST מ‑Twilio (כולל `ButtonPayload`, `From`) |
| **Validate Twilio signature** (Code/HTTP) | מאמת `X-Twilio-Signature` שזו באמת Twilio |
| **Parse payload** (Code) | מפצל `accept:<uuid>` → `{ action, application_id }` |
| **Switch · accept / reject** | מנתב לפי הפעולה |
| **UPDATE status** (Postgres) | `UPDATE applications SET status=$action WHERE id=$id` |
| **Fetch contact** (Postgres, רק ב‑accept) | שולף `profiles.name, phone` |
| **Twilio · send result** (HTTP) | שולח הודעת free-form (פרטי קשר / אישור דחייה) |

> **למה הודעה 2 יכולה להיות free-form?** לחיצת הכפתור היא *הודעה נכנסת* מהמשתמש,
> ולכן היא פותחת את "חלון 24 השעות" של WhatsApp. בתוך החלון מותר לשלוח טקסט חופשי
> בלי template מאושר. רק ההודעה *הראשונה* (שאנחנו יוזמים) חייבת להיות template.

---

## 5. פרטי Twilio + WhatsApp שחשוב להבין

1. **שני מצבים של שולח:**
   - **Sandbox** (לפיתוח/בדיקות) — מספר Twilio משותף; המסעדה צריכה לשלוח פעם אחת
     `join <code>` כדי "להירשם". מצוין כדי לבדוק את כל הזרימה *היום*, בחינם.
   - **Production** — מספר WhatsApp Business רשום ומאומת דרך Meta. נדרש לפני עלייה לאוויר.

2. **Business-initiated = חייב Template.** הודעה שאנחנו יוזמים (מחוץ לחלון 24 שעות)
   חייבת להיות **Content Template** מאושר מראש ע"י Meta. הכפתורים ✅/❌ הם
   *Quick-Reply buttons* בתוך ה‑template.

3. **Button payload = ההקשר.** לכל כפתור מגדירים `id`/payload. נקודד שם את מזהה
   הפנייה: `accept:<application_id>` / `reject:<application_id>`. כך כשהתשובה חוזרת
   אנחנו יודעים בדיוק לאיזו מועמדות היא שייכת — קריטי כשלמסעדה כמה פניות במקביל.
   (UUID נכנס בקלות במגבלת אורך ה‑payload.)

4. **חלון 24 שעות.** כל הודעה חופשית מותרת רק עד 24ש' מהפעולה האחרונה של המשתמש.
   הודעה 2 שלנו נשלחת מיד אחרי הלחיצה — בתוך החלון. ✓

---

## 6. מכשולים (Obstacles) — מה לצפות לו

1. **אימות WhatsApp Business (הכי משמעותי).** מספר production דורש Meta Business
   Manager + אימות עסק + אישור מספר. יכול לקחת ימים. **לכן מתחילים ב‑Sandbox.**
2. **אישור Templates.** כל template (כולל זה עם הכפתורים) עובר אישור Meta. שינוי נוסח =
   אישור מחדש. כדאי לנסח אחת ולתחזק.
3. **`recruitment_whatsapp` ריק.** הרבה מסעדות אולי לא מילאו את השדה. צריך:
   (א) להפוך אותו לשדה חובה/מומלץ ב‑onboarding של בעל המסעדה, או
   (ב) fallback ל‑`restaurants.phone`. אחרת ה‑Gate עוצר ואין הודעה.
4. **נרמול מספרי טלפון.** WhatsApp דורש פורמט E.164 (`+9725...`). מספרים ישראליים
   נשמרים כ‑`05XXXXXXXX` — צריך המרה (`+972` + הסרת 0 מוביל). נטפל ב‑Code node.
5. **התאמת תשובה לפנייה הנכונה.** נפתר ע"י ה‑payload (סעיף 5.3). בלי זה — אי אפשר
   לדעת על איזו פנייה לחצו.
6. **אבטחת ה‑Webhooks.** webhook של Supabase צריך header סודי; webhook של Twilio
   צריך אימות `X-Twilio-Signature`. אחרת כל אחד יכול לזייף "accept".
7. **service_role / הרשאות.** n8n מעדכן `status` בצד שרת — דרך חיבור Postgres כ‑role
   `postgres` (עוקף RLS), בדיוק כמו ב‑`smart-candidate-feed`. המפתח נשמר רק
   ב‑credentials של n8n.
8. **Idempotency.** אם ה‑webhook נורה פעמיים — להימנע משליחה כפולה (בדיקה ש‑status
   עדיין `new` לפני שליחה).
9. **עלויות.** Twilio גובה לפי הודעה + WhatsApp גובה לפי "שיחה". כמות נמוכה = זניח,
   אבל צריך כרטיס אשראי פעיל ב‑Twilio.
10. **סנכרון אתר ↔ WhatsApp.** אם בעל המסעדה מאשר באתר *וגם* ב‑WhatsApp — שניהם
    כותבים לאותה עמודה `status`, אז הם עקביים. רק לוודא שה‑Realtime באתר מרענן.

---

## 7. מה **אתה** צריך לעשות (פעולות שדורשות אותך — אני לא יכול)

לפי כללי הבטיחות שלי, אני לא נכנס לחשבונות, לא מזין מפתחות/סיסמאות ולא מאשר תנאים.
לכן אלה עליך:

- [ ] **חשבון Twilio** — להירשם, לאמת, ולהזין פרטי תשלום (כרטיס אשראי).
- [ ] **WhatsApp Sender** — להפעיל Sandbox (מיידי), ובהמשך לרשום מספר Business
      דרך Meta ולעבור אימות עסק.
- [ ] **אישור Templates ב‑Meta/Twilio** — להגיש את ה‑template (אני אכתוב את הנוסח,
      אתה מגיש לאישור בקונסולה).
- [ ] **להזין credentials ל‑n8n** — Twilio Account SID + Auth Token, וסיסמת
      Postgres של Supabase. אתה מדביק אותם ב‑n8n; הם לא נשמרים ב‑repo.
- [ ] **לארח n8n** — n8n Cloud או self-host (כמו ה‑workflow הקיים).
- [ ] **לאשר את ה‑Database Webhook ב‑Supabase** (פעולה בקונסולה).

## 8. מה **אני** יכול לעשות (כבר עכשיו, בלי סודות)

- [x] לכתוב את **שני ה‑workflows כקבצי JSON** מוכנים לייבוא ל‑n8n (כמו
      `smart-candidate-feed.workflow.json`), עם placeholders ל‑credentials.
- [x] לכתוב את ה‑**Code node** שמשכפל את `computeReqMatch` ובונה את גוף ההודעה
      בעברית (זהה לאתר).
- [x] לכתוב את ה‑**Code node** לנרמול טלפון ל‑E.164 ולקידוד/פענוח ה‑payload.
- [x] לנסח את **נוסח ה‑Template** (כולל הכפתורים) להגשה לאישור Meta.
- [x] לכתוב את ה‑**SQL** לעדכון הסטטוס + שאילתת ה‑context (כמו הקיימת).
- [x] להוסיף **fallback ל‑`recruitment_whatsapp`** (ולעשות אותו שדה מומלץ
      ב‑onboarding של בעל המסעדה, אם תרצה).
- [x] לבנות **בדיקת end-to-end** מול Sandbox ברגע שתזין credentials.
- [x] לכתוב README תפעולי לתיקיית `n8n/` (זהה בסגנון לקיים).

---

## 9. סדר בנייה מומלץ

1. **אני** כותב את שני קבצי ה‑JSON + ה‑README + נוסח ה‑Template (בלי סודות).
2. **אתה** פותח Twilio, מפעיל Sandbox, מזין credentials ל‑n8n.
3. בודקים end-to-end על Sandbox: מגישים מועמדת בדיקה → מקבלים הודעה →
   לוחצים ✅ → מוודאים `status='accepted'` + שהגיעו פרטי הקשר.
4. **אתה** מגיש את ה‑Template לאישור Meta + רושם מספר Business.
5. מחליפים Sandbox → Production, מפעילים את ה‑Database Webhook, עולים לאוויר.
6. מוודאים שה‑gating באתר וה‑WhatsApp עקביים (אותה עמודה `status`).

---

## 10. אבטחה ופרטיות (עקרונות)

- פרטי הקשר של המועמד **לא** נשלחים בהודעה הראשונה — רק אחרי `accept`. זהה לאתר.
- שני ה‑webhooks מאומתים (Supabase header סודי + `X-Twilio-Signature`).
- מפתחות (Twilio, Postgres) חיים **רק** ב‑credentials של n8n — לא ב‑repo, לא ב‑JSON,
  לא במסד.
- עדכון `status` רץ בצד שרת בלבד; הלקוח לא יכול לזייף אישור.
- מזהי הפנייה ב‑payload הם UUID אקראיים — לא חושפים מידע אישי.
```
