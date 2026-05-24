# Google Sheets Setup — User Tracking

## 1. Create the Google Sheet

1. Go to https://sheets.google.com → **+ New** → **Blank spreadsheet**
2. Rename it: **"ShiftMatch — Users Tracking"**
3. Note the sheet — you'll come back to it after Step 2

## 2. Open Apps Script

1. In the new sheet, click **Extensions → Apps Script**
2. A new tab opens with code editor

## 3. Paste this code (replace everything inside `Code.gs`):

```javascript
// ShiftMatch — User Tracking Webhook
// Receives events from waiter-app and restaurant-owner-app and logs them to two sheets

const WAITERS_SHEET     = "מועמדים (Waiters)";
const RESTAURANTS_SHEET = "מסעדנים (Restaurants)";

const WAITER_COLUMNS = [
  "user_id", "name", "email", "phone", "city", "address",
  "max_distance_km", "position_types", "experience", "commitment",
  "min_hourly_rate", "shifts", "signed_up_at", "last_login_at",
  "last_message_sent_at", "last_contacted_restaurant", "total_messages_sent",
];

const RESTAURANT_COLUMNS = [
  "user_id", "owner_name", "email", "restaurant_name", "city", "address",
  "type", "phone", "hourly_rate", "open_positions", "urgent",
  "signed_up_at", "last_login_at", "last_published_at", "active",
];

// One-time setup — run from the editor menu (▶ Run → setupSheets)
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, WAITERS_SHEET, WAITER_COLUMNS);
  ensureSheet(ss, RESTAURANTS_SHEET, RESTAURANT_COLUMNS);
  // remove default Sheet1 if empty
  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);
  Logger.log("Setup complete!");
}

function ensureSheet(ss, name, columns) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.getRange(1, 1, 1, columns.length)
      .setFontWeight("bold")
      .setBackground("#1a1a1a")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, columns.length);
  }
}

// POST handler — receives events from our apps
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { type, event, data } = body;

    if (type === "waiter") {
      handleWaiterEvent(event, data);
    } else if (type === "restaurant") {
      handleRestaurantEvent(event, data);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleWaiterEvent(event, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(WAITERS_SHEET);
  if (!sheet) { setupSheets(); sheet = ss.getSheetByName(WAITERS_SHEET); }

  const userId = data.user_id;
  const rowIdx = findRow(sheet, userId);
  const now = new Date();

  if (rowIdx === -1) {
    // New waiter
    const row = WAITER_COLUMNS.map(col => {
      if (col === "signed_up_at") return now;
      if (col === "last_login_at") return now;
      if (col === "total_messages_sent") return 0;
      const v = data[col];
      return Array.isArray(v) ? v.join(", ") : (v ?? "");
    });
    sheet.appendRow(row);
  } else {
    // Update existing
    if (event === "login") {
      updateCell(sheet, rowIdx, "last_login_at", now);
    } else if (event === "message_sent") {
      updateCell(sheet, rowIdx, "last_message_sent_at", now);
      updateCell(sheet, rowIdx, "last_contacted_restaurant", data.last_contacted_restaurant || "");
      const cur = getCell(sheet, rowIdx, "total_messages_sent") || 0;
      updateCell(sheet, rowIdx, "total_messages_sent", Number(cur) + 1);
    } else if (event === "profile_update") {
      // Update any fields provided
      WAITER_COLUMNS.forEach(col => {
        if (col in data && data[col] !== undefined && data[col] !== null) {
          const v = Array.isArray(data[col]) ? data[col].join(", ") : data[col];
          updateCell(sheet, rowIdx, col, v);
        }
      });
    }
  }
}

function handleRestaurantEvent(event, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RESTAURANTS_SHEET);
  if (!sheet) { setupSheets(); sheet = ss.getSheetByName(RESTAURANTS_SHEET); }

  const userId = data.user_id;
  const rowIdx = findRow(sheet, userId);
  const now = new Date();

  if (rowIdx === -1) {
    const row = RESTAURANT_COLUMNS.map(col => {
      if (col === "signed_up_at") return now;
      if (col === "last_login_at") return now;
      const v = data[col];
      return Array.isArray(v) ? v.join(", ") : (v ?? "");
    });
    sheet.appendRow(row);
  } else {
    if (event === "login") {
      updateCell(sheet, rowIdx, "last_login_at", now);
    } else if (event === "published") {
      updateCell(sheet, rowIdx, "last_published_at", now);
      RESTAURANT_COLUMNS.forEach(col => {
        if (col in data && data[col] !== undefined && data[col] !== null) {
          const v = Array.isArray(data[col]) ? data[col].join(", ") : data[col];
          updateCell(sheet, rowIdx, col, v);
        }
      });
    } else if (event === "profile_update") {
      RESTAURANT_COLUMNS.forEach(col => {
        if (col in data && data[col] !== undefined && data[col] !== null) {
          const v = Array.isArray(data[col]) ? data[col].join(", ") : data[col];
          updateCell(sheet, rowIdx, col, v);
        }
      });
    }
  }
}

function findRow(sheet, userId) {
  if (!userId) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === userId) return i + 2; // 1-indexed + header
  }
  return -1;
}

function columnIndex(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(name) + 1; // 1-indexed
}

function updateCell(sheet, row, colName, value) {
  const col = columnIndex(sheet, colName);
  if (col > 0) sheet.getRange(row, col).setValue(value);
}

function getCell(sheet, row, colName) {
  const col = columnIndex(sheet, colName);
  if (col > 0) return sheet.getRange(row, col).getValue();
  return null;
}

// GET handler — allows testing in browser
function doGet() {
  return ContentService.createTextOutput("ShiftMatch tracking webhook is live ✓")
    .setMimeType(ContentService.MimeType.TEXT);
}
```

## 4. Run setup ONCE

1. In Apps Script, at the top, select **`setupSheets`** from the function dropdown
2. Click **▶ Run**
3. Grant permissions when prompted (Allow → Choose your account → Advanced → Go to project → Allow)
4. You'll see "Setup complete!" in the execution log
5. Switch back to the spreadsheet — you'll see 2 sheets created with headers

## 5. Deploy as Web App

1. In Apps Script, click **Deploy → New deployment**
2. Click the ⚙ icon next to "Select type" → **Web app**
3. Settings:
   - **Description:** ShiftMatch Webhook
   - **Execute as:** Me (your email)
   - **Who has access:** **Anyone**
4. Click **Deploy**
5. Grant permissions if asked
6. **Copy the Web app URL** (looks like `https://script.google.com/macros/s/AKfycby.../exec`)

## 6. Add the URL to both Vercel projects

**restaurant-owner-app:**
- vercel.com → restaurant-owner-app → Settings → Environment Variables
- Name: `GOOGLE_SHEETS_WEBHOOK_URL`
- Value: the URL from step 5
- Apply to: Production, Preview, Development

**waiter-app:**
- vercel.com → waiter-app → Settings → Environment Variables
- Same name + value

Then **redeploy both** (Deployments tab → ⋯ → Redeploy on latest)

## 7. Share the sheet link

1. In Google Sheets, click **Share** (top right)
2. **General access:** Anyone with the link → **Viewer**
3. Copy link — that's your read-only dashboard

Done! Now every signup, login, and message gets logged in real time.
