# WhatsApp Template — להגשה לאישור Meta (דרך Twilio Content Template Builder)

זה הנוסח של ההודעה הראשונה (זו שאנחנו יוזמים). היא **חייבת** להיות template מאושר.
הכפתורים ✅/❌ הם **Quick-Reply buttons**, וה‑`id` של כל כפתור נושא את ה‑payload
(`accept:<id>` / `reject:<id>`) — כך הזרימה הנכנסת יודעת על איזו מועמדות לחצו.

---

## איך יוצרים (פעם אחת)

Twilio Console → **Messaging → Content Template Builder → Create new** →
בחר/י סוג **Quick reply** → שפה **Hebrew (he)** → הדבק/י את הנוסח למטה →
**Submit for WhatsApp approval**. אחרי אישור, מעתיקים את ה‑**Content SID**
(`HX...`) ומדביקים אותו ב‑node "Twilio · send template" (שדה `ContentSid`).

## הנוסח (גוף + כפתורים)

**Body:**
```
📩 מועמד/ת חדש/ה ל-"{{1}}"

👤 {{2}}
{{3}}

🎯 התאמה לדרישות המשרה — {{4}}
{{5}}

פרטי ההתקשרות יחשפו רק לאחר אישור 👇
```

**Quick-reply buttons:**
| Button | Title | Id (payload) |
|---|---|---|
| 1 | `✅ אישור` | `{{6}}` |
| 2 | `❌ דחייה` | `{{7}}` |

## המשתנים (Content Variables) — נשלחים אוטומטית מ‑n8n

| משתנה | תוכן | מאיפה |
|---|---|---|
| `{{1}}` | שם המסעדה | `restaurant_name` |
| `{{2}}` | שם המועמד · עיר | `cand_line` |
| `{{3}}` | 💼 ניסיון · 💰 שכר | `meta_line` |
| `{{4}}` | אחוז התאמה | `score_txt` |
| `{{5}}` | שורות 🟢/🔴/⚫ של הדרישות | `reqs_block` |
| `{{6}}` | `accept:<application_id>` | `accept_payload` |
| `{{7}}` | `reject:<application_id>` | `reject_payload` |

> ה‑node "Twilio · send template" כבר בונה בדיוק את ה‑JSON הזה ב‑`ContentVariables`.
> רק צריך להחליף את `REPLACE_WITH_TWILIO_CONTENT_SID` ב‑SID שתקבל/י אחרי אישור.

### דוגמה לאיך זה ייראה אחרי מילוי

```
📩 מועמד/ת חדש/ה ל-"סטודיו תל אביב"

👤 ישראל ישראלי · תל אביב
💼 שנה+   💰 ₪45/שעה

🎯 התאמה לדרישות המשרה — 50%
🔴 🎉 סופי שבוע — לא מוכן/ה
🟢 🌙 לילות — מוכן/ה
🟢 📅 חגים — מוכן/ה
⚫ 🌅 בוקר מוקדם — לא נשאל/ה

פרטי ההתקשרות יחשפו רק לאחר אישור 👇
      [ ✅ אישור ]   [ ❌ דחייה ]
```

> **אם Meta/Twilio לא מאשרים משתנה בתוך `id` של כפתור:** fallback — להשתמש ב‑id
> קבוע (`accept`/`reject`) ובמקום זה לזהות את הפנייה לפי הפנייה האחרונה בסטטוס
> `new` של אותה מסעדה. פחות חסין כשיש כמה פניות במקביל — לכן עדיף המשתנה.

---

## #6 — אימות חתימת Twilio (להוסיף לפני production)

ב‑Workflow הנכנס, להוסיף **Code node מיד אחרי ה‑Webhook** עם הקוד הבא. הוא מוודא
שה‑POST באמת הגיע מ‑Twilio (אחרת אפשר לזייף "accept"). שמור/י את ה‑Auth Token
כמשתנה סביבה `TWILIO_AUTH_TOKEN` ב‑n8n (לא בקובץ!).

```javascript
// Validate X-Twilio-Signature. Throws (stops the workflow) if it doesn't match.
const crypto = require('crypto');
const token = $env.TWILIO_AUTH_TOKEN;            // set in n8n env, never in the file
const sig   = $json.headers['x-twilio-signature'];
// The EXACT public URL Twilio called (must match what you put in Twilio's webhook field):
const url   = 'https://YOUR-N8N-HOST/webhook/wa-apply-reply';
const params = $json.body || {};

const data = url + Object.keys(params).sort().map(k => k + params[k]).join('');
const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');

if (sig !== expected) {
  throw new Error('Invalid Twilio signature — rejected');
}
return $json;
```

> חשוב: ה‑`url` חייב להיות **בדיוק** מה ש‑Twilio קורא אליו (אותו host/path בלי
> שינוי מ‑proxy). אם n8n מאחורי reverse-proxy, ודא/י שה‑host נכון.
